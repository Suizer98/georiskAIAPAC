import os
from typing import Any

import httpx
from fastapi import APIRouter, HTTPException

from constant import TIMEOUT_API

router = APIRouter()


def mcp_url_or_raise() -> str:
    mcp_url = os.getenv("MCP_URL")
    if not mcp_url:
        raise HTTPException(status_code=500, detail="MCP_URL is not set")
    return mcp_url.rstrip("/")


def compute_risk_score(signals: dict[str, Any]) -> float:
    try:
        military = float(signals["military"])
        economy = float(signals["economy"])
        safety = float(signals["safety"])
        hazard = float(signals["hazard"])
    except (KeyError, TypeError, ValueError):
        raise HTTPException(
            status_code=400,
            detail="signals must include military, economy, safety, hazard (0-1)",
        )
    score = 25.0 * (military + hazard + (1.0 - economy) + (1.0 - safety))
    if score < 0.0:
        return 0.0
    if score > 100.0:
        return 100.0
    return score


@router.post("/tool/compute_risk")
def compute_risk(payload: dict):
    mcp_url = mcp_url_or_raise()
    signals = payload.get("signals") or {}
    risk_level = compute_risk_score(signals)

    risk_payload = {
        "country": payload.get("country"),
        "city": payload.get("city"),
        "latitude": payload.get("latitude"),
        "longitude": payload.get("longitude"),
        "risk_level": risk_level,
    }

    response = httpx.post(
        f"{mcp_url}/api/risk",
        json=risk_payload,
        timeout=TIMEOUT_API,
    )
    if response.status_code >= 400:
        raise HTTPException(
            status_code=502, detail="MCP error while writing risk data"
        )

    return {"risk_level": risk_level, "db": response.json()}
