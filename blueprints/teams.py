"""
blueprints/teams.py
────────────────────
Teams, members (add / patch / delete / move / unlink),
org-member import, and team connections.
Thin HTTP wrapper — all logic lives in services/team_service.py.
"""
from flask import Blueprint, request
from blueprints.shared import (
    load_state, save_projects, get_project, ok, err,
)
from services import team_service

bp = Blueprint("teams", __name__)


# ── Teams ─────────────────────────────────────────────────────────────────────

@bp.route("/api/projects/<pid>/teams", methods=["POST"])
def api_add_team(pid):
    state = load_state()
    proj  = get_project(state["projects"], pid)
    data  = request.get_json() or {}
    team  = team_service.create_team(proj, data)
    save_projects(state["projects"])
    return ok({"team": team})


@bp.route("/api/projects/<pid>/teams/<tid>", methods=["PATCH"])
def api_update_team(pid, tid):
    state = load_state()
    proj  = get_project(state["projects"], pid)
    data  = request.get_json() or {}
    try:
        team = team_service.update_team(proj, tid, data)
    except KeyError as e:
        return err(str(e), 404)
    save_projects(state["projects"])
    return ok({"team": team})


@bp.route("/api/projects/<pid>/teams/<tid>", methods=["DELETE"])
def api_delete_team(pid, tid):
    state = load_state()
    proj  = get_project(state["projects"], pid)
    try:
        team_service.delete_team(proj, tid)
    except KeyError as e:
        return err(str(e), 404)
    except ValueError as e:
        return err(str(e))
    save_projects(state["projects"])
    return ok()


# ── Members ───────────────────────────────────────────────────────────────────

@bp.route("/api/projects/<pid>/teams/<tid>/members", methods=["POST"])
def api_add_member(pid, tid):
    state  = load_state()
    proj   = get_project(state["projects"], pid)
    data   = request.get_json() or {}
    try:
        member = team_service.create_member(proj, tid, data)
    except KeyError as e:
        return err(str(e), 404)
    save_projects(state["projects"])
    return ok({"member": member})


@bp.route("/api/projects/<pid>/members/<mid>", methods=["PATCH"])
def api_update_member(pid, mid):
    state = load_state()
    proj  = get_project(state["projects"], pid)
    data  = request.get_json() or {}
    try:
        member = team_service.update_member(proj, mid, data)
    except KeyError as e:
        return err(str(e), 404)
    save_projects(state["projects"])
    return ok({"member": member})


@bp.route("/api/projects/<pid>/members/<mid>", methods=["DELETE"])
def api_delete_member(pid, mid):
    state = load_state()
    proj  = get_project(state["projects"], pid)
    try:
        team_service.delete_member(proj, mid)
    except KeyError as e:
        return err(str(e), 404)
    save_projects(state["projects"])
    return ok()


@bp.route("/api/projects/<pid>/members/<mid>/move", methods=["POST"])
def api_move_member(pid, mid):
    state  = load_state()
    proj   = get_project(state["projects"], pid)
    to_tid = (request.get_json() or {}).get("teamId")
    try:
        team_service.move_member(proj, mid, to_tid)
    except KeyError as e:
        return err(str(e), 404)
    save_projects(state["projects"])
    return ok()


@bp.route("/api/projects/<pid>/members/<mid>/unlink", methods=["POST"])
def api_unlink_member(pid, mid):
    state = load_state()
    proj  = get_project(state["projects"], pid)
    try:
        member = team_service.unlink_member(proj, mid, state["globalOrg"])
    except KeyError as e:
        return err(str(e), 404)
    save_projects(state["projects"])
    return ok({"member": member})


@bp.route("/api/projects/<pid>/import-org", methods=["POST"])
def api_import_org(pid):
    state = load_state()
    proj  = get_project(state["projects"], pid)
    data  = request.get_json() or {}
    try:
        added = team_service.import_org_members(
            proj, data.get("teamId"), data.get("orgIds", []), state["globalOrg"])
    except KeyError as e:
        return err(str(e), 404)
    save_projects(state["projects"])
    return ok({"added": added})


# ── Connections ───────────────────────────────────────────────────────────────

@bp.route("/api/projects/<pid>/connections", methods=["POST"])
def api_add_connection(pid):
    state = load_state()
    proj  = get_project(state["projects"], pid)
    data  = request.get_json() or {}
    try:
        conn = team_service.add_connection(proj, data)
    except ValueError as e:
        return err(str(e))
    save_projects(state["projects"])
    return ok({"connection": conn})


@bp.route("/api/projects/<pid>/connections/<cid>", methods=["PATCH"])
def api_patch_connection(pid, cid):
    state = load_state()
    proj  = get_project(state["projects"], pid)
    data  = request.get_json() or {}
    try:
        conn = team_service.update_connection(proj, cid, data)
    except KeyError as e:
        return err(str(e), 404)
    save_projects(state["projects"])
    return ok({"connection": conn})


@bp.route("/api/projects/<pid>/connections/<cid>", methods=["DELETE"])
def api_delete_connection(pid, cid):
    state = load_state()
    proj  = get_project(state["projects"], pid)
    team_service.delete_connection(proj, cid)
    save_projects(state["projects"])
    return ok()
