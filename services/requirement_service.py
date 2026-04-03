"""
services/requirement_service.py
─────────────────────────────────
Business logic for project requirements and WP traceability links.
No Flask imports.
"""
from models import uid


def create_requirement(proj: dict, data: dict) -> dict:
    """Append a new requirement to *proj* and return it."""
    req = {
        "id":        "req_" + uid(),
        "text":      data.get("text", ""),
        "linkedWPs": data.get("linkedWPs", []),
    }
    proj.setdefault("requirements", []).append(req)
    return req


def update_requirement(proj: dict, rid: str, data: dict) -> dict:
    """
    Apply field updates to requirement *rid*. Returns the requirement.
    Raises KeyError if not found.
    """
    req = next((r for r in proj.get("requirements", []) if r["id"] == rid), None)
    if not req:
        raise KeyError(f"Requirement {rid} not found")
    for f in ("text", "linkedWPs"):
        if f in data:
            req[f] = data[f]
    return req


def delete_requirement(proj: dict, rid: str) -> None:
    """
    Remove requirement *rid* from *proj*.
    Raises KeyError if not found.
    """
    before = len(proj.get("requirements", []))
    proj["requirements"] = [r for r in proj.get("requirements", [])
                            if r["id"] != rid]
    if len(proj.get("requirements", [])) == before:
        raise KeyError(f"Requirement {rid} not found")
