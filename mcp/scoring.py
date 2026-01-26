from __future__ import annotations

import logging
from datetime import datetime, timedelta
from typing import Any

import httpx

logger = logging.getLogger(__name__)


def _get_iso2_code(country_name: str) -> str:
    try:
        url = f"https://restcountries.com/v3.1/name/{country_name}"
        resp = httpx.get(url, timeout=5)
        resp.raise_for_status()
        data = resp.json()
        if isinstance(data, list) and len(data) > 0:
            return data[0].get("cca2", country_name[:2].upper())
    except Exception as e:
        logger.warning(f"Failed to fetch ISO2 for {country_name}: {e}")
    
    return country_name[:2].upper()


def _world_bank_indicator(iso2: str, indicator: str) -> float | None:
    url = (
        f"https://api.worldbank.org/v2/country/{iso2}/indicator/{indicator}"
    )
    resp = httpx.get(url, params={"format": "json"}, timeout=10)
    resp.raise_for_status()
    payload = resp.json()
    if not isinstance(payload, list) or len(payload) < 2:
        return None
    data = payload[1] or []
    for row in data:
        value = row.get("value")
        if value is not None:
            return float(value)
    return None


def _clamp(value: float, minimum: float = 0.0, maximum: float = 1.0) -> float:
    return max(minimum, min(maximum, value))


def _score_from_thresholds(value: float, thresholds: list[tuple[float, float]]) -> float:
    for limit, score in thresholds:
        if value <= limit:
            return score
    return thresholds[-1][1]


def score_economy(country: str) -> dict[str, Any]:
    source = "World Bank GDP per capita (NY.GDP.PCAP.CD)"
    try:
        iso2 = _get_iso2_code(country)
        gdp_per_capita = _world_bank_indicator(
            iso2, "NY.GDP.PCAP.CD"
        )
        if gdp_per_capita is None:
            return {
                "score": 0.5,
                "value": None,
                "source": source,
                "error": "No data found for this country",
                "retrieved_at": datetime.utcnow().isoformat() + "Z",
            }

        economy_score = _score_from_thresholds(
            gdp_per_capita,
            [
                (2000, 0.2),
                (5000, 0.4),
                (15000, 0.6),
                (30000, 0.8),
                (10_000_000, 0.95),
            ],
        )
        return {
            "score": _clamp(economy_score),
            "value": gdp_per_capita,
            "source": source,
            "retrieved_at": datetime.utcnow().isoformat() + "Z",
        }
    except Exception as exc:
        logger.warning(f"Error in score_economy: {exc}")
        return {
            "score": 0.5,
            "value": None,
            "source": source,
            "error": str(exc),
            "retrieved_at": datetime.utcnow().isoformat() + "Z",
        }


def score_safety(country: str) -> dict[str, Any]:
    source = "World Bank Intentional homicides (VC.IHR.PSRC.P5)"
    try:
        iso2 = _get_iso2_code(country)
        homicide_rate = _world_bank_indicator(
            iso2, "VC.IHR.PSRC.P5"
        )
        if homicide_rate is None:
            return {
                "score": 0.5,
                "value": None,
                "source": source,
                "error": "No data found",
                "retrieved_at": datetime.utcnow().isoformat() + "Z",
            }

        safety_score = _score_from_thresholds(
            homicide_rate,
            [
                (1, 0.9),
                (3, 0.8),
                (5, 0.7),
                (10, 0.5),
                (20, 0.3),
                (10_000, 0.1),
            ],
        )
        return {
            "score": _clamp(safety_score),
            "value": homicide_rate,
            "source": source,
            "retrieved_at": datetime.utcnow().isoformat() + "Z",
        }
    except Exception as exc:
        logger.warning(f"Error in score_safety: {exc}")
        return {
            "score": 0.5,
            "value": None,
            "source": source,
            "error": str(exc),
            "retrieved_at": datetime.utcnow().isoformat() + "Z",
        }


