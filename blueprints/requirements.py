"""
blueprints/requirements.py
───────────────────────────
Project requirements with optional work-package traceability links.
"""
from flask import Blueprint, request
from models import uid
from blueprints.shared import (
    load_state, save_projects, get_project, ok, err,
)

bp = Blueprint("requirements", __name__)


@bp.route("/api/projects/<pid>/requirements", methods=["POST"])
def api_add_req(pid):
    state = load_state()
    proj  = get_project(state["projects"], pid)
    data  = request.get_json() or {}
    req   = {
        "id":        "req_" + uid(),
        "text":      data.get("text", ""),
        "linkedWPs": data.get("linkedWPs", []),
    }
    proj.setdefault("requirements", []).append(req)
    save_projects(state["projects"])
    return ok({"requirement": req})


@bp.route("/api/projects/<pid>/requirements/<rid>", methods=["PATCH"])
def api_update_req(pid, rid):
    state = load_state()
    proj  = get_project(state["projects"], pid)
    req   = next((r for r in proj.get("requirements", []) if r["id"] == rid), None)
    if not req:
        return err("Requirement not found", 404)
    data = request.get_json() or {}
    for f in ("text", "linkedWPs"):
        if f in data:
            req[f] = data[f]
    save_projects(state["projects"])
    return ok({"requirement": req})


@bp.route("/api/projects/<pid>/requirements/<rid>", methods=["DELETE"])
def api_delete_req(pid, rid):
    state  = load_state()
    proj   = get_project(state["projects"], pid)
    before = len(proj.get("requirements", []))
    proj["requirements"] = [r for r in proj.get("requirements", [])
                            if r["id"] != rid]
    if len(proj.get("requirements", [])) == before:
        return err("Requirement not found", 404)
    save_projects(state["projects"])
    return ok()
