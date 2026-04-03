"""
blueprints/shared.py
────────────────────
Shared state helpers, response factories, and guard functions used by every
blueprint. Importing from one place keeps each blueprint file short and avoids
circular imports.
"""
from flask import jsonify, abort
from db import db_get, db_set
from models import (
    all_phases_flat, seed_projects, seed_org, uid,
)


# ── State persistence ─────────────────────────────────────────────────────────

def normalize_projects(projects):
    """Upgrade older saved project data to the current schema."""
    if not isinstance(projects, list):
        return seed_projects()

    for proj in projects:
        proj.setdefault("phaseEdges", [])
        proj.setdefault("taskEdges", [])
        proj.setdefault("teams", [])
        proj.setdefault("connections", [])
        proj.setdefault("businessCase", {})
        proj.setdefault("startDate", None)

        for ph in all_phases_flat(proj.get("phases", [])):
            ph.setdefault("children", [])
            ph.setdefault("workPackages", [])
            ph.setdefault("expanded", True)
            ph.setdefault("required", {})
            ph.setdefault("startDateOverride", None)
            ph.setdefault("endDateOverride", None)

            if "value" not in ph:
                ph["value"] = float(ph.get("weeks", 2))
            ph.setdefault("unit", "weeks")

            for wp in ph.get("workPackages", []):
                wp.setdefault("description", "")
                wp.setdefault("deliverables", "")
                wp.setdefault("assignedMembers", [])
                wp.setdefault("status", "not_started")
                wp.setdefault("value", 1)
                wp.setdefault("unit", "weeks")
                wp.setdefault("startDateOverride", None)
                wp.setdefault("endDateOverride", None)

    return projects


def load_state():
    projects = db_get("projects")
    org      = db_get("globalOrg")
    active   = db_get("activeProjectId")

    if projects is None:
        projects = seed_projects()
    else:
        projects = normalize_projects(projects)
    db_set("projects", projects)

    if org is None:
        org = seed_org()
        db_set("globalOrg", org)

    project_ids = {p.get("id") for p in projects}
    if active is None or active not in project_ids:
        active = projects[0]["id"] if projects else None
        if active is not None:
            db_set("activeProjectId", active)

    return {"activeProjectId": active, "globalOrg": org, "projects": projects}


def save_projects(p): db_set("projects", p)
def save_org(o):      db_set("globalOrg", o)
def save_active(pid): db_set("activeProjectId", pid)


# ── Guard helpers ─────────────────────────────────────────────────────────────

def get_project(projects, pid):
    p = next((p for p in projects if p["id"] == pid), None)
    if not p:
        abort(404)
    return p


def get_team(project, tid):
    t = next((t for t in project["teams"] if t["id"] == tid), None)
    if not t:
        abort(404)
    return t


# ── Response factories ────────────────────────────────────────────────────────

def ok(data=None):
    return jsonify({"ok": True, **(data or {})})


def err(msg, code=400):
    return jsonify({"ok": False, "error": msg}), code
