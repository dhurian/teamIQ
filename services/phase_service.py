"""
services/phase_service.py
──────────────────────────
Business logic for phases, subphases, and phase-dependency edges.
No Flask imports.
"""
from models import uid, new_phase, find_phase, all_phases_flat, remove_phase_edges


def create_phase(proj: dict, data: dict) -> dict:
    """Append a new top-level phase to *proj* and return it."""
    flat  = all_phases_flat(proj["phases"])
    last_y = max((p.get("y", 60) for p in flat), default=60)
    phase = new_phase(
        name     = data.get("name", "New Phase"),
        value    = float(data.get("value", 2)),
        unit     = data.get("unit", "weeks"),
        x        = float(data.get("x", 60)),
        y        = float(data.get("y", last_y + 150)),
        required = data.get("required", {}),
    )
    proj["phases"].append(phase)
    src = data.get("fromPhaseId")
    if src:
        proj.setdefault("phaseEdges", []).append(
            {"id": "pe_" + uid(), "from": src, "to": phase["id"]})
    return phase


def update_phase(proj: dict, phid: str, data: dict) -> dict:
    """Find phase *phid* anywhere in the tree and apply updates. Returns the phase."""
    phase, _ = find_phase(proj["phases"], phid)
    if not phase:
        raise KeyError(f"Phase {phid} not found")
    if "name"              in data: phase["name"]              = data["name"]
    if "value"             in data: phase["value"]             = float(data["value"])
    if "unit"              in data: phase["unit"]              = data["unit"]
    if "required"          in data: phase["required"]          = data["required"]
    if "expanded"          in data: phase["expanded"]          = bool(data["expanded"])
    if "startDateOverride" in data: phase["startDateOverride"] = data["startDateOverride"]
    if "endDateOverride"   in data: phase["endDateOverride"]   = data["endDateOverride"]
    if "x" in data and data["x"] is not None: phase["x"] = float(data["x"])
    if "y" in data and data["y"] is not None: phase["y"] = float(data["y"])
    # Backward compat: old 'weeks' key
    if "weeks" in data and "value" not in data:
        phase["value"] = float(data["weeks"])
        phase["unit"]  = "weeks"
    return phase


def delete_phase(proj: dict, phid: str) -> None:
    """Remove phase *phid* (and its edges) from *proj*. Raises KeyError if missing."""
    remove_phase_edges(proj, phid)
    ph, parent_list = find_phase(proj["phases"], phid)
    if ph is None:
        raise KeyError(f"Phase {phid} not found")
    parent_list.remove(ph)


def move_phase(proj: dict, phid: str, direction: int) -> list:
    """Swap phase *phid* with its neighbour in direction (+1 / -1). Returns updated list."""
    ph, lst = find_phase(proj["phases"], phid)
    if ph is None:
        raise KeyError(f"Phase {phid} not found")
    idx = lst.index(ph)
    to  = idx + direction
    if 0 <= to < len(lst):
        lst[idx], lst[to] = lst[to], lst[idx]
    return proj["phases"]


def create_subphase(proj: dict, phid: str, data: dict) -> dict:
    """Add a child phase under *phid* and return it."""
    parent, _ = find_phase(proj["phases"], phid)
    if not parent:
        raise KeyError(f"Parent phase {phid} not found")
    child = new_phase(
        name     = data.get("name", "New Subphase"),
        value    = float(data.get("value", 1)),
        unit     = data.get("unit", "weeks"),
        x=0, y=0,
        required = data.get("required", {}),
    )
    parent.setdefault("children", []).append(child)
    parent["expanded"] = True
    return child


def add_phase_edge(proj: dict, frm: str, to: str) -> dict:
    """
    Add a dependency edge from→to, deduplicating silently.
    Returns the (existing or new) edge dict.
    Raises ValueError for self-loops or missing from/to.
    """
    if not frm or not to:
        raise ValueError("from and to required")
    if frm == to:
        raise ValueError("Cannot connect a phase to itself")
    edges = proj.setdefault("phaseEdges", [])
    existing = next((e for e in edges if e["from"] == frm and e["to"] == to), None)
    if existing:
        return existing
    edge = {"id": "pe_" + uid(), "from": frm, "to": to}
    edges.append(edge)
    return edge


def delete_phase_edge(proj: dict, eid: str) -> None:
    """Remove edge *eid* from *proj*."""
    proj["phaseEdges"] = [e for e in proj.get("phaseEdges", []) if e["id"] != eid]
