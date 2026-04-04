"""
blueprints/shared.py
────────────────────
Shared state helpers, response factories, and guard functions used by every
blueprint. Importing from one place keeps each blueprint file short and avoids
circular imports.

State is now persisted through the repository layer (repositories/) which
reads and writes normalized SQLite tables instead of JSON blobs.
"""
from flask import jsonify, abort
from models import seed_projects, seed_org
from repositories import project_repo, org_repo

# Re-export normalize_projects from the service layer for backward compatibility.
from services.project_service import normalize_projects  # noqa: F401


# ── State persistence ─────────────────────────────────────────────────────────

def load_state() -> dict:
    projects = project_repo.load_all()
    org      = org_repo.load()

    if not projects:
        projects = seed_projects()
        project_repo.save_all(projects)

    if org is None:
        org = seed_org()
        org_repo.save(org)

    active = project_repo.get_active()
    ids    = {p["id"] for p in projects}
    if active not in ids:
        active = projects[0]["id"]
        project_repo.set_active(active)

    return {"activeProjectId": active, "globalOrg": org, "projects": projects}


def save_projects(projects: list) -> None:
    project_repo.save_all(projects)


def save_org(org: dict) -> None:
    org_repo.save(org)


def save_active(pid: str) -> None:
    project_repo.set_active(pid)


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
