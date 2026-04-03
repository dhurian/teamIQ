"""
blueprints/org.py
──────────────────
Global organisation hierarchy: nodes CRUD, toggle expand.
Deleting a person node also removes them from all project teams.
"""
from flask import Blueprint, request
from models import (
    uid, default_skills, ORG_CHILD_TYPES,
    find_node, flat_persons_under, delete_node_from,
)
from blueprints.shared import (
    load_state, save_org, save_projects, ok, err,
)

bp = Blueprint("org", __name__)


@bp.route("/api/org", methods=["GET"])
def api_get_org():
    from flask import jsonify
    return jsonify(load_state()["globalOrg"])


@bp.route("/api/org/nodes", methods=["POST"])
def api_add_org_node():
    state  = load_state()
    org    = state["globalOrg"]
    data   = request.get_json() or {}
    parent = find_node([org], data.get("parentId"))
    if not parent:
        return err("Parent not found", 404)
    ctype = (ORG_CHILD_TYPES.get(parent["type"], []) or [None])[0]
    if not ctype:
        return err(f"Cannot add children to {parent['type']}")
    node = {
        "id":       "n_" + uid(),
        "type":     ctype,
        "name":     f"New {ctype.capitalize()}",
        "expanded": True,
        "children": [],
    }
    if ctype not in ("person", "org"):
        node["color"] = data.get("color", "#4a9eff")
    if ctype == "person":
        node["role"]   = ""
        node["skills"] = default_skills()
    parent.setdefault("children", []).append(node)
    parent["expanded"] = True
    save_org(org)
    return ok({"node": node})


@bp.route("/api/org/nodes/<nid>", methods=["PATCH"])
def api_update_org_node(nid):
    state = load_state()
    org   = state["globalOrg"]
    node  = find_node([org], nid)
    if not node:
        return err("Node not found", 404)
    data  = request.get_json() or {}
    for f in ("name", "role", "color", "expanded"):
        if f in data:
            node[f] = data[f]
    if "skills" in data:
        node["skills"] = data["skills"]
    if "skill" in data:
        sk = data["skill"]
        node.setdefault("skills", default_skills())
        node["skills"][sk["name"]][sk["type"]] = float(sk["value"])
    save_org(org)
    return ok({"node": node})


@bp.route("/api/org/nodes/<nid>", methods=["DELETE"])
def api_delete_org_node(nid):
    state = load_state()
    org   = state["globalOrg"]
    if nid == org["id"]:
        return err("Cannot delete root")
    target     = find_node([org], nid)
    person_ids = {p["id"] for p in flat_persons_under(target or {})}
    if not delete_node_from(org.get("children", []), nid):
        return err("Node not found", 404)
    # Cascade: remove linked members from all project teams
    for proj in state["projects"]:
        for team in proj["teams"]:
            team["members"] = [m for m in team["members"]
                               if m.get("orgId") not in person_ids]
    save_org(org)
    save_projects(state["projects"])
    return ok({"removedPersonIds": list(person_ids)})


@bp.route("/api/org/toggle/<nid>", methods=["POST"])
def api_toggle_org_node(nid):
    state = load_state()
    org   = state["globalOrg"]
    node  = find_node([org], nid)
    if not node:
        return err("Node not found", 404)
    node["expanded"] = not node.get("expanded", True)
    save_org(org)
    return ok({"expanded": node["expanded"]})
