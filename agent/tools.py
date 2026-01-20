import re
from typing import Any, Callable

import httpx
from langchain.tools import StructuredTool
from pydantic import create_model


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
            response = httpx.request(method, url, params=kwargs, timeout=30)
        else:
            response = httpx.request(method, url, json=kwargs, timeout=30)
        response.raise_for_status()
        try:
            return response.json()
        except ValueError:
            return response.text

    return _fn


def build_tools(mcp_url: str) -> list[StructuredTool]:
    response = httpx.get(f"{mcp_url}/api/tools", timeout=30)
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
