"""
blueprints/teams.py
────────────────────
Teams, members (add / patch / delete / move / unlink),
org-member import, and team connections.
"""
import copy
from flask import Blueprint, request
from models import uid, default_skills, build_org_lookup, flat_persons_under
from blueprints.shared import (
    load_state, save_projects, get_project, get_team, ok, err,
)

bp = Blueprint("teams", __name__)


# ── Teams ─────────────────────────────────────────────────────────────────────

@bp.route("/api/projects/<pid>/teams", methods=["POST"])
def api_add_team(pid):
    state   = load_state()
    proj    = get_project(state["projects"], pid)
    data    = request.get_json() or {}
    team_id = "team_" + uid()
    team = {
        "id":      team_id,
        "name":    data.get("name", "New Team"),
        "color":   data.get("color", "#4a9eff"),
        "x":       data.get("x", 30),
        "y":       data.get("y", 40),
        "members": [],
    }
    proj["teams"].append(team)
    proj["selTeamId"] = team_id
    save_projects(state["projects"])
    return ok({"team": team})


@bp.route("/api/projects/<pid>/teams/<tid>", methods=["PATCH"])
def api_update_team(pid, tid):
    state = load_state()
    proj  = get_project(state["projects"], pid)
    team  = get_team(proj, tid)
    data  = request.get_json() or {}
    for f in ("name", "color", "x", "y"):
        if f in data:
            team[f] = data[f]
    save_projects(state["projects"])
    return ok({"team": team})


@bp.route("/api/projects/<pid>/teams/<tid>", methods=["DELETE"])
def api_delete_team(pid, tid):
    state = load_state()
    proj  = get_project(state["projects"], pid)
    if len(proj["teams"]) <= 1:
        return err("Must keep at least one team")
    proj["teams"]       = [t for t in proj["teams"] if t["id"] != tid]
    proj["connections"] = [c for c in proj["connections"]
                           if c["from"] != tid and c["to"] != tid]
    if proj.get("selTeamId") == tid:
        proj["selTeamId"] = proj["teams"][0]["id"] if proj["teams"] else None
    save_projects(state["projects"])
    return ok()


# ── Members ───────────────────────────────────────────────────────────────────

@bp.route("/api/projects/<pid>/teams/<tid>/members", methods=["POST"])
def api_add_member(pid, tid):
    state  = load_state()
    proj   = get_project(state["projects"], pid)
    team   = get_team(proj, tid)
    data   = request.get_json() or {}
    mid    = "m_" + uid()
    member = {"id": mid}
    if data.get("orgId"):
        member["orgId"] = data["orgId"]
    else:
        member["name"]   = data.get("name", "New Colleague")
        member["role"]   = data.get("role", "Role")
        member["skills"] = default_skills()
    team["members"].append(member)
    proj["selMemberId"] = mid
    save_projects(state["projects"])
    return ok({"member": member})


@bp.route("/api/projects/<pid>/members/<mid>", methods=["PATCH"])
def api_update_member(pid, mid):
    state = load_state()
    proj  = get_project(state["projects"], pid)
    for team in proj["teams"]:
        member = next((m for m in team["members"] if m["id"] == mid), None)
        if member:
            data = request.get_json() or {}
            for f in ("name", "role"):
                if f in data:
                    member[f] = data[f]
            if "skills" in data:
                member["skills"] = data["skills"]
            if "skill" in data:
                sk = data["skill"]
                member.setdefault("skills", default_skills())
                member["skills"][sk["name"]][sk["type"]] = float(sk["value"])
            save_projects(state["projects"])
            return ok({"member": member})
    return err("Member not found", 404)


@bp.route("/api/projects/<pid>/members/<mid>", methods=["DELETE"])
def api_delete_member(pid, mid):
    state = load_state()
    proj  = get_project(state["projects"], pid)
    for team in proj["teams"]:
        before = len(team["members"])
        team["members"] = [m for m in team["members"] if m["id"] != mid]
        if len(team["members"]) < before:
            if proj.get("selMemberId") == mid:
                proj["selMemberId"] = None
            save_projects(state["projects"])
            return ok()
    return err("Member not found", 404)


