from __future__ import annotations

import logging
import re
from datetime import datetime, timedelta
from typing import Any

import httpx

from constant import (
    RESTCOUNTRIES_API_URL,
    WORLDBANK_API_URL,
    GDELT_DOC_API_URL,
    GDELT_GEO_API_URL,
    TIMEOUT_SHORT,
    TIMEOUT_STANDARD,
    TIMEOUT_LONG,
    TIMEOUT_MEDIUM,
    GDELT_HOTSPOT_TIMESPAN,
    GDELT_UNCERTAINTY_TIMESPAN,
    SCORING_COUNTRY_NAME_TO_ISO2,
)

logger = logging.getLogger(__name__)


def _get_iso2_code(country_name: str) -> str:
    # First try static mapping for APAC countries (faster, no API call)
    country_normalized = country_name.strip()
    if country_normalized in SCORING_COUNTRY_NAME_TO_ISO2:
        return SCORING_COUNTRY_NAME_TO_ISO2[country_normalized]

    # Fallback to API for other countries (but with longer timeout)
    try:
        url = f"{RESTCOUNTRIES_API_URL}/{country_name}"
        resp = httpx.get(url, timeout=TIMEOUT_MEDIUM)  # Use longer timeout
        resp.raise_for_status()
        data = resp.json()
        if isinstance(data, list) and len(data) > 0:
            return data[0].get("cca2", country_name[:2].upper())
    except Exception as e:
        logger.debug(f"Failed to fetch ISO2 for {country_name}: {e}")

    # Final fallback: use first 2 letters
    return country_name[:2].upper()


def _world_bank_indicator(iso2: str, indicator: str) -> float | None:
    url = f"{WORLDBANK_API_URL}/{iso2}/indicator/{indicator}"
    resp = httpx.get(url, params={"format": "json"}, timeout=TIMEOUT_STANDARD)
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


def _score_from_thresholds(
    value: float, thresholds: list[tuple[float, float]]
) -> float:
    for limit, score in thresholds:
        if value <= limit:
            return score
    return thresholds[-1][1]


def score_economy(country: str) -> dict[str, Any]:
    source = "World Bank GDP per capita (NY.GDP.PCAP.CD)"
    try:
        iso2 = _get_iso2_code(country)
        gdp_per_capita = _world_bank_indicator(iso2, "NY.GDP.PCAP.CD")
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
        homicide_rate = _world_bank_indicator(iso2, "VC.IHR.PSRC.P5")
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


def _get_official_country_name(country: str) -> list[str]:
    """Get official country names from REST Countries API and create variations."""
    variations = [country.strip()]

    try:
        url = f"{RESTCOUNTRIES_API_URL}/{country}"
        resp = httpx.get(url, timeout=TIMEOUT_SHORT)
        resp.raise_for_status()
        data = resp.json()
        if isinstance(data, list) and len(data) > 0:
            entry = data[0]
            # Get official name
            official_name = entry.get("name", {}).get("official", country)
            common_name = entry.get("name", {}).get("common", country)
            variations.extend([official_name, common_name])

            # Get alternative spellings
            alt_spellings = entry.get("altSpellings", [])
            variations.extend(alt_spellings)
    except Exception as e:
        logger.debug(f"Could not fetch official name for {country}: {e}")

    # Add manual mappings for US State Department naming conventions
    us_state_dept_mapping = {
        "China": ["China", "People's Republic of China"],
        "South Korea": ["South Korea", "Korea", "Republic of Korea"],
        "North Korea": ["North Korea", "Democratic People's Republic of Korea", "DPRK"],
        "Russia": ["Russia", "Russian Federation"],
        "United Kingdom": ["United Kingdom", "UK", "Britain", "Great Britain"],
        "United States": ["United States", "USA", "US", "America"],
        "Myanmar": ["Myanmar", "Burma"],
        "Brunei": ["Brunei", "Brunei Darussalam"],
        "Cambodia": ["Cambodia", "Kampuchea"],
        "Laos": ["Laos", "Lao People's Democratic Republic"],
        "Ivory Coast": ["Ivory Coast", "Côte d'Ivoire", "Cote d'Ivoire"],
        "East Timor": ["East Timor", "Timor-Leste"],
        "Macedonia": ["Macedonia", "North Macedonia"],
    }

    country_normalized = country.strip()
    if country_normalized in us_state_dept_mapping:
        variations.extend(us_state_dept_mapping[country_normalized])

    # Remove duplicates while preserving order
    seen = set()
    unique_variations = []
    for v in variations:
        v_lower = v.lower()
        if v_lower not in seen:
            seen.add(v_lower)
            unique_variations.append(v)

    return unique_variations


