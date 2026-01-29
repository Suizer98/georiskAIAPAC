import json
import logging
import re
import asyncio
from urllib.parse import urljoin
from datetime import datetime
from pathlib import Path
from typing import Any, Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from ddgs import DDGS

from db import get_db
from models import RiskData
from schemas import RiskDataCreate, RiskDataOut, RiskDataUpdate
from scoring import (
    score_economy,
    score_ambassy_advice,
    score_military,
    score_overall,
    score_safety,
    score_uncertainty,
)
from pricing import list_price_data
from constant import (
    TIMEOUT_API,
    TIMEOUT_STANDARD,
    HTTP_QUEUE_MAXSIZE,
    APAC_COUNTRIES,
    CACHE_TTL,
    PLACE_TO_COORDINATES,
)

router = APIRouter()
logger = logging.getLogger(__name__)

TOOLS_PATH = Path(__file__).resolve().parent / "tools.json"


def load_tools() -> list[dict]:
    if not TOOLS_PATH.exists():
        return []
    with TOOLS_PATH.open("r", encoding="utf-8") as handle:
        tools = json.load(handle)
    return tools if isinstance(tools, list) else []


TOOLS = load_tools()
_risk_subscribers: list[asyncio.Queue[str]] = []

_map_actions_pending: list[dict[str, Any]] = []
_map_action_subscribers: list[asyncio.Queue[str]] = []


async def _broadcast_map_action(action: dict) -> None:
    payload = f"data: {json.dumps(action)}\n\n"
    for q in list(_map_action_subscribers):
        try:
            q.put_nowait(payload)
        except asyncio.QueueFull:
            continue


async def _broadcast_risk_event(event: dict) -> None:
    payload = f"data: {json.dumps(event)}\n\n"
    for queue in list(_risk_subscribers):
        try:
            queue.put_nowait(payload)
        except asyncio.QueueFull:
            continue


@router.get("/health")
def health():
    return {"status": "ok"}


@router.get("/api/risk", response_model=list[RiskDataOut])
def get_risk_data(
    country: Optional[str] = None,
    city: Optional[str] = None,
    db: Session = Depends(get_db),
):
    query = db.query(RiskData)
    if country:
        query = query.filter(RiskData.country == country)
        if city:
            query = query.filter(RiskData.city == city)
    elif city:
        query = query.filter(RiskData.city == city)

    data = query.all()
    if (country or city) and not data:
        raise HTTPException(status_code=404, detail="Not found")
    return data


@router.get("/api/risk/events")
async def risk_events():
    queue: asyncio.Queue[str] = asyncio.Queue(maxsize=HTTP_QUEUE_MAXSIZE)
    _risk_subscribers.append(queue)

    async def event_generator():
        try:
            while True:
                message = await queue.get()
                yield message
        except asyncio.CancelledError:
            raise
        finally:
            if queue in _risk_subscribers:
                _risk_subscribers.remove(queue)

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@router.post("/api/risk", response_model=RiskDataOut)
async def create_risk_data(payload: RiskDataCreate, db: Session = Depends(get_db)):
    risk = (
        db.query(RiskData)
        .filter(RiskData.country == payload.country)
        .filter(RiskData.city == payload.city)
        .first()
    )
    if risk:
        risk.country = payload.country
        risk.city = payload.city
        risk.latitude = payload.latitude
        risk.longitude = payload.longitude
        risk.risk_level = payload.risk_level
        risk.updated_at = datetime.utcnow()
    else:
        risk = RiskData(**payload.model_dump())
        db.add(risk)
    db.commit()
    db.refresh(risk)
    await _broadcast_risk_event(
        {
            "type": "risk_updated",
            "id": risk.id,
            "at": datetime.utcnow().isoformat() + "Z",
        }
    )
    return risk


@router.put("/api/risk/{risk_id}", response_model=RiskDataOut)
async def update_risk_data(
    risk_id: int, payload: RiskDataUpdate, db: Session = Depends(get_db)
):
    risk = db.query(RiskData).filter(RiskData.id == risk_id).first()
    if not risk:
        raise HTTPException(status_code=404, detail="Not found")
    data = payload.model_dump(exclude_unset=True)
    for key, value in data.items():
        setattr(risk, key, value)
    risk.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(risk)
    await _broadcast_risk_event(
        {
            "type": "risk_updated",
            "id": risk.id,
            "at": datetime.utcnow().isoformat() + "Z",
        }
    )
    return risk


@router.delete("/api/risk/{risk_id}")
async def delete_risk_data(risk_id: int, db: Session = Depends(get_db)):
    risk = db.query(RiskData).filter(RiskData.id == risk_id).first()
    if not risk:
        raise HTTPException(status_code=404, detail="Not found")
    db.delete(risk)
    db.commit()
    await _broadcast_risk_event(
        {
            "type": "risk_updated",
            "id": risk_id,
            "at": datetime.utcnow().isoformat() + "Z",
        }
    )
    return {"message": "deleted"}


