"""
blueprints/phases.py
─────────────────────
Top-level phases, subphases, phase moves, and phase-dependency edges.
Thin HTTP wrapper — all logic lives in services/phase_service.py.
"""
from flask import Blueprint, request
from blueprints.shared import (
    load_state, save_projects, get_project, ok, err,
)
from services import phase_service

bp = Blueprint("phases", __name__)


# ── Top-level phases ──────────────────────────────────────────────────────────

@bp.route("/api/projects/<pid>/phases", methods=["POST"])
def api_add_phase(pid):
    state = load_state()
    proj  = get_project(state["projects"], pid)
    data  = request.get_json() or {}
    phase = phase_service.create_phase(proj, data)
    save_projects(state["projects"])
    return ok({"phase": phase})


@bp.route("/api/projects/<pid>/phases/<phid>", methods=["PATCH"])
def api_update_phase(pid, phid):
    state = load_state()
    proj  = get_project(state["projects"], pid)
    data  = request.get_json() or {}
    try:
        phase = phase_service.update_phase(proj, phid, data)
    except KeyError as e:
        return err(str(e), 404)
    save_projects(state["projects"])
    return ok({"phase": phase})


@bp.route("/api/projects/<pid>/phases/<phid>", methods=["DELETE"])
def api_delete_phase(pid, phid):
    state = load_state()
    proj  = get_project(state["projects"], pid)
    try:
        phase_service.delete_phase(proj, phid)
    except KeyError as e:
        return err(str(e), 404)
    save_projects(state["projects"])
    return ok()


@bp.route("/api/projects/<pid>/phases/<phid>/move", methods=["POST"])
def api_move_phase(pid, phid):
    state     = load_state()
    proj      = get_project(state["projects"], pid)
    direction = (request.get_json() or {}).get("direction", 1)
    try:
        phases = phase_service.move_phase(proj, phid, direction)
    except KeyError as e:
        return err(str(e), 404)
    save_projects(state["projects"])
    return ok({"phases": phases})


# ── Subphases ─────────────────────────────────────────────────────────────────

@bp.route("/api/projects/<pid>/phases/<phid>/children", methods=["POST"])
def api_add_subphase(pid, phid):
    state = load_state()
    proj  = get_project(state["projects"], pid)
    data  = request.get_json() or {}
    try:
        child = phase_service.create_subphase(proj, phid, data)
    except KeyError as e:
        return err(str(e), 404)
    save_projects(state["projects"])
    return ok({"phase": child})


# ── Phase dependency edges ────────────────────────────────────────────────────

@bp.route("/api/projects/<pid>/phase-edges", methods=["POST"])
def api_add_phase_edge(pid):
    state = load_state()
    proj  = get_project(state["projects"], pid)
    data  = request.get_json() or {}
    try:
        edge = phase_service.add_phase_edge(proj, data.get("from"), data.get("to"))
    except ValueError as e:
        return err(str(e))
    save_projects(state["projects"])
    return ok({"edge": edge})


@bp.route("/api/projects/<pid>/phase-edges/<eid>", methods=["DELETE"])
def api_delete_phase_edge(pid, eid):
    state = load_state()
    proj  = get_project(state["projects"], pid)
    phase_service.delete_phase_edge(proj, eid)
    save_projects(state["projects"])
    return ok()
