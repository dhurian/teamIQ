"""
TeamIQ – Flask application (SQLite-backed, production-ready)
"""
from flask import Flask, jsonify, request, render_template, send_from_directory, abort
import copy, json, os
from db import init_db, db_get, db_set
from models import (
    ALL_SKILLS, TECH_SKILLS, PERS_SKILLS, DURATION_UNITS, WP_STATUSES,
    ORG_CHILD_TYPES, ORG_TYPE_ICON, ORG_TYPE_COLOR,
    default_skills, uid, phase_weeks, to_weeks, new_phase, new_work_package,
    run_monte_carlo, build_org_lookup,
    find_node, flat_persons_under, delete_node_from,
    find_phase, all_phases_flat, remove_phase_edges,
    seed_org, seed_projects,
)
app = Flask(__name__)

@app.errorhandler(404)
def not_found(e):
    return jsonify({"ok": False, "error": "Not found"}), 404

@app.errorhandler(405)
def method_not_allowed(e):
    return jsonify({"ok": False, "error": "Method not allowed"}), 405

# ── State ─────────────────────────────────────────────────────────────────────
def load_state():
    projects = db_get("projects")
    org      = db_get("globalOrg")
    active   = db_get("activeProjectId")
    if projects is None:
        projects = seed_projects(); db_set("projects", projects)
    if org is None:
        org = seed_org(); db_set("globalOrg", org)
    if active is None:
        active = projects[0]["id"]; db_set("activeProjectId", active)
    return {"activeProjectId": active, "globalOrg": org, "projects": projects}

def save_projects(p): db_set("projects", p)
def save_org(o):      db_set("globalOrg", o)
def save_active(pid): db_set("activeProjectId", pid)

def get_project(projects, pid):
    p = next((p for p in projects if p["id"] == pid), None)
    if not p: abort(404)
    return p

def get_team(project, tid):
    t = next((t for t in project["teams"] if t["id"] == tid), None)
    if not t: abort(404)
    return t

def ok(data=None):      return jsonify({"ok": True,  **(data or {})})
def err(msg, code=400): return jsonify({"ok": False, "error": msg}), code

# ── PWA ───────────────────────────────────────────────────────────────────────
@app.route("/manifest.json")
def manifest():
    return send_from_directory("static/pwa", "manifest.json",
                               mimetype="application/manifest+json")

@app.route("/sw.js")
def service_worker():
    r = send_from_directory("static/pwa", "sw.js")
    r.headers["Service-Worker-Allowed"] = "/"
    r.headers["Cache-Control"] = "no-cache"
    return r

@app.route("/offline.html")
def offline():
    return send_from_directory("static/pwa", "offline.html")

@app.route("/favicon.ico")
def favicon():
    return send_from_directory("static", "favicon.ico", mimetype="image/x-icon")

# ── Frontend ──────────────────────────────────────────────────────────────────
@app.route("/")
def index():
    return render_template("index.html",
        all_skills=ALL_SKILLS, tech_skills=TECH_SKILLS, pers_skills=PERS_SKILLS,
        duration_units=DURATION_UNITS, wp_statuses=WP_STATUSES,
        org_type_icon=json.dumps(ORG_TYPE_ICON),
        org_type_color=json.dumps(ORG_TYPE_COLOR),
        org_child_types=json.dumps(ORG_CHILD_TYPES))

@app.route("/api/state")
def api_state():
    return jsonify(load_state())