def score_ambassy_advice(country: str) -> dict[str, Any]:
    source = "US State Department Travel Advisory"
    try:
        # Use the official API endpoint
        api_url = "https://cadataapi.state.gov/api/TravelAdvisories"
        resp = httpx.get(api_url, timeout=TIMEOUT_STANDARD)
        resp.raise_for_status()
        advisories = resp.json()

        if not isinstance(advisories, list):
            raise ValueError("API did not return a list of advisories")

        # Get country name variations for matching
        country_variations = _get_official_country_name(country)
        country_lower = country.lower()
        country_variations_lower = [v.lower() for v in country_variations]

        # Also try to get ISO2 code for Category matching
        iso2_code = _get_iso2_code(country)

        level = None
        matched_country = None

        # Search through advisories for matching country
        for advisory in advisories:
            title = advisory.get("Title", "")
            category = advisory.get("Category", [])

            # Check Category field (contains ISO2 codes like ["PK"])
            if iso2_code in category:
                # Extract level from title (e.g., "Pakistan - Level 3: Reconsider Travel")
                match = re.search(r"Level\s+(\d+)", title, re.IGNORECASE)
                if match:
                    level = int(match.group(1))
                    matched_country = title
                    break

            # Also check if country name appears in title
            if not level:
                title_lower = title.lower()
                for variant_lower in country_variations_lower:
                    # Check if variant appears at the start of title (before " - Level")
                    if title_lower.startswith(
                        variant_lower + " -"
                    ) or title_lower.startswith(variant_lower + " –"):
                        match = re.search(r"Level\s+(\d+)", title, re.IGNORECASE)
                        if match:
                            level = int(match.group(1))
                            matched_country = title
                            break

                if level:
                    break

        if level is None:
            logger.warning(
                f"Could not find travel advisory level for country: {country} (tried variations: {country_variations[:5]})"
            )
            return {
                "score": 0.5,
                "value": None,
                "source": source,
                "error": f"Country '{country}' not found in travel advisories. Tried variations: {', '.join(country_variations[:5])}",
                "retrieved_at": datetime.utcnow().isoformat() + "Z",
            }

        # Convert level to risk score (0-1 scale)
        # Level 1 = Exercise normal precautions = 0.1 (low risk)
        # Level 2 = Exercise increased caution = 0.3 (moderate risk)
        # Level 3 = Reconsider travel = 0.7 (high risk)
        # Level 4 = Do not travel = 1.0 (very high risk)
        level_to_score = {
            1: 0.1,
            2: 0.3,
            3: 0.7,
            4: 1.0,
        }

        ambassy_score = level_to_score.get(level, 0.5)

        return {
            "score": _clamp(ambassy_score),
            "value": level,
            "source": source,
            "retrieved_at": datetime.utcnow().isoformat() + "Z",
        }
    except Exception as exc:
        logger.warning(f"Error in score_ambassy_advice: {exc}")
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
        resp = httpx.get(
            GDELT_DOC_API_URL,
            params={
                "query": query,
                "mode": "TimelineVol",
                "format": "json",
                "timespan": GDELT_UNCERTAINTY_TIMESPAN,
            },
            timeout=TIMEOUT_LONG,
        )
        resp.raise_for_status()
        payload = resp.json()
        timeline = payload.get("timeline", [])
        total_mentions = sum(float(row.get("value", 0)) for row in timeline if row)

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
        query = f"country:{country} theme:CONFLICT"

        resp = httpx.get(
            GDELT_GEO_API_URL,
            params={
                "query": query,
                "mode": "pointdata",
                "format": "geojson",
                "timespan": GDELT_HOTSPOT_TIMESPAN,
            },
            timeout=TIMEOUT_LONG,
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
    military = score_military(country)
    uncertainty = score_uncertainty(country)
    ambassy_advice = score_ambassy_advice(country)

    errors = [
        component["error"]
        for component in (economy, safety, military, uncertainty, ambassy_advice)
        if component.get("error")
    ]

    risk = (
        (25.0 * military["score"])
        + (25.0 * (1.0 - economy["score"]))
        + (25.0 * (1.0 - safety["score"]))
        + (15.0 * uncertainty["score"])
        + (10.0 * ambassy_advice["score"])
    )
    return {
        "risk_level": round(_clamp(risk / 100.0) * 100.0, 2),
        "components": {
            "military": military,
            "economy": economy,
            "safety": safety,
            "uncertainty": uncertainty,
            "ambassy_advice": ambassy_advice,
        },
        "errors": errors,
        "retrieved_at": datetime.utcnow().isoformat() + "Z",
        "formula": "25*military + 25*(1-economy) + 25*(1-safety) + 15*uncertainty + 10*ambassy_advice",
    }
