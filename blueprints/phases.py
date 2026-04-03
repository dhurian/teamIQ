"""
blueprints/phases.py
─────────────────────
Top-level phases, subphases, phase moves, and phase-dependency edges.
"""
from flask import Blueprint, request
from models import uid, new_phase, find_phase, all_phases_flat, remove_phase_edges
from blueprints.shared import (
    load_state, save_projects, get_project, ok, err,
)

bp = Blueprint("phases", __name__)


# ── Top-level phases ──────────────────────────────────────────────────────────

@bp.route("/api/projects/<pid>/phases", methods=["POST"])
def api_add_phase(pid):
    state = load_state()
    proj  = get_project(state["projects"], pid)
    data  = request.get_json() or {}
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
    save_projects(state["projects"])
    return ok({"phase": phase})


@bp.route("/api/projects/<pid>/phases/<phid>", methods=["PATCH"])
def api_update_phase(pid, phid):
    state = load_state()
    proj  = get_project(state["projects"], pid)
    phase, _ = find_phase(proj["phases"], phid)
    if not phase:
        return err("Phase not found", 404)
    data = request.get_json() or {}
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
    save_projects(state["projects"])
    return ok({"phase": phase})


@bp.route("/api/projects/<pid>/phases/<phid>", methods=["DELETE"])
def api_delete_phase(pid, phid):
    state = load_state()
    proj  = get_project(state["projects"], pid)
    remove_phase_edges(proj, phid)
    ph, parent_list = find_phase(proj["phases"], phid)
    if ph is None:
        return err("Phase not found", 404)
    parent_list.remove(ph)
    save_projects(state["projects"])
    return ok()


@bp.route("/api/projects/<pid>/phases/<phid>/move", methods=["POST"])
def api_move_phase(pid, phid):
    state     = load_state()
    proj      = get_project(state["projects"], pid)
    direction = (request.get_json() or {}).get("direction", 1)
    ph, lst   = find_phase(proj["phases"], phid)
    if ph is None:
        return err("Phase not found", 404)
    idx = lst.index(ph)
    to  = idx + direction
    if 0 <= to < len(lst):
        lst[idx], lst[to] = lst[to], lst[idx]
    save_projects(state["projects"])
    return ok({"phases": proj["phases"]})


# ── Subphases ─────────────────────────────────────────────────────────────────

@bp.route("/api/projects/<pid>/phases/<phid>/children", methods=["POST"])
def api_add_subphase(pid, phid):
    state = load_state()
    proj  = get_project(state["projects"], pid)
    parent, _ = find_phase(proj["phases"], phid)
    if not parent:
        return err("Parent phase not found", 404)
    data  = request.get_json() or {}
    child = new_phase(
        name     = data.get("name", "New Subphase"),
        value    = float(data.get("value", 1)),
        unit     = data.get("unit", "weeks"),
        x=0, y=0,
        required = data.get("required", {}),
    )
    parent.setdefault("children", []).append(child)
    parent["expanded"] = True
    save_projects(state["projects"])
    return ok({"phase": child})


# ── Phase dependency edges ────────────────────────────────────────────────────

@bp.route("/api/projects/<pid>/phase-edges", methods=["POST"])
def api_add_phase_edge(pid):
    state = load_state()
    proj  = get_project(state["projects"], pid)
    data  = request.get_json() or {}
    frm, to = data.get("from"), data.get("to")
    if not frm or not to:
        return err("from and to required")
    if frm == to:
        return err("Cannot connect a phase to itself")
    edges = proj.setdefault("phaseEdges", [])
    existing = next((e for e in edges if e["from"] == frm and e["to"] == to), None)
    if existing:
        return ok({"edge": existing})
    edge = {"id": "pe_" + uid(), "from": frm, "to": to}
    edges.append(edge)
    save_projects(state["projects"])
    return ok({"edge": edge})


@bp.route("/api/projects/<pid>/phase-edges/<eid>", methods=["DELETE"])
def api_delete_phase_edge(pid, eid):
    state = load_state()
    proj  = get_project(state["projects"], pid)
    proj["phaseEdges"] = [e for e in proj.get("phaseEdges", []) if e["id"] != eid]
    save_projects(state["projects"])
    return ok()
