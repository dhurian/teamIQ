"""
blueprints/projects.py
───────────────────────
Project-level CRUD, active-project selection, and import/export.
"""
from flask import Blueprint, request, abort
from models import uid, new_phase
from blueprints.shared import (
    load_state, save_projects, save_org, save_active,
    get_project, normalize_projects, ok, err,
)

bp = Blueprint("projects", __name__)


@bp.route("/api/projects", methods=["GET"])
def api_get_projects():
    return load_state()["projects"], 200, {"Content-Type": "application/json"}


@bp.route("/api/projects", methods=["POST"])
def api_add_project():
    from flask import jsonify
    state   = load_state()
    data    = request.get_json() or {}
    new_id  = "proj_" + uid()
    team_id = "team_" + uid()
    proj = {
        "id":          new_id,
        "name":        data.get("name", "New Project"),
        "color":       data.get("color", "#4a9eff"),
        "selTeamId":   team_id,
        "selMemberId": None,
        "orgMode":     "none",
        "teams": [{"id": team_id, "name": "Team 1", "color": "#4a9eff",
                   "x": 30, "y": 40, "members": []}],
        "connections": [],
        "phases":      [new_phase("Phase 1", 4, "weeks", 60, 60)],
        "phaseEdges":  [],
    }
    state["projects"].append(proj)
    save_projects(state["projects"])
    save_active(new_id)
    return ok({"project": proj})


@bp.route("/api/projects/<pid>", methods=["PATCH"])
def api_update_project(pid):
    state = load_state()
    proj  = get_project(state["projects"], pid)
    data  = request.get_json() or {}
    for f in ("name", "color", "selTeamId", "selMemberId", "orgMode",
              "businessCase", "startDate", "taskEdges"):
        if f in data:
            proj[f] = data[f]
    save_projects(state["projects"])
    return ok({"project": proj})


@bp.route("/api/projects/<pid>", methods=["DELETE"])
def api_delete_project(pid):
    state = load_state()
    if not any(p["id"] == pid for p in state["projects"]):
        abort(404)
    if len(state["projects"]) <= 1:
        return err("Must keep at least one project")
    state["projects"] = [p for p in state["projects"] if p["id"] != pid]
    if state["activeProjectId"] == pid:
        save_active(state["projects"][0]["id"])
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


# ── Export / Import ───────────────────────────────────────────────────────────

@bp.route("/api/export")
def api_export():
    import datetime
    state = load_state()
    return ok({
        "version":    1,
        "exportedAt": datetime.datetime.utcnow().isoformat() + "Z",
        "globalOrg":  state["globalOrg"],
        "projects":   state["projects"],
    })


@bp.route("/api/import", methods=["POST"])
def api_import():
    data     = request.get_json() or {}
    projects = data.get("projects")
    org      = data.get("globalOrg")
    if not projects or not isinstance(projects, list):
        return err("Invalid export file — missing projects array")
    state        = load_state()
    existing_ids = {p["id"] for p in state["projects"]}
    added        = 0
    for proj in normalize_projects(projects):
        if proj.get("id") in existing_ids:
            proj["id"] = "proj_" + uid()
        state["projects"].append(proj)
        added += 1
    if org:
        state["globalOrg"] = org
        save_org(org)
    save_projects(state["projects"])
    if state["projects"]:
        save_active(state["projects"][-1]["id"])
    return ok({"imported": added})