def score_hazard(country: str) -> dict[str, Any]:
    source = "USGS Earthquake API (Seismic Risk)"
    try:
        # USGS API: Count earthquakes > Mag 4.5 in last 1 year.
        # This is a proxy for seismic/hazard activity in the region.
        # Ideally we'd bound box by country, but for simplicity we rely on
        # generic "risk" or just return a general index.
        # Actually, USGS doesn't support "query by country name" easily without a bbox.
        # Use Open-Meteo for a specific coordinate (Capital City).
        # We need lat/lon for that.
        # Use the country lat/lon if available from _get_iso2_code's restcountries response.
        
        # 1. Get Lat/Lon for Capital
        url_geo = f"https://restcountries.com/v3.1/name/{country}"
        resp_geo = httpx.get(url_geo, timeout=5)
        resp_geo.raise_for_status()
        data_geo = resp_geo.json()
        if not data_geo:
             raise ValueError("Country not found")
        
        # Approximate center of country
        lat, lon = data_geo[0].get("latlng", [0, 0])
        
        # 2. Query USGS for quakes within 5 degrees (~500km radius) of center in last 365 days
        start_time = (datetime.utcnow() - timedelta(days=365)).strftime("%Y-%m-%d")
        end_time = datetime.utcnow().strftime("%Y-%m-%d")
        
        usgs_url = "https://earthquake.usgs.gov/fdsnws/event/1/count"
        resp = httpx.get(
            usgs_url,
            params={
                "format": "geojson",
                "starttime": start_time,
                "endtime": end_time,
                "latitude": lat,
                "longitude": lon,
                "maxradius": 2, # 2 degrees (~220km)
                "minmagnitude": 5.5
            },
            timeout=10
        )
        resp.raise_for_status()
        count_quakes = resp.json().get("count", 0)
        
        # Score based on quake frequency
        # 0 = Low risk (score 0.1)
        # 1-2 = Moderate (score 0.3)
        # 5+ = High (score 0.7)
        # 20+ = Very High (score 0.9)
        
        hazard_score = _score_from_thresholds(
            float(count_quakes),
            [
                (0, 0.1),
                (2, 0.3),
                (10, 0.6),
                (20, 0.8),
                (1000, 1.0),
            ],
        )
        
        return {
            "score": _clamp(hazard_score),
            "value": count_quakes,
            "source": f"{source} (Quakes >4.5 within 5deg of {lat},{lon})",
            "retrieved_at": datetime.utcnow().isoformat() + "Z",
        }

    except Exception as exc:
        logger.warning(f"Error in score_hazard: {exc}")
        return {
            "score": 0.5,
            "value": None,
            "source": source,
            "error": str(exc),
            "retrieved_at": datetime.utcnow().isoformat() + "Z",
        }


def score_gold(country: str) -> dict[str, Any]:
    source = "GDELT DOC 2.0 API (gold market attention)"
    try:
        query = f'gold AND "{country}"'
        url = "https://api.gdeltproject.org/api/v2/doc/doc"
        resp = httpx.get(
            url,
            params={
                "query": query,
                "mode": "TimelineVol",
                "format": "json",
                "timespan": "7d",
            },
            timeout=15,
        )
        resp.raise_for_status()
        payload = resp.json()
        timeline = payload.get("timeline", [])
        total_mentions = sum(
            float(row.get("value", 0)) for row in timeline if row
        )

        gold_score = _score_from_thresholds(
            total_mentions,
            [
                (0, 0.2),
                (5, 0.35),
                (20, 0.5),
                (50, 0.65),
                (100, 0.8),
                (10_000, 0.95),
            ],
        )
        return {
            "score": _clamp(gold_score),
            "value": total_mentions,
            "source": source,
            "retrieved_at": datetime.utcnow().isoformat() + "Z",
        }
    except Exception as exc:
        logger.warning(f"Error in score_gold: {exc}")
        return {
            "score": 0.5,
            "value": None,
            "source": source,
            "error": str(exc),
            "retrieved_at": datetime.utcnow().isoformat() + "Z",
        }


