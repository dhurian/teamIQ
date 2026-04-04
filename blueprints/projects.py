"""
blueprints/projects.py
───────────────────────
Project-level CRUD, active-project selection, and import/export.
Thin HTTP wrapper — all logic lives in services/project_service.py.
"""
from flask import Blueprint, request
from blueprints.shared import (
    load_state, save_projects, save_org, save_active,
    get_project, ok, err,
)
from services import project_service

bp = Blueprint("projects", __name__)


@bp.route("/api/projects", methods=["GET"])
def api_get_projects():
    return load_state()["projects"], 200, {"Content-Type": "application/json"}


@bp.route("/api/projects", methods=["POST"])
def api_add_project():
    state = load_state()
    data  = request.get_json() or {}
    proj  = project_service.create_project(data)
    state["projects"].append(proj)
    save_projects(state["projects"])
    save_active(proj["id"])
    return ok({"project": proj})


@bp.route("/api/projects/<pid>", methods=["PATCH"])
def api_update_project(pid):
    state = load_state()
    proj  = get_project(state["projects"], pid)
    data  = request.get_json() or {}
    project_service.update_project(proj, data)
    save_projects(state["projects"])
    return ok({"project": proj})


@bp.route("/api/projects/<pid>", methods=["DELETE"])
def api_delete_project(pid):
    state = load_state()
    try:
        new_list, new_active = project_service.delete_project(
            state["projects"], pid, state["activeProjectId"])
    except KeyError as e:
        return err(str(e), 404)
    except ValueError as e:
        return err(str(e))
    state["projects"] = new_list
    if new_active != state["activeProjectId"]:
        save_active(new_active)
    save_projects(state["projects"])
    return ok()


@bp.route("/api/active-project", methods=["POST"])
def api_set_active():
    state = load_state()
    pid   = (request.get_json() or {}).get("projectId")
    if not any(p["id"] == pid for p in state["projects"]):
        return err("Unknown project")
    save_active(pid)
    return ok()


# ── Clone ────────────────────────────────────────────────────────────────────

@bp.route("/api/projects/<pid>/clone", methods=["POST"])
def api_clone_project(pid):
    state  = load_state()
    proj   = get_project(state["projects"], pid)
    cloned = project_service.clone_project(proj)
    state["projects"].append(cloned)
    save_projects(state["projects"])
    save_active(cloned["id"])
    return ok({"project": cloned})


# ── Export / Import ───────────────────────────────────────────────────────────

@bp.route("/api/export")
def api_export():
    state   = load_state()
    payload = project_service.build_export(state)
    return ok(payload)


@bp.route("/api/import", methods=["POST"])
def api_import():
    state = load_state()
    data  = request.get_json() or {}
    try:
        merged, org, added = project_service.apply_import(state, data)
    except ValueError as e:
        return err(str(e))
    state["projects"] = merged
    if org:
        state["globalOrg"] = org
        save_org(org)
    save_projects(state["projects"])
    if state["projects"]:
        save_active(state["projects"][-1]["id"])
    return ok({"imported": added})