@bp.route("/api/projects/<pid>/members/<mid>/move", methods=["POST"])
def api_move_member(pid, mid):
    state  = load_state()
    proj   = get_project(state["projects"], pid)
    to_tid = (request.get_json() or {}).get("teamId")
    member = None
    for team in proj["teams"]:
        idx = next((i for i, m in enumerate(team["members"]) if m["id"] == mid), None)
        if idx is not None:
            member = team["members"].pop(idx)
            break
    if not member:
        return err("Member not found", 404)
    get_team(proj, to_tid)["members"].append(member)
    proj["selTeamId"] = to_tid
    save_projects(state["projects"])
    return ok()


@bp.route("/api/projects/<pid>/members/<mid>/unlink", methods=["POST"])
def api_unlink_member(pid, mid):
    state  = load_state()
    proj   = get_project(state["projects"], pid)
    lookup = build_org_lookup(state["globalOrg"])
    for team in proj["teams"]:
        member = next((m for m in team["members"] if m["id"] == mid), None)
        if member and member.get("orgId"):
            node = lookup.get(member["orgId"], {})
            member["name"]   = node.get("name", "Unknown")
            member["role"]   = node.get("role", "")
            member["skills"] = copy.deepcopy(node.get("skills", default_skills()))
            del member["orgId"]
            save_projects(state["projects"])
            return ok({"member": member})
    return err("Member not found or not linked", 404)


@bp.route("/api/projects/<pid>/import-org", methods=["POST"])
def api_import_org(pid):
    state   = load_state()
    proj    = get_project(state["projects"], pid)
    data    = request.get_json() or {}
    team    = get_team(proj, data.get("teamId"))
    lookup  = build_org_lookup(state["globalOrg"])
    already = {m["orgId"] for t in proj["teams"]
               for m in t["members"] if m.get("orgId")}
    added   = 0
    for oid in data.get("orgIds", []):
        if oid not in already and oid in lookup:
            team["members"].append({"id": "m_" + uid(), "orgId": oid})
            already.add(oid)
            added += 1
    proj["selTeamId"] = data.get("teamId")
    save_projects(state["projects"])
    return ok({"added": added})


# ── Connections ───────────────────────────────────────────────────────────────

@bp.route("/api/projects/<pid>/connections", methods=["POST"])
def api_add_connection(pid):
    state = load_state()
    proj  = get_project(state["projects"], pid)
    data  = request.get_json() or {}
    if data.get("from") == data.get("to"):
        return err("Cannot connect a team to itself")
    conn = {
        "id":    "c_" + uid(),
        "from":  data["from"],
        "to":    data["to"],
        "label": data.get("label", ""),
        "type":  data.get("type", "integration"),
    }
    proj["connections"].append(conn)
    save_projects(state["projects"])
    return ok({"connection": conn})


@bp.route("/api/projects/<pid>/connections/<cid>", methods=["PATCH"])
def api_patch_connection(pid, cid):
    state = load_state()
    proj  = get_project(state["projects"], pid)
    conn  = next((c for c in proj["connections"] if c["id"] == cid), None)
    if not conn:
        return err("Connection not found", 404)
    data = request.get_json() or {}
    for f in ("label", "type"):
        if f in data:
            conn[f] = data[f]
    save_projects(state["projects"])
    return ok({"connection": conn})


@bp.route("/api/projects/<pid>/connections/<cid>", methods=["DELETE"])
def api_delete_connection(pid, cid):
    state = load_state()
    proj  = get_project(state["projects"], pid)
    proj["connections"] = [c for c in proj["connections"] if c["id"] != cid]
    save_projects(state["projects"])
    return ok()
