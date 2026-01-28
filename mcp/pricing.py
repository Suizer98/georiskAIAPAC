from __future__ import annotations

from datetime import datetime
import logging
import os
from typing import Any

import httpx

from constant import (
    APAC_COUNTRIES,
    CACHE_TTL,
    RESTCOUNTRIES_API_URL,
    EXCHANGERATE_API_URL,
    METALPRICE_API_URL,
    GOLDPRICE_API_URL,
    ER_API_URL,
    TIMEOUT_STANDARD,
    TIMEOUT_MEDIUM,
    HTTP_USER_AGENT,
    METALS_UNIT,
)

logger = logging.getLogger(__name__)
_cache_payload: dict[str, Any] | None = None
_cache_time: datetime | None = None


def _parse_metals_live(payload: Any) -> dict[str, float | None]:
    data: dict[str, float] = {}
    if isinstance(payload, list):
        for row in payload:
            if isinstance(row, list) and len(row) >= 2 and isinstance(row[0], str):
                data[row[0].lower()] = float(row[1])
    return {"gold": data.get("gold"), "silver": data.get("silver")}


def _parse_goldprice(payload: Any) -> dict[str, float | None]:
    if not isinstance(payload, dict):
        return {"gold": None, "silver": None}
    items = payload.get("items")
    if not isinstance(items, list) or not items:
        return {"gold": None, "silver": None}
    first = items[0] if isinstance(items[0], dict) else {}
    gold = first.get("xauPrice")
    silver = first.get("xagPrice")
    return {
        "gold": float(gold) if isinstance(gold, (int, float)) else None,
        "silver": float(silver) if isinstance(silver, (int, float)) else None,
    }


def _parse_exchangerate_host(payload: Any) -> dict[str, float | None]:
    if not isinstance(payload, dict):
        return {"gold": None, "silver": None}
    rates = payload.get("rates")
    if not isinstance(rates, dict):
        return {"gold": None, "silver": None}
    xau = rates.get("XAU")
    xag = rates.get("XAG")
    gold = 1.0 / float(xau) if isinstance(xau, (int, float)) and xau else None
    silver = 1.0 / float(xag) if isinstance(xag, (int, float)) and xag else None
    return {"gold": gold, "silver": silver}


def _get_metals_spot() -> tuple[dict[str, float | None], str]:
    sources: list[tuple[str, Any, dict[str, str]]] = []
    exch_key = os.getenv("EXCHANGERATE_HOST_KEY")
    if exch_key:
        sources.append(
            (
                f"{EXCHANGERATE_API_URL}?base=USD&symbols=XAU,XAG"
                f"&access_key={exch_key}",
                _parse_exchangerate_host,
                {},
            )
        )
    metalprice_key = os.getenv("METALPRICEAPI_KEY")
    if metalprice_key:
        sources.append(
            (
                f"{METALPRICE_API_URL}"
                f"?api_key={metalprice_key}&base=USD&currencies=XAU,XAG",
                _parse_exchangerate_host,
                {},
            )
        )
    sources.append(
        (
            GOLDPRICE_API_URL,
            _parse_goldprice,
            {
                "Referer": "https://www.goldprice.org/",
                "Origin": "https://www.goldprice.org",
            },
        )
    )

    headers_base = {"User-Agent": HTTP_USER_AGENT}
    for url, parser, extra_headers in sources:
        try:
            headers = {**headers_base, **extra_headers}
            resp = httpx.get(url, timeout=TIMEOUT_STANDARD, headers=headers)
            resp.raise_for_status()
            payload = resp.json()
            data = parser(payload)
            if data.get("gold") or data.get("silver"):
                return data, url
            logger.warning("metals_spot_empty url=%s payload=%s", url, payload)
        except Exception as exc:
            logger.warning("metals_spot_error url=%s err=%s", url, exc)
    return {"gold": None, "silver": None}, "unavailable"


def _get_fx_rates_usd() -> dict[str, float]:
    url = ER_API_URL
    try:
        resp = httpx.get(url, timeout=TIMEOUT_STANDARD)
        resp.raise_for_status()
        payload = resp.json()
        rates = payload.get("rates", {})
        if isinstance(rates, dict):
            return {
                code.upper(): float(value)
                for code, value in rates.items()
                if isinstance(value, (int, float))
            }
    except Exception as exc:
        logger.warning("fx_rates_error=%s", exc)
    return {}


def _get_country_meta(country: str) -> tuple[str | None, float | None, float | None]:
    url = f"{RESTCOUNTRIES_API_URL}/{country}"
    resp = httpx.get(url, timeout=TIMEOUT_MEDIUM)
    resp.raise_for_status()
    payload = resp.json()
    if not isinstance(payload, list) or not payload:
        raise ValueError("Country not found")
    entry = payload[0]
    currencies = entry.get("currencies") or {}
    currency = None
    if isinstance(currencies, dict) and currencies:
        currency = next(iter(currencies.keys()))
    latlng = entry.get("latlng", [None, None])
    latitude = latlng[0] if isinstance(latlng, list) and len(latlng) > 0 else None
    longitude = latlng[1] if isinstance(latlng, list) and len(latlng) > 1 else None
    return currency, latitude, longitude


def list_price_data() -> dict[str, Any]:
    global _cache_payload, _cache_time
    now = datetime.utcnow()
    if _cache_payload and _cache_time and now - _cache_time < CACHE_TTL:
        return _cache_payload

    metals, metals_source = _get_metals_spot()
    fx_rates = _get_fx_rates_usd()
    items: list[dict[str, Any]] = []

    for country in APAC_COUNTRIES:
        currency = None
        latitude = None
        longitude = None
        try:
            currency, latitude, longitude = _get_country_meta(country)
        except Exception as exc:
            logger.warning("country_meta_error country=%s err=%s", country, exc)

        fx_rate = fx_rates.get(currency, None) if currency else None
        gold_usd = metals.get("gold")
        silver_usd = metals.get("silver")
        gold_local = gold_usd * fx_rate if gold_usd and fx_rate else None
        silver_local = silver_usd * fx_rate if silver_usd and fx_rate else None

        items.append(
            {
                "country": country,
                "currency": currency,
                "latitude": latitude,
                "longitude": longitude,
                "gold_usd": gold_usd,
                "silver_usd": silver_usd,
                "gold_local": gold_local,
                "silver_local": silver_local,
                "fx_rate": fx_rate,
                "unit": METALS_UNIT,
                "retrieved_at": now.isoformat() + "Z",
            }
        )

    payload = {
        "items": items,
        "retrieved_at": now.isoformat() + "Z",
        "unit": METALS_UNIT,
        "sources": {
            "metals": metals_source,
            "fx": ER_API_URL,
            "country": RESTCOUNTRIES_API_URL,
        },
    }
    _cache_payload = payload
    _cache_time = now
    return payload
