import re
import time
from typing import Any, Callable
from urllib.parse import urlencode

import httpx
from httpx import HTTPStatusError
from langchain.tools import StructuredTool
from pydantic import create_model

from constant import CACHE_TTL_SECONDS, TIMEOUT_API


def _type_from_json(type_name: str) -> type:
    return {
        "string": str,
        "number": float,
        "integer": int,
        "boolean": bool,
        "object": dict,
    }.get(type_name, str)


def _build_args_model(name: str, parameters: dict) -> type:
    properties = parameters.get("properties", {})
    required = set(parameters.get("required", []))
    fields: dict[str, tuple[type, Any]] = {}
    for prop_name, prop_schema in properties.items():
        py_type = _type_from_json(prop_schema.get("type", "string"))
        if prop_name in required:
            fields[prop_name] = (py_type, ...)
        else:
            fields[prop_name] = (py_type | None, None)
    return create_model(f"{name.title()}Args", **fields)


_GET_CACHE: dict[str, tuple[float, Any]] = {}


def _cache_key(url: str, params: dict[str, Any]) -> str:
    if not params:
        return url
    items = sorted(params.items(), key=lambda item: item[0])
    return f"{url}?{urlencode(items)}"


def _make_tool_fn(mcp_url: str, method: str, path: str) -> Callable[..., Any]:
    def _fn(**kwargs: Any) -> Any:
        url = f"{mcp_url}{path}"
        placeholders = re.findall(r"{([a-zA-Z0-9_]+)}", url)
        for key in placeholders:
            if key not in kwargs:
                raise ValueError(f"Missing path parameter: {key}")
            url = url.replace(f"{{{key}}}", str(kwargs.get(key)))
            kwargs = {k: v for k, v in kwargs.items() if k != key}
        if method in {"GET", "DELETE"}:
            if method == "GET":
                key = _cache_key(url, kwargs)
                cached = _GET_CACHE.get(key)
                if cached and time.time() - cached[0] < CACHE_TTL_SECONDS:
                    return cached[1]
            response = httpx.request(method, url, params=kwargs, timeout=TIMEOUT_API)
        else:
            response = httpx.request(method, url, json=kwargs, timeout=TIMEOUT_API)

        # GET /api/risk returns 404 when no data for country/city — return "No data found" so the AI can answer clearly.
        if method == "GET" and path == "/api/risk" and response.status_code == 404:
            payload = {
                "found": False,
                "data": [],
                "message": "No data found for the specified country or city in the database.",
            }
            key = _cache_key(url, kwargs)
            _GET_CACHE[key] = (time.time(), payload)
            return payload

        try:
            response.raise_for_status()
        except HTTPStatusError as e:
            if (
                e.response.status_code == 404
                and method == "GET"
                and path == "/api/risk"
            ):
                payload = {
                    "found": False,
                    "data": [],
                    "message": "No data found for the specified country or city in the database.",
                }
                key = _cache_key(url, kwargs)
                _GET_CACHE[key] = (time.time(), payload)
                return payload
            raise
        try:
            payload = response.json()
        except ValueError:
            payload = response.text
        if method == "GET":
            _GET_CACHE[_cache_key(url, kwargs)] = (time.time(), payload)
        return payload

    return _fn


def build_tools(mcp_url: str) -> list[StructuredTool]:
    response = httpx.get(f"{mcp_url}/api/tools", timeout=TIMEOUT_API)
    response.raise_for_status()
    tool_defs = response.json()
    tools = []
    for tool_def in tool_defs:
        func = tool_def["function"]
        req = func.get("request", {})
        method = req.get("method", "POST")
        path = req.get("path", "/")
        args_model = _build_args_model(func["name"], func.get("parameters", {}))
        tool_fn = _make_tool_fn(mcp_url, method, path)
        tools.append(
            StructuredTool.from_function(
                name=func["name"],
                description=func.get("description", ""),
                args_schema=args_model,
                func=tool_fn,
            )
        )
    return tools
