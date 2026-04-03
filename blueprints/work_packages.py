"""
blueprints/work_packages.py
────────────────────────────
Work-package CRUD and move (inside any phase or subphase).
"""
from flask import Blueprint, request
from models import new_work_package, find_phase, all_phases_flat
from blueprints.shared import (
    load_state, save_projects, get_project, ok, err,
)

bp = Blueprint("work_packages", __name__)


@bp.route("/api/projects/<pid>/phases/<phid>/work-packages", methods=["POST"])
def api_add_wp(pid, phid):
    state = load_state()
    proj  = get_project(state["projects"], pid)
    phase, _ = find_phase(proj["phases"], phid)
    if not phase:
        return err("Phase not found", 404)
    data = request.get_json() or {}
    wp = new_work_package(data.get("name", "New Work Package"))
    wp["description"]     = data.get("description", "")
    wp["deliverables"]    = data.get("deliverables", [])
    wp["assignedMembers"] = data.get("assignedMembers", [])
    wp["status"]          = data.get("status", "not_started")
    phase.setdefault("workPackages", []).append(wp)
    save_projects(state["projects"])
    return ok({"workPackage": wp})


@bp.route("/api/projects/<pid>/work-packages/<wpid>", methods=["PATCH"])
def api_update_wp(pid, wpid):
    state = load_state()
    proj  = get_project(state["projects"], pid)
    for ph in all_phases_flat(proj["phases"]):
        wp = next((w for w in ph.get("workPackages", []) if w["id"] == wpid), None)
        if wp:
            data = request.get_json() or {}
            for f in ("name", "description", "deliverables", "assignedMembers",
                      "status", "value", "unit", "startDateOverride", "endDateOverride"):
                if f in data:
                    wp[f] = data[f]
            save_projects(state["projects"])
            return ok({"workPackage": wp})
    return err("Work package not found", 404)


@bp.route("/api/projects/<pid>/work-packages/<wpid>", methods=["DELETE"])
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


@bp.route("/api/projects/<pid>/work-packages/<wpid>/move", methods=["POST"])
def api_move_wp(pid, wpid):
    state     = load_state()
    proj      = get_project(state["projects"], pid)
    direction = int((request.get_json() or {}).get("direction", 1))
    for ph in all_phases_flat(proj["phases"]):
        lst = ph.get("workPackages", [])
        wp  = next((w for w in lst if w["id"] == wpid), None)
        if wp:
            idx = lst.index(wp)
            to  = idx + direction
            if 0 <= to < len(lst):
                lst[idx], lst[to] = lst[to], lst[idx]
            save_projects(state["projects"])
            return ok({"workPackages": lst})
    return err("Work package not found", 404)
