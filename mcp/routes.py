import json
import logging
import re
import asyncio
from urllib.parse import urljoin
from datetime import datetime
from pathlib import Path
from typing import Optional

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
    score_hazard,
    score_gold,
    score_military,
    score_overall,
    score_safety,
    score_uncertainty,
)
from pricing import list_price_data
from constant import TIMEOUT_API, HTTP_QUEUE_MAXSIZE

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
async def create_risk_data(
    payload: RiskDataCreate, db: Session = Depends(get_db)
):
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
        # Fallback or error handling
        logger.exception("web_search_error query=%s", query)
        return [{"title": "Error", "body": f"Search failed: {str(e)}"}]


@router.get("/api/tools")
def list_tools():
    return load_tools()


@router.get("/api/score/military")
def get_military_score(country: str):
    return score_military(country)


@router.get("/api/score/economy")
def get_economy_score(country: str):
    return score_economy(country)


@router.get("/api/score/safety")
def get_safety_score(country: str):
    return score_safety(country)


@router.get("/api/score/hazard")
def get_hazard_score(country: str):
    return score_hazard(country)


@router.get("/api/score/gold")
def get_gold_score(country: str):
    return score_gold(country)


@router.get("/api/score/uncertainty")
def get_uncertainty_score(country: str):
    return score_uncertainty(country)


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


async def _call_tool(
    request: Request, tool: dict, arguments: dict
) -> dict | str:
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
            response = await client.request(
                method, url, params=arguments
            )
        else:
            response = await client.request(
                method, url, json=arguments
            )
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
            "result": {
                "content": [
                    {"type": "text", "text": json.dumps(result)}
                ]
            },
        }

    return {
        "jsonrpc": "2.0",
        "id": msg_id,
        "error": {"code": -32601, "message": "Method not found"},
    }