@router.get("/api/search")
def search_web(query: str):
    try:
        with DDGS() as ddgs:
            results = list(ddgs.text(query, max_results=5))
        payload = {
            "query": query,
            "retrieved_at": datetime.utcnow().isoformat() + "Z",
            "results": results,
        }
        logger.info(
            "web_search_results query=%s payload=%s",
            query,
            json.dumps(payload, ensure_ascii=True),
        )
        return payload
    except Exception as e:
        logger.exception("web_search_error query=%s", query)
        return [{"title": "Error", "body": str(e)}]


@router.get("/api/tools")
def list_tools():
    return load_tools()


@router.get("/api/map-actions/events")
async def map_action_events():
    queue: asyncio.Queue[str] = asyncio.Queue(maxsize=HTTP_QUEUE_MAXSIZE)
    _map_action_subscribers.append(queue)

    async def gen():
        try:
            while True:
                msg = await queue.get()
                yield msg
        except asyncio.CancelledError:
            raise
        finally:
            if queue in _map_action_subscribers:
                _map_action_subscribers.remove(queue)

    return StreamingResponse(gen(), media_type="text/event-stream")


def _place_to_center(place: str) -> tuple[float, float] | None:
    key = place.strip().lower().replace("  ", " ")
    return PLACE_TO_COORDINATES.get(key)


@router.post("/api/map-actions")
async def post_map_actions(request: Request):
    body = await request.json()
    place = body.get("place")
    lat, lon = body.get("latitude"), body.get("longitude")

    if place and str(place).strip():
        center = _place_to_center(str(place).strip())
        if center is not None:
            lat, lon = center
    if lat is None or lon is None:
        raise HTTPException(
            status_code=400,
            detail="pass 'place' (APAC name in map) or 'latitude' and 'longitude'",
        )
    try:
        latitude = float(lat)
        longitude = float(lon)
    except (TypeError, ValueError):
        raise HTTPException(
            status_code=400, detail="latitude and longitude must be numbers"
        )
    action = {"type": "zoom_to_place", "center": [longitude, latitude]}
    _map_actions_pending.append(action)
    await _broadcast_map_action(action)
    return {"ok": True}


@router.get("/api/map-actions")
def get_map_actions():
    out = list(_map_actions_pending)
    _map_actions_pending.clear()
    return {"actions": out}


@router.get("/api/score/military")
def get_military_score(country: str):
    return score_military(country)


@router.get("/api/score/economy")
def get_economy_score(country: str):
    return score_economy(country)


@router.get("/api/score/safety")
def get_safety_score(country: str):
    return score_safety(country)


@router.get("/api/score/uncertainty")
def get_uncertainty_score(country: str):
    return score_uncertainty(country)


@router.get("/api/score/ambassy_advice")
def get_ambassy_advice_score(country: str):
    return score_ambassy_advice(country)


# Cache for travel advisories
_cache_travel_advisories: dict[str, Any] | None = None
_cache_travel_advisories_time: datetime | None = None


@router.get("/api/travel_advisories")
def get_travel_advisories():
    """Get travel advisory levels for all APAC countries - optimized to fetch API once."""
    global _cache_travel_advisories, _cache_travel_advisories_time

    now = datetime.utcnow()
    # Check cache
    if (
        _cache_travel_advisories
        and _cache_travel_advisories_time
        and now - _cache_travel_advisories_time < CACHE_TTL
    ):
        return _cache_travel_advisories

    # Import here to avoid circular imports
    from scoring import _get_official_country_name
    from constant import APAC_ISO2_MAP

    # Fetch travel advisories API once (not 14 times!)
    try:
        api_url = "https://cadataapi.state.gov/api/TravelAdvisories"
        resp = httpx.get(api_url, timeout=TIMEOUT_STANDARD)
        resp.raise_for_status()
        advisories = resp.json()

        if not isinstance(advisories, list):
            raise ValueError("API did not return a list of advisories")
    except Exception as exc:
        logger.error(f"Failed to fetch travel advisories: {exc}")
        # Fallback: return error for all countries
        items = []
        for country in APAC_COUNTRIES:
            items.append(
                {
                    "country": country,
                    "level": None,
                    "error": f"Failed to fetch travel advisories: {str(exc)}",
                    "retrieved_at": now.isoformat() + "Z",
                }
            )
        payload = {
            "items": items,
            "retrieved_at": now.isoformat() + "Z",
        }
        _cache_travel_advisories = payload
        _cache_travel_advisories_time = now
        return payload

    # Pre-compute country variations and ISO2 codes for all APAC countries
    country_data = {}
    for country in APAC_COUNTRIES:
        country_variations = _get_official_country_name(country)
        country_variations_lower = [v.lower() for v in country_variations]
        iso2_code = APAC_ISO2_MAP.get(country, country[:2].upper())
        country_data[country] = {
            "variations": country_variations,
            "variations_lower": country_variations_lower,
            "iso2": iso2_code,
        }

    # Process all countries from the single advisories list
    items = []
    for country in APAC_COUNTRIES:
        level = None
        matched_title = None
        data = country_data[country]

        # Search through advisories for matching country
        for advisory in advisories:
            title = advisory.get("Title", "")
            category = advisory.get("Category", [])

            # Check Category field (contains ISO2 codes like ["PK"])
            if data["iso2"] in category:
                match = re.search(r"Level\s+(\d+)", title, re.IGNORECASE)
                if match:
                    level = int(match.group(1))
                    matched_title = title
                    break

            # Also check if country name appears in title
            if not level:
                title_lower = title.lower()
                for variant_lower in data["variations_lower"]:
                    if title_lower.startswith(
                        variant_lower + " -"
                    ) or title_lower.startswith(variant_lower + " –"):
                        match = re.search(r"Level\s+(\d+)", title, re.IGNORECASE)
                        if match:
                            level = int(match.group(1))
                            matched_title = title
                            break

                if level:
                    break

        if level is None:
            items.append(
                {
                    "country": country,
                    "level": None,
                    "error": f"Country '{country}' not found in travel advisories",
                    "retrieved_at": now.isoformat() + "Z",
                }
            )
        else:
            items.append(
                {
                    "country": country,
                    "level": level,
                    "error": None,
                    "retrieved_at": now.isoformat() + "Z",
                }
            )

    payload = {
        "items": items,
        "retrieved_at": now.isoformat() + "Z",
    }

    # Update cache
    _cache_travel_advisories = payload
    _cache_travel_advisories_time = now

    return payload


