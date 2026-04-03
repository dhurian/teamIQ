"""
blueprints/org.py
──────────────────
Global organisation hierarchy: nodes CRUD, toggle expand.
Thin HTTP wrapper — all logic lives in services/org_service.py.
"""
from flask import Blueprint, request, jsonify
from blueprints.shared import (
    load_state, save_org, save_projects, ok, err,
)
from services import org_service

bp = Blueprint("org", __name__)


@bp.route("/api/org", methods=["GET"])
def api_get_org():
    return jsonify(load_state()["globalOrg"])


@bp.route("/api/org/nodes", methods=["POST"])
def api_add_org_node():
    state = load_state()
    data  = request.get_json() or {}
    try:
        node = org_service.create_org_node(state["globalOrg"], data)
    except KeyError as e:
        return err(str(e), 404)
    except ValueError as e:
        return err(str(e))
    save_org(state["globalOrg"])
    return ok({"node": node})


@bp.route("/api/org/nodes/<nid>", methods=["PATCH"])
def api_update_org_node(nid):
    state = load_state()
    data  = request.get_json() or {}
    try:
        node = org_service.update_org_node(state["globalOrg"], nid, data)
    except KeyError as e:
        return err(str(e), 404)
    save_org(state["globalOrg"])
    return ok({"node": node})


@bp.route("/api/org/nodes/<nid>", methods=["DELETE"])
def api_delete_org_node(nid):
    state = load_state()
    try:
        removed_ids = org_service.delete_org_node(
            state["globalOrg"], nid, state["projects"])
    except ValueError as e:
        return err(str(e))
    except KeyError as e:
        return err(str(e), 404)
    save_org(state["globalOrg"])
    save_projects(state["projects"])
    return ok({"removedPersonIds": list(removed_ids)})


@bp.route("/api/org/toggle/<nid>", methods=["POST"])
def api_toggle_org_node(nid):
    state = load_state()
    try:
        expanded = org_service.toggle_org_node(state["globalOrg"], nid)
    except KeyError as e:
        return err(str(e), 404)
    save_org(state["globalOrg"])
    return ok({"expanded": expanded})
