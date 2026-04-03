"""
blueprints/work_packages.py
────────────────────────────
Work-package CRUD and move (inside any phase or subphase).
Thin HTTP wrapper — all logic lives in services/work_package_service.py.
"""
from flask import Blueprint, request
from blueprints.shared import (
    load_state, save_projects, get_project, ok, err,
)
from services import work_package_service

bp = Blueprint("work_packages", __name__)


@bp.route("/api/projects/<pid>/phases/<phid>/work-packages", methods=["POST"])
def api_add_wp(pid, phid):
    state = load_state()
    proj  = get_project(state["projects"], pid)
    data  = request.get_json() or {}
    try:
        wp = work_package_service.create_wp(proj, phid, data)
    except KeyError as e:
        return err(str(e), 404)
    save_projects(state["projects"])
    return ok({"workPackage": wp})


@bp.route("/api/projects/<pid>/work-packages/<wpid>", methods=["PATCH"])
def api_update_wp(pid, wpid):
    state = load_state()
    proj  = get_project(state["projects"], pid)
    data  = request.get_json() or {}
    try:
        wp = work_package_service.update_wp(proj, wpid, data)
    except KeyError as e:
        return err(str(e), 404)
    save_projects(state["projects"])
    return ok({"workPackage": wp})


@bp.route("/api/projects/<pid>/work-packages/<wpid>", methods=["DELETE"])
def api_delete_wp(pid, wpid):
    state = load_state()
    proj  = get_project(state["projects"], pid)
    try:
        work_package_service.delete_wp(proj, wpid)
    except KeyError as e:
        return err(str(e), 404)
    save_projects(state["projects"])
    return ok()


@bp.route("/api/projects/<pid>/work-packages/<wpid>/move", methods=["POST"])
def api_move_wp(pid, wpid):
    state     = load_state()
    proj      = get_project(state["projects"], pid)
    direction = int((request.get_json() or {}).get("direction", 1))
    try:
        wps = work_package_service.move_wp(proj, wpid, direction)
    except KeyError as e:
        return err(str(e), 404)
    save_projects(state["projects"])
    return ok({"workPackages": wps})