# ── Simulation ────────────────────────────────────────────────────────────────
@app.route("/api/simulate", methods=["POST"])
def api_simulate():
    body   = request.get_json()
    pid    = body.get("projectId")
    n_runs = int(body.get("runs", 2000))
    state  = load_state()
    proj   = get_project(state["projects"], pid)
    lookup = build_org_lookup(state["globalOrg"])
    members = [m for t in proj["teams"] for m in t["members"]]
    result  = run_monte_carlo(members, proj["phases"], lookup, n=n_runs)
    team_results = {
        t["id"]: run_monte_carlo(t["members"], proj["phases"], lookup,
                                 n=max(500, n_runs // 4))
        for t in proj["teams"]
    }
    return jsonify({"combined": result, "teams": team_results})

@app.route("/api/simulate/portfolio", methods=["POST"])
def api_simulate_portfolio():
    state  = load_state()
    lookup = build_org_lookup(state["globalOrg"])
    return jsonify({
        p["id"]: run_monte_carlo(
            [m for t in p["teams"] for m in t["members"]],
            p["phases"], lookup, n=500)
        for p in state["projects"]
    })

# ── Projects ──────────────────────────────────────────────────────────────────
@app.route("/api/projects", methods=["GET"])
def api_get_projects():
    return jsonify(load_state()["projects"])

@app.route("/api/projects", methods=["POST"])
def api_add_project():
    state   = load_state()
    data    = request.get_json() or {}
    new_id  = "proj_" + uid()
    team_id = "team_" + uid()
    proj = {
        "id": new_id, "name": data.get("name", "New Project"),
        "color": data.get("color", "#4a9eff"),
        "selTeamId": team_id, "selMemberId": None, "orgMode": "none",
        "teams": [{"id": team_id, "name": "Team 1", "color": "#4a9eff",
                   "x": 30, "y": 40, "members": []}],
        "connections": [],
        "phases": [new_phase("Phase 1", 4, "weeks", 60, 60)],
        "phaseEdges": [],
    }
    state["projects"].append(proj)
    save_projects(state["projects"]); save_active(new_id)
    return ok({"project": proj})

@app.route("/api/projects/<pid>", methods=["PATCH"])
def api_update_project(pid):
    state = load_state()
    proj  = get_project(state["projects"], pid)
    data  = request.get_json() or {}
    for f in ("name", "color", "selTeamId", "selMemberId", "orgMode", "businessCase", "startDate"):
        if f in data: proj[f] = data[f]
    save_projects(state["projects"])
    return ok({"project": proj})

@app.route("/api/projects/<pid>", methods=["DELETE"])
def api_delete_project(pid):
    state = load_state()
    if len(state["projects"]) <= 1: return err("Must keep at least one project")
    state["projects"] = [p for p in state["projects"] if p["id"] != pid]
    if state["activeProjectId"] == pid:
        save_active(state["projects"][0]["id"])
    save_projects(state["projects"])
    return ok()

@app.route("/api/active-project", methods=["POST"])
def api_set_active():
    state = load_state()
    pid   = (request.get_json() or {}).get("projectId")
    if not any(p["id"] == pid for p in state["projects"]): return err("Unknown project")
    save_active(pid)
    return ok()

# ── Phases (top-level) ────────────────────────────────────────────────────────
@app.route("/api/projects/<pid>/phases", methods=["POST"])
def api_add_phase(pid):
    state = load_state()
    proj  = get_project(state["projects"], pid)
    data  = request.get_json() or {}
    flat  = all_phases_flat(proj["phases"])
    last_y = max((p.get("y", 60) for p in flat), default=60)
    phase = new_phase(
        name  = data.get("name", "New Phase"),
        value = float(data.get("value", 2)),
        unit  = data.get("unit", "weeks"),
        x     = float(data.get("x", 60)),
        y     = float(data.get("y", last_y + 150)),
        required = data.get("required", {}),
    )
    proj["phases"].append(phase)
    src = data.get("fromPhaseId")
    if src:
        proj.setdefault("phaseEdges", []).append(
            {"id": "pe_" + uid(), "from": src, "to": phase["id"]})
    save_projects(state["projects"])
    return ok({"phase": phase})

@app.route("/api/projects/<pid>/phases/<phid>", methods=["PATCH"])
def api_update_phase(pid, phid):
    state = load_state()
    proj  = get_project(state["projects"], pid)
    phase, _ = find_phase(proj["phases"], phid)
    if not phase: return err("Phase not found", 404)
    data = request.get_json() or {}
    if "name"     in data: phase["name"]     = data["name"]
    if "value"    in data: phase["value"]    = float(data["value"])
    if "unit"     in data: phase["unit"]     = data["unit"]
    if "required" in data: phase["required"] = data["required"]
    if "expanded" in data: phase["expanded"] = bool(data["expanded"])
    if "x" in data and data["x"] is not None: phase["x"] = float(data["x"])
    if "y" in data and data["y"] is not None: phase["y"] = float(data["y"])
    # backward compat: if old 'weeks' key still coming in
    if "weeks" in data and "value" not in data:
        phase["value"] = float(data["weeks"]); phase["unit"] = "weeks"
    save_projects(state["projects"])
    return ok({"phase": phase})

@app.route("/api/projects/<pid>/phases/<phid>", methods=["DELETE"])
def api_delete_phase(pid, phid):
    state = load_state()
    proj  = get_project(state["projects"], pid)
    remove_phase_edges(proj, phid)
    # Delete from top-level or from any parent's children list
    ph, parent_list = find_phase(proj["phases"], phid)
    if ph is None: return err("Phase not found", 404)
    parent_list.remove(ph)
    save_projects(state["projects"])
    return ok()

@app.route("/api/projects/<pid>/phases/<phid>/move", methods=["POST"])
def api_move_phase(pid, phid):
    state     = load_state()
    proj      = get_project(state["projects"], pid)
    direction = (request.get_json() or {}).get("direction", 1)
    ph, lst   = find_phase(proj["phases"], phid)
    if ph is None: return err("Phase not found", 404)
    idx = lst.index(ph)
    to  = idx + direction
    if 0 <= to < len(lst): lst[idx], lst[to] = lst[to], lst[idx]
    save_projects(state["projects"])
    return ok({"phases": proj["phases"]})

# ── Subphases ─────────────────────────────────────────────────────────────────
@app.route("/api/projects/<pid>/phases/<phid>/children", methods=["POST"])
def api_add_subphase(pid, phid):
    state = load_state()
    proj  = get_project(state["projects"], pid)
    parent, _ = find_phase(proj["phases"], phid)
    if not parent: return err("Parent phase not found", 404)
    data  = request.get_json() or {}
    child = new_phase(
        name  = data.get("name", "New Subphase"),
        value = float(data.get("value", 1)),
        unit  = data.get("unit", "weeks"),
        x=0, y=0,
        required = data.get("required", {}),
    )
    parent.setdefault("children", []).append(child)
    parent["expanded"] = True
    save_projects(state["projects"])
    return ok({"phase": child})

# ── Phase edges ───────────────────────────────────────────────────────────────
@app.route("/api/projects/<pid>/phase-edges", methods=["POST"])
def api_add_phase_edge(pid):
    state = load_state()
    proj  = get_project(state["projects"], pid)
    data  = request.get_json() or {}
    frm, to = data.get("from"), data.get("to")
    if not frm or not to:  return err("from and to required")
    if frm == to:          return err("Cannot connect a phase to itself")
    edges = proj.setdefault("phaseEdges", [])
    if any(e["from"] == frm and e["to"] == to for e in edges):
        return ok({"edge": next(e for e in edges if e["from"]==frm and e["to"]==to)})
    edge = {"id": "pe_" + uid(), "from": frm, "to": to}
    edges.append(edge)
    save_projects(state["projects"])
    return ok({"edge": edge})

@app.route("/api/projects/<pid>/phase-edges/<eid>", methods=["DELETE"])
def api_delete_phase_edge(pid, eid):
    state = load_state()
    proj  = get_project(state["projects"], pid)
    proj["phaseEdges"] = [e for e in proj.get("phaseEdges", []) if e["id"] != eid]
    save_projects(state["projects"])
    return ok()

# ── Work packages ─────────────────────────────────────────────────────────────
@app.route("/api/projects/<pid>/phases/<phid>/work-packages", methods=["POST"])
def api_add_wp(pid, phid):
    state = load_state()
    proj  = get_project(state["projects"], pid)
    phase, _ = find_phase(proj["phases"], phid)
    if not phase: return err("Phase not found", 404)
    data = request.get_json() or {}
    wp = new_work_package(data.get("name", "New Work Package"))
    wp["description"]     = data.get("description", "")
    wp["deliverables"]    = data.get("deliverables", [])
    wp["assignedMembers"] = data.get("assignedMembers", [])
    wp["status"]          = data.get("status", "not_started")
    phase.setdefault("workPackages", []).append(wp)
    save_projects(state["projects"])
    return ok({"workPackage": wp})

@app.route("/api/projects/<pid>/work-packages/<wpid>", methods=["PATCH"])
def api_update_wp(pid, wpid):
    state = load_state()
    proj  = get_project(state["projects"], pid)
    # Search all phases and subphases
    for ph in all_phases_flat(proj["phases"]):
        wp = next((w for w in ph.get("workPackages", []) if w["id"] == wpid), None)
        if wp:
            data = request.get_json() or {}
            for f in ("name", "description", "deliverables", "assignedMembers", "status"):
                if f in data: wp[f] = data[f]
            save_projects(state["projects"])
            return ok({"workPackage": wp})
    return err("Work package not found", 404)

@app.route("/api/projects/<pid>/work-packages/<wpid>", methods=["DELETE"])
def api_delete_wp(pid, wpid):
    state = load_state()
    proj  = get_project(state["projects"], pid)
    for ph in all_phases_flat(proj["phases"]):
        before = len(ph.get("workPackages", []))
        ph["workPackages"] = [w for w in ph.get("workPackages", []) if w["id"] != wpid]
        if len(ph.get("workPackages", [])) < before:
            save_projects(state["projects"])
            return ok()
    return err("Work package not found", 404)

# ── Teams ─────────────────────────────────────────────────────────────────────
@app.route("/api/projects/<pid>/teams", methods=["POST"])
def api_add_team(pid):
    state   = load_state()
    proj    = get_project(state["projects"], pid)
    data    = request.get_json() or {}
    team_id = "team_" + uid()
    team = {"id": team_id, "name": data.get("name", "New Team"),
            "color": data.get("color", "#4a9eff"),
            "x": data.get("x", 30), "y": data.get("y", 40), "members": []}
    proj["teams"].append(team); proj["selTeamId"] = team_id
    save_projects(state["projects"])
    return ok({"team": team})

@app.route("/api/projects/<pid>/teams/<tid>", methods=["PATCH"])
def api_update_team(pid, tid):
    state = load_state()
    proj  = get_project(state["projects"], pid)
    team  = get_team(proj, tid)
    data  = request.get_json() or {}
    for f in ("name", "color", "x", "y"):
        if f in data: team[f] = data[f]
    save_projects(state["projects"])
    return ok({"team": team})

@app.route("/api/projects/<pid>/teams/<tid>", methods=["DELETE"])
def api_delete_team(pid, tid):
    state = load_state()
    proj  = get_project(state["projects"], pid)
    if len(proj["teams"]) <= 1: return err("Must keep at least one team")
    proj["teams"]       = [t for t in proj["teams"] if t["id"] != tid]
    proj["connections"] = [c for c in proj["connections"]
                           if c["from"] != tid and c["to"] != tid]
    if proj.get("selTeamId") == tid:
        proj["selTeamId"] = proj["teams"][0]["id"] if proj["teams"] else None
    save_projects(state["projects"])
    return ok()

# ── Members ───────────────────────────────────────────────────────────────────
@app.route("/api/projects/<pid>/teams/<tid>/members", methods=["POST"])
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
    team["members"].append(member); proj["selMemberId"] = mid
    save_projects(state["projects"])
    return ok({"member": member})

@app.route("/api/projects/<pid>/members/<mid>", methods=["PATCH"])
def api_update_member(pid, mid):
    state = load_state()
    proj  = get_project(state["projects"], pid)
    for team in proj["teams"]:
        member = next((m for m in team["members"] if m["id"] == mid), None)
        if member:
            data = request.get_json() or {}
            for f in ("name", "role"):
                if f in data: member[f] = data[f]
            if "skills" in data: member["skills"] = data["skills"]
            if "skill"  in data:
                sk = data["skill"]
                member.setdefault("skills", default_skills())
                member["skills"][sk["name"]][sk["type"]] = float(sk["value"])
            save_projects(state["projects"])
            return ok({"member": member})
    return err("Member not found", 404)

@app.route("/api/projects/<pid>/members/<mid>", methods=["DELETE"])
def api_delete_member(pid, mid):
    state = load_state()
    proj  = get_project(state["projects"], pid)
    for team in proj["teams"]:
        before = len(team["members"])
        team["members"] = [m for m in team["members"] if m["id"] != mid]
        if len(team["members"]) < before:
            if proj.get("selMemberId") == mid: proj["selMemberId"] = None
            save_projects(state["projects"])
            return ok()
    return err("Member not found", 404)

@app.route("/api/projects/<pid>/members/<mid>/move", methods=["POST"])
def api_move_member(pid, mid):
    state  = load_state()
    proj   = get_project(state["projects"], pid)
    to_tid = (request.get_json() or {}).get("teamId")
    member = None
    for team in proj["teams"]:
        idx = next((i for i, m in enumerate(team["members"]) if m["id"] == mid), None)
        if idx is not None:
            member = team["members"].pop(idx); break
    if not member: return err("Member not found", 404)
    get_team(proj, to_tid)["members"].append(member)
    proj["selTeamId"] = to_tid
    save_projects(state["projects"])
    return ok()

@app.route("/api/projects/<pid>/members/<mid>/unlink", methods=["POST"])
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

@app.route("/api/projects/<pid>/import-org", methods=["POST"])
def api_import_org(pid):
    state   = load_state()
    proj    = get_project(state["projects"], pid)
    data    = request.get_json() or {}
    team    = get_team(proj, data.get("teamId"))
    lookup  = build_org_lookup(state["globalOrg"])
    already = {m["orgId"] for t in proj["teams"] for m in t["members"] if m.get("orgId")}
    added   = 0
    for oid in data.get("orgIds", []):
        if oid not in already and oid in lookup:
            team["members"].append({"id": "m_" + uid(), "orgId": oid})
            already.add(oid); added += 1
    proj["selTeamId"] = data.get("teamId")
    save_projects(state["projects"])
    return ok({"added": added})

# ── Connections ───────────────────────────────────────────────────────────────
@app.route("/api/projects/<pid>/connections", methods=["POST"])
def api_add_connection(pid):
    state = load_state()
    proj  = get_project(state["projects"], pid)
    data  = request.get_json() or {}
    if data.get("from") == data.get("to"): return err("Cannot connect a team to itself")
    conn = {"id": "c_" + uid(), "from": data["from"], "to": data["to"],
            "label": data.get("label", ""), "type": data.get("type", "integration")}
    proj["connections"].append(conn)
    save_projects(state["projects"])
    return ok({"connection": conn})

@app.route("/api/projects/<pid>/connections/<cid>", methods=["DELETE"])
def api_delete_connection(pid, cid):
    state = load_state()
    proj  = get_project(state["projects"], pid)
    proj["connections"] = [c for c in proj["connections"] if c["id"] != cid]
    save_projects(state["projects"])
    return ok()

# ── Org hierarchy ─────────────────────────────────────────────────────────────
@app.route("/api/org", methods=["GET"])
def api_get_org():
    return jsonify(load_state()["globalOrg"])

@app.route("/api/org/nodes", methods=["POST"])
def api_add_org_node():
    state  = load_state()
    org    = state["globalOrg"]
    data   = request.get_json() or {}
    parent = find_node([org], data.get("parentId"))
    if not parent: return err("Parent not found", 404)
    ctype  = (ORG_CHILD_TYPES.get(parent["type"], []) or [None])[0]
    if not ctype: return err(f"Cannot add children to {parent['type']}")
    node = {"id": "n_" + uid(), "type": ctype,
            "name": f"New {ctype.capitalize()}", "expanded": True, "children": []}
    if ctype not in ("person", "org"): node["color"] = data.get("color", "#4a9eff")
    if ctype == "person":  node["role"] = ""; node["skills"] = default_skills()
    parent.setdefault("children", []).append(node)
    parent["expanded"] = True
    save_org(org)
    return ok({"node": node})

@app.route("/api/org/nodes/<nid>", methods=["PATCH"])
def api_update_org_node(nid):
    state = load_state()
    org   = state["globalOrg"]
    node  = find_node([org], nid)
    if not node: return err("Node not found", 404)
    data  = request.get_json() or {}
    for f in ("name", "role", "color", "expanded"):
        if f in data: node[f] = data[f]
    if "skills" in data: node["skills"] = data["skills"]
    if "skill"  in data:
        sk = data["skill"]
        node.setdefault("skills", default_skills())
        node["skills"][sk["name"]][sk["type"]] = float(sk["value"])
    save_org(org)
    return ok({"node": node})

@app.route("/api/org/nodes/<nid>", methods=["DELETE"])
def api_delete_org_node(nid):
    state = load_state()
    org   = state["globalOrg"]
    if nid == org["id"]: return err("Cannot delete root")
    target     = find_node([org], nid)
    person_ids = {p["id"] for p in flat_persons_under(target or {})}
    if not delete_node_from(org.get("children", []), nid):
        return err("Node not found", 404)
    for proj in state["projects"]:
        for team in proj["teams"]:
            team["members"] = [m for m in team["members"]
                               if m.get("orgId") not in person_ids]
    save_org(org)
    save_projects(state["projects"])
    return ok({"removedPersonIds": list(person_ids)})

@app.route("/api/org/toggle/<nid>", methods=["POST"])
def api_toggle_org_node(nid):
    state = load_state()
    org   = state["globalOrg"]
    node  = find_node([org], nid)
    if not node: return err("Node not found", 404)
    node["expanded"] = not node.get("expanded", True)
    save_org(org)
    return ok({"expanded": node["expanded"]})

# ── Meta & health ─────────────────────────────────────────────────────────────
@app.route("/api/meta")
def api_meta():
    return jsonify({"allSkills": ALL_SKILLS, "techSkills": TECH_SKILLS,
                    "persSkills": PERS_SKILLS, "orgTypeIcon": ORG_TYPE_ICON,
                    "orgTypeColor": ORG_TYPE_COLOR, "orgChildTypes": ORG_CHILD_TYPES,
                    "durationUnits": DURATION_UNITS, "wpStatuses": WP_STATUSES})

@app.route("/health")
def health():
    return jsonify({"status": "ok"})

# ── Export / Import ───────────────────────────────────────────────────────────
@app.route("/api/export")
def api_export():
    state = load_state()
    return jsonify({
        "version":    1,
        "exportedAt": __import__("datetime").datetime.utcnow().isoformat() + "Z",
        "globalOrg":  state["globalOrg"],
        "projects":   state["projects"],
    })

@app.route("/api/import", methods=["POST"])
def api_import():
    data     = request.get_json() or {}
    projects = data.get("projects")
    org      = data.get("globalOrg")
    if not projects or not isinstance(projects, list):
        return err("Invalid export file — missing projects array")
    state = load_state()
    # Merge: add imported projects, skip any with clashing IDs
    existing_ids = {p["id"] for p in state["projects"]}
    added = 0
    for proj in projects:
        if proj.get("id") in existing_ids:
            proj["id"] = "proj_" + uid()   # re-ID to avoid collision
        # Ensure new schema fields exist
        proj.setdefault("phaseEdges", [])
        for ph in all_phases_flat(proj.get("phases", [])):
            ph.setdefault("children", [])
            ph.setdefault("workPackages", [])
            ph.setdefault("expanded", True)
            if "value" not in ph:
                ph["value"] = float(ph.get("weeks", 2))
                ph["unit"]  = "weeks"
        state["projects"].append(proj)
        added += 1
    if org:
        state["globalOrg"] = org
        save_org(org)
    save_projects(state["projects"])
    if state["projects"]:
        save_active(state["projects"][-1]["id"])
    return ok({"imported": added})

# ── Connection patch ──────────────────────────────────────────────────────────
@app.route("/api/projects/<pid>/connections/<cid>", methods=["PATCH"])
def api_patch_connection(pid, cid):
    state = load_state()
    proj  = get_project(state["projects"], pid)
    conn  = next((c for c in proj["connections"] if c["id"] == cid), None)
    if not conn: return err("Connection not found", 404)
    data = request.get_json() or {}
    for f in ("label", "type"):
        if f in data: conn[f] = data[f]
    save_projects(state["projects"])
    return ok({"connection": conn})

# ── Business case (stored on the project dict) ────────────────────────────────
# Business case is patched via PATCH /api/projects/<pid> with {businessCase:{…}}
# Already handled in api_update_project — just need to allow businessCase field.

# ── Requirements ──────────────────────────────────────────────────────────────
@app.route("/api/projects/<pid>/requirements", methods=["POST"])
def api_add_req(pid):
    state = load_state()
    proj  = get_project(state["projects"], pid)
    data  = request.get_json() or {}
    req   = {"id": "req_" + uid(), "text": data.get("text", ""),
             "linkedWPs": data.get("linkedWPs", [])}
    proj.setdefault("requirements", []).append(req)
    save_projects(state["projects"])
    return ok({"requirement": req})

@app.route("/api/projects/<pid>/requirements/<rid>", methods=["PATCH"])
def api_update_req(pid, rid):
    state = load_state()
    proj  = get_project(state["projects"], pid)
    req   = next((r for r in proj.get("requirements", []) if r["id"] == rid), None)
    if not req: return err("Requirement not found", 404)
    data = request.get_json() or {}
    for f in ("text", "linkedWPs"):
        if f in data: req[f] = data[f]
    save_projects(state["projects"])
    return ok({"requirement": req})

@app.route("/api/projects/<pid>/requirements/<rid>", methods=["DELETE"])
def api_delete_req(pid, rid):
    state = load_state()
    proj  = get_project(state["projects"], pid)
    before = len(proj.get("requirements", []))
    proj["requirements"] = [r for r in proj.get("requirements", []) if r["id"] != rid]
    if len(proj.get("requirements", [])) == before:
        return err("Requirement not found", 404)
    save_projects(state["projects"])
    return ok()

if __name__ == "__main__":
    init_db()
    port  = int(os.environ.get("PORT", 8080))
    debug = os.environ.get("FLASK_ENV") == "development"
    print(f"\n  TeamIQ → http://localhost:{port}\n")
    app.run(host="0.0.0.0", port=port, debug=debug)