@router.get("/api/score/overall")
def get_overall_score(country: str):
    return score_overall(country)


@router.get("/api/price")
def get_price_data():
    return list_price_data()


def _mcp_tools_payload() -> list[dict]:
    tools = []
    for tool in load_tools():
        func = tool.get("function", {})
        tools.append(
            {
                "name": func.get("name", ""),
                "description": func.get("description", ""),
                "inputSchema": func.get("parameters", {"type": "object"}),
            }
        )
    return tools


def _find_tool(name: str) -> dict | None:
    for tool in load_tools():
        func = tool.get("function", {})
        if func.get("name") == name:
            return func
    return None


async def _call_tool(request: Request, tool: dict, arguments: dict) -> dict | str:
    req = tool.get("request", {})
    method = req.get("method", "POST")
    path = req.get("path", "/")
    url_path = path
    for key in re.findall(r"{([a-zA-Z0-9_]+)}", url_path):
        if key not in arguments:
            raise HTTPException(
                status_code=400,
                detail=f"Missing path parameter: {key}",
            )
        url_path = url_path.replace(f"{{{key}}}", str(arguments[key]))
        arguments = {k: v for k, v in arguments.items() if k != key}
    base_url = str(request.base_url)
    url = urljoin(base_url, url_path.lstrip("/"))
    async with httpx.AsyncClient(timeout=TIMEOUT_API) as client:
        if method in {"GET", "DELETE"}:
            response = await client.request(method, url, params=arguments)
        else:
            response = await client.request(method, url, json=arguments)
    response.raise_for_status()
    try:
        return response.json()
    except ValueError:
        return response.text


@router.post("/mcp")
async def mcp_http(request: Request):
    payload = await request.json()
    method = payload.get("method")
    msg_id = payload.get("id")

    if method == "initialize":
        return {
            "jsonrpc": "2.0",
            "id": msg_id,
            "result": {
                "protocolVersion": "2024-11-05",
                "capabilities": {"tools": {}},
                "serverInfo": {"name": "georisk-mcp", "version": "0.1.0"},
            },
        }
    if method == "tools/list":
        return {
            "jsonrpc": "2.0",
            "id": msg_id,
            "result": {"tools": _mcp_tools_payload()},
        }
    if method == "tools/call":
        params = payload.get("params", {})
        tool_name = params.get("name")
        arguments = params.get("arguments", {}) or {}
        tool = _find_tool(tool_name)
        if not tool:
            return {
                "jsonrpc": "2.0",
                "id": msg_id,
                "error": {
                    "code": -32601,
                    "message": f"Tool not found: {tool_name}",
                },
            }
        try:
            result = await _call_tool(request, tool, arguments)
        except HTTPException as exc:
            return {
                "jsonrpc": "2.0",
                "id": msg_id,
                "error": {
                    "code": -32000,
                    "message": exc.detail,
                },
            }
        return {
            "jsonrpc": "2.0",
            "id": msg_id,
            "result": {"content": [{"type": "text", "text": json.dumps(result)}]},
        }

    return {
        "jsonrpc": "2.0",
        "id": msg_id,
        "error": {"code": -32601, "message": "Method not found"},
    }
