"""
blueprints/shared.py
────────────────────
Shared state helpers, response factories, and guard functions used by every
blueprint. Importing from one place keeps each blueprint file short and avoids
circular imports.
"""
from flask import jsonify, abort
from db import db_get, db_set
from seed_data import seed_projects, seed_org

# Re-export normalize_projects from the service layer for backward compatibility.
from services.project_service import normalize_projects  # noqa: F401


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


# ── Response factories ────────────────────────────────────────────────────────

def ok(data=None):
    return jsonify({"ok": True, **(data or {})})


def err(msg, code=400):
    return jsonify({"ok": False, "error": msg}), code
