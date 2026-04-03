"""
blueprints/requirements.py
───────────────────────────
Project requirements with optional work-package traceability links.
Thin HTTP wrapper — all logic lives in services/requirement_service.py.
"""
from flask import Blueprint, request
from blueprints.shared import (
    load_state, save_projects, get_project, ok, err,
)
from services import requirement_service

bp = Blueprint("requirements", __name__)


@bp.route("/api/projects/<pid>/requirements", methods=["POST"])
def api_add_req(pid):
    state = load_state()
    proj  = get_project(state["projects"], pid)
    data  = request.get_json() or {}
    req   = requirement_service.create_requirement(proj, data)
    save_projects(state["projects"])
    return ok({"requirement": req})


@bp.route("/api/projects/<pid>/requirements/<rid>", methods=["PATCH"])
def api_update_req(pid, rid):
    state = load_state()
    proj  = get_project(state["projects"], pid)
    data  = request.get_json() or {}
    try:
        req = requirement_service.update_requirement(proj, rid, data)
    except KeyError as e:
        return err(str(e), 404)
    save_projects(state["projects"])
    return ok({"requirement": req})


@bp.route("/api/projects/<pid>/requirements/<rid>", methods=["DELETE"])
def api_delete_req(pid, rid):
    state = load_state()
    proj  = get_project(state["projects"], pid)
    try:
        requirement_service.delete_requirement(proj, rid)
    except KeyError as e:
        return err(str(e), 404)
    save_projects(state["projects"])
    return ok()
