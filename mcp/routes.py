import json
import logging
import os
import re
import asyncio
from urllib.parse import urljoin
from datetime import datetime
from pathlib import Path
from typing import Any, Optional

import httpx
from opensky_api import OpenSkyApi
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel
from fastapi.responses import JSONResponse, StreamingResponse
from sqlalchemy.orm import Session
from ddgs import DDGS

from db import get_db
from models import RiskData, GdeltDisplay
from schemas import RiskDataCreate, RiskDataOut, RiskDataUpdate, GdeltDisplayOut
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
    CACHE_TTL,
    PLACE_TO_COORDINATES,
    GDELT_GEO_API_URL,
    GDELT_HOTSPOT_TIMESPAN,
    APAC_LON_MIN,
    APAC_LON_MAX,
    APAC_LAT_MIN,
    APAC_LAT_MAX,
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

_gdelt_subscribers: list[asyncio.Queue[str]] = []


async def _broadcast_gdelt_event(event: dict) -> None:
    msg = f"data: {json.dumps(event)}\n\n"
    for q in list(_gdelt_subscribers):
        try:
            q.put_nowait(msg)
        except asyncio.QueueFull:
            continue


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
    # Return 200 with empty list when filtered by country/city and no match (no 404 so agent/MCP callers get consistent list response)
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

    resp = StreamingResponse(event_generator(), media_type="text/event-stream")
    resp.headers["Cache-Control"] = "no-cache, no-store"
    resp.headers["X-Accel-Buffering"] = "no"
    resp.headers["Connection"] = "keep-alive"
    return resp


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
    await _broadcast_gdelt_event(
        {"type": "gdelt_updated", "at": datetime.utcnow().isoformat() + "Z"}
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
    await _broadcast_gdelt_event(
        {"type": "gdelt_updated", "at": datetime.utcnow().isoformat() + "Z"}
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
    await _broadcast_gdelt_event(
        {"type": "gdelt_updated", "at": datetime.utcnow().isoformat() + "Z"}
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


_cache_travel_advisories_raw: list[dict[str, Any]] | None = None
_cache_travel_advisories_time: datetime | None = None


def _parse_advisory_title(title: str) -> tuple[str, int | None]:
    """Extract country name (before ' - Level') and level number from API Title."""
    name = title.split(" - ")[0].split(" – ")[0].strip() if title else ""
    match = re.search(r"Level\s+(\d+)", title or "", re.IGNORECASE)
    level = int(match.group(1)) if match else None
    return name, level


def _extract_category_code(category: Any) -> str:
    """Get country code from API Category (list, str, or XML-style dict e.g. {'d3p1:string': 'TW'})."""
    if isinstance(category, str) and category.strip():
        return category.strip()
    if isinstance(category, list) and category:
        first = category[0]
        if isinstance(first, str) and first.strip():
            return first.strip()
        if isinstance(first, dict):
            for v in first.values():
                if isinstance(v, str) and v.strip():
                    return v.strip()
            return ""
        return ""
    if isinstance(category, dict):
        for v in category.values():
            if isinstance(v, str) and v.strip():
                return v.strip()
            if isinstance(v, list) and v and isinstance(v[0], str):
                return v[0].strip()
        return ""
    return ""


class TravelAdvisoriesRequest(BaseModel):
    api_code_to_iso2: dict[str, str] = {}


@router.post("/api/travel_advisories")
def get_travel_advisories(body: TravelAdvisoriesRequest):
    global _cache_travel_advisories_raw, _cache_travel_advisories_time

    now = datetime.utcnow()
    mapping = body.api_code_to_iso2 or {}

    if (
        _cache_travel_advisories_raw is not None
        and _cache_travel_advisories_time is not None
        and now - _cache_travel_advisories_time < CACHE_TTL
    ):
        raw = _cache_travel_advisories_raw
    else:
        try:
            api_url = "https://cadataapi.state.gov/api/TravelAdvisories"
            resp = httpx.get(api_url, timeout=TIMEOUT_STANDARD)
            resp.raise_for_status()
            advisories = resp.json()
            if not isinstance(advisories, list):
                raise ValueError("API did not return a list of advisories")
        except Exception as exc:
            logger.error(f"Failed to fetch travel advisories: {exc}")
            payload = {
                "items": [],
                "retrieved_at": now.isoformat() + "Z",
            }
            return payload
        raw = []
        for advisory in advisories:
            title = advisory.get("Title", "") or ""
            category = advisory.get("Category")
            country_name, level = _parse_advisory_title(title)
            api_code = _extract_category_code(category) if category is not None else ""
            raw.append(
                {
                    "api_code": api_code,
                    "country_name": country_name,
                    "level": level,
                }
            )
        _cache_travel_advisories_raw = raw
        _cache_travel_advisories_time = now

    def to_country(code: str) -> str:
        return mapping.get(code, code) if mapping else code

    items = [
        {
            "country": to_country(r["api_code"]),
            "country_name": r["country_name"],
            "level": r["level"],
            "error": None,
            "retrieved_at": now.isoformat() + "Z",
        }
        for r in raw
    ]
    return {
        "items": items,
        "retrieved_at": now.isoformat() + "Z",
    }


@router.get("/api/score/overall")
def get_overall_score(country: str):
    return score_overall(country)


class PriceRequest(BaseModel):
    country_codes: list[str] = ()


@router.post("/api/price")
def get_price_data(body: PriceRequest):
    return list_price_data(country_codes=body.country_codes or [])


def _parse_gdelt_features(data: dict) -> list[dict]:
    features = data.get("features") or []
    out = []
    for f in features:
        geom = f.get("geometry")
        if not geom or geom.get("type") != "Point":
            continue
        coords = geom.get("coordinates")
        if not coords or len(coords) < 2:
            continue
        lng, lat = float(coords[0]), float(coords[1])
        if not (
            APAC_LON_MIN <= lng <= APAC_LON_MAX and APAC_LAT_MIN <= lat <= APAC_LAT_MAX
        ):
            continue
        props = f.get("properties") or {}
        count = (
            props.get("count")
            or props.get("numarticles")
            or props.get("numcounts")
            or 1
        )
        out.append(
            {
                "latitude": lat,
                "longitude": lng,
                "count": int(count) if count is not None else 1,
            }
        )
    return out


async def _fetch_gdelt_hotspots(
    query: str, timespan: str
) -> tuple[str, str, list[dict]]:
    async with httpx.AsyncClient(timeout=TIMEOUT_STANDARD) as client:
        resp = await client.get(
            GDELT_GEO_API_URL,
            params={
                "query": query,
                "mode": "pointheatmap",
                "format": "geojson",
                "timespan": timespan,
            },
        )
        resp.raise_for_status()
        data = resp.json()
    features = _parse_gdelt_features(data)
    return query, timespan, features


@router.get("/api/gdelt", response_model=GdeltDisplayOut)
async def get_gdelt_hotspots(db: Session = Depends(get_db)):
    row = db.query(GdeltDisplay).first()
    if row:
        features = row.get_features()
        return {"query": row.query, "timespan": row.timespan, "features": features}
    query, timespan, features = await _fetch_gdelt_hotspots(
        "military", GDELT_HOTSPOT_TIMESPAN
    )
    row = GdeltDisplay(query=query, timespan=timespan)
    row.set_features(features)
    db.add(row)
    db.commit()
    db.refresh(row)
    return {"query": query, "timespan": timespan, "features": features}


@router.get("/api/gdelt/events")
async def gdelt_events():
    queue: asyncio.Queue[str] = asyncio.Queue(maxsize=HTTP_QUEUE_MAXSIZE)
    _gdelt_subscribers.append(queue)

    async def event_generator():
        try:
            while True:
                message = await queue.get()
                yield message
        except asyncio.CancelledError:
            raise
        finally:
            if queue in _gdelt_subscribers:
                _gdelt_subscribers.remove(queue)

    resp = StreamingResponse(event_generator(), media_type="text/event-stream")
    resp.headers["Cache-Control"] = "no-cache, no-store"
    resp.headers["X-Accel-Buffering"] = "no"
    resp.headers["Connection"] = "keep-alive"
    return resp


class GdeltPostRequest(BaseModel):
    query: Optional[str] = "military"
    timespan: Optional[str] = GDELT_HOTSPOT_TIMESPAN


@router.post("/api/gdelt", response_model=GdeltDisplayOut)
async def post_gdelt_hotspots(body: GdeltPostRequest, db: Session = Depends(get_db)):
    query = (body.query or "military").strip() if body.query else "military"
    timespan = body.timespan or GDELT_HOTSPOT_TIMESPAN
    try:
        _, _, features = await _fetch_gdelt_hotspots(query, timespan)
    except Exception as exc:
        logger.warning("GDELT request failed: %s", exc)
        raise HTTPException(
            status_code=502,
            detail="GDELT API request failed; display not updated.",
        )
    row = db.query(GdeltDisplay).first()
    if row:
        row.query = query
        row.timespan = timespan
        row.set_features(features)
        row.updated_at = datetime.utcnow()
    else:
        row = GdeltDisplay(query=query, timespan=timespan)
        row.set_features(features)
        db.add(row)
    db.commit()
    db.refresh(row)
    await _broadcast_gdelt_event(
        {"type": "gdelt_updated", "at": datetime.utcnow().isoformat() + "Z"}
    )
    # Also notify risk subscribers so frontend refetches GDELT via risk stream (same as risk layer)
    await _broadcast_risk_event(
        {"type": "gdelt_updated", "at": datetime.utcnow().isoformat() + "Z"}
    )
    return {"query": query, "timespan": timespan, "features": features}


@router.get("/api/opensky/states")
async def get_opensky_states():
    """Current flight states over APAC for frontend map. Credentials from .env (optional)."""
    username = os.getenv("OPENSKY_USERNAME") or None
    password = os.getenv("OPENSKY_PASSWORD") or None
    api = OpenSkyApi(username, password)
    bbox = (
        APAC_LAT_MIN,
        APAC_LAT_MAX,
        APAC_LON_MIN,
        APAC_LON_MAX,
    )  # min_lat, max_lat, min_lon, max_lon
    result = await asyncio.to_thread(api.get_states, 0, None, bbox)
    if not result or not result.states:
        return []
    out = []
    for s in result.states:
        if s.latitude is None or s.longitude is None:
            continue
        out.append(
            {
                "icao24": s.icao24,
                "callsign": (s.callsign or "").strip() or None,
                "latitude": s.latitude,
                "longitude": s.longitude,
                "baro_altitude": s.baro_altitude,
                "true_track": getattr(s, "true_track", None),
            }
        )
    return out


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
