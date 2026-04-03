"""
services/work_package_service.py
──────────────────────────────────
Business logic for work-package CRUD and reordering.
No Flask imports.
"""
from models import new_work_package, find_phase, all_phases_flat

_WP_FIELDS = ("name", "description", "deliverables", "assignedMembers",
              "status", "value", "unit", "startDateOverride", "endDateOverride")


def create_wp(proj: dict, phid: str, data: dict) -> dict:
    """Create a work package inside phase *phid* and return it."""
    phase, _ = find_phase(proj["phases"], phid)
    if not phase:
        raise KeyError(f"Phase {phid} not found")
    wp = new_work_package(data.get("name", "New Work Package"))
    wp["description"]     = data.get("description", "")
    wp["deliverables"]    = data.get("deliverables", [])
    wp["assignedMembers"] = data.get("assignedMembers", [])
    wp["status"]          = data.get("status", "not_started")
    phase.setdefault("workPackages", []).append(wp)
    return wp


def update_wp(proj: dict, wpid: str, data: dict) -> dict:
    """Find work package *wpid* anywhere in the phase tree and apply updates."""
    for ph in all_phases_flat(proj["phases"]):
        wp = next((w for w in ph.get("workPackages", []) if w["id"] == wpid), None)
        if wp:
            for f in _WP_FIELDS:
                if f in data:
                    wp[f] = data[f]
            return wp
    raise KeyError(f"Work package {wpid} not found")


def delete_wp(proj: dict, wpid: str) -> None:
    """Remove work package *wpid* from its parent phase."""
    for ph in all_phases_flat(proj["phases"]):
        before = len(ph.get("workPackages", []))
        ph["workPackages"] = [w for w in ph.get("workPackages", []) if w["id"] != wpid]
        if len(ph.get("workPackages", [])) < before:
            return
    raise KeyError(f"Work package {wpid} not found")


def move_wp(proj: dict, wpid: str, direction: int) -> list:
    """Swap work package *wpid* with its neighbour. Returns the updated WP list."""
    for ph in all_phases_flat(proj["phases"]):
        lst = ph.get("workPackages", [])
        wp  = next((w for w in lst if w["id"] == wpid), None)
        if wp:
            idx = lst.index(wp)
            to  = idx + direction
            if 0 <= to < len(lst):
                lst[idx], lst[to] = lst[to], lst[idx]
            return lst
    raise KeyError(f"Work package {wpid} not found")