def score_uncertainty(country: str) -> dict[str, Any]:
    source = "GDELT DOC 2.0 API (Economic Policy Uncertainty)"
    try:
        # Based on: https://www.jamelsaadaoui.com/using-the-gdelt-api-to-watch-uncertainty/
        query = f'(uncertainty OR uncertain) AND (economy OR economic OR policy OR fiscal OR budget OR regulation OR tax) AND "{country}"'
        url = "https://api.gdeltproject.org/api/v2/doc/doc"
        resp = httpx.get(
            url,
            params={
                "query": query,
                "mode": "TimelineVol",
                "format": "json",
                "timespan": "30d",
            },
            timeout=15,
        )
        resp.raise_for_status()
        payload = resp.json()
        timeline = payload.get("timeline", [])
        total_mentions = sum(
            float(row.get("value", 0)) for row in timeline if row
        )

        # Higher mentions = higher uncertainty = higher risk score
        uncertainty_score = _score_from_thresholds(
            total_mentions,
            [
                (0, 0.1),
                (10, 0.3),
                (50, 0.5),
                (100, 0.7),
                (500, 0.85),
                (10_000, 0.95),
            ],
        )
        return {
            "score": _clamp(uncertainty_score),
            "value": total_mentions,
            "source": source,
            "retrieved_at": datetime.utcnow().isoformat() + "Z",
        }
    except Exception as exc:
        logger.warning(f"Error in score_uncertainty: {exc}")
        return {
            "score": 0.5,
            "value": None,
            "source": source,
            "error": str(exc),
            "retrieved_at": datetime.utcnow().isoformat() + "Z",
        }


def score_military(country: str) -> dict[str, Any]:
    source = "GDELT GEO 2.0 API (Conflict Intensity)"
    try:
        url = "https://api.gdeltproject.org/api/v2/geo/geo"
        query = f'country:{country} theme:CONFLICT'
        
        resp = httpx.get(
            url,
            params={
                "query": query,
                "mode": "pointdata",
                "format": "geojson",
                "timespan": "24h"
            },
            timeout=15,
        )
        
        if resp.status_code != 200:
             return {
                "score": 0.5,
                "value": None,
                "source": source,
                "error": f"GDELT returned status {resp.status_code}",
                "retrieved_at": datetime.utcnow().isoformat() + "Z",
            }

        try:
            data = resp.json()
        except Exception:
             return {
                "score": 0.5,
                "value": None,
                "source": source,
                "error": "GDELT response was not valid JSON",
                "retrieved_at": datetime.utcnow().isoformat() + "Z",
            }
        
        features = data.get("features", [])
        total_events = len(features)
        
        military_score = _score_from_thresholds(
            float(total_events),
            [
                (0, 0.1),
                (5, 0.2),
                (20, 0.4),
                (50, 0.6),
                (100, 0.8),
                (1000, 1.0),
            ],
        )

        return {
            "score": _clamp(military_score),
            "value": total_events,
            "source": source,
            "retrieved_at": datetime.utcnow().isoformat() + "Z",
        }
    except Exception as exc:
        logger.warning(f"Error in score_military: {exc}")
        return {
            "score": 0.5,
            "value": None,
            "source": source,
            "error": str(exc),
            "retrieved_at": datetime.utcnow().isoformat() + "Z",
        }


def score_overall(country: str) -> dict[str, Any]:
    economy = score_economy(country)
    safety = score_safety(country)
    hazard = score_hazard(country)
    military = score_military(country)
    gold = score_gold(country)
    uncertainty = score_uncertainty(country)
    
    errors = [
        component["error"]
        for component in (economy, safety, hazard, military, gold, uncertainty)
        if component.get("error")
    ]
    
    risk = (
        (20.0 * military["score"])
        + (15.0 * hazard["score"])
        + (20.0 * (1.0 - economy["score"]))
        + (20.0 * (1.0 - safety["score"]))
        + (10.0 * gold["score"])
        + (15.0 * uncertainty["score"])
    )
    return {
        "risk_level": round(_clamp(risk / 100.0) * 100.0, 2),
        "components": {
            "military": military,
            "economy": economy,
            "safety": safety,
            "hazard": hazard,
            "gold": gold,
            "uncertainty": uncertainty,
        },
        "errors": errors,
        "retrieved_at": datetime.utcnow().isoformat() + "Z",
        "formula": "20*military + 15*hazard + 20*(1-economy) + 20*(1-safety) + 10*gold + 15*uncertainty",
    }
