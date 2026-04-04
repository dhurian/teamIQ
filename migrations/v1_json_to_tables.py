"""
migrations/v1_json_to_tables.py
─────────────────────────────────
One-time migration: reads the legacy JSON blobs from the `store` table and
populates the normalized tables introduced in Phase 0.

Safe to call on every startup — it checks first whether data already exists
in the normalized tables and is a no-op if so.
"""
from db import db_get
from repositories import project_repo, org_repo


def run() -> bool:
    """
    Migrate legacy data if needed.
    Returns True if a migration was performed, False if already done or no data.
    """
    # Already migrated — normalized tables have content
    if project_repo.load_all():
        return False

    projects = db_get("projects")
    if not projects:
        # Nothing in the old store either; first-ever run, nothing to migrate
        return False

    # Normalize old schema before writing
    from services.project_service import normalize_projects
    from models import seed_org

    projects = normalize_projects(projects)
    org      = db_get("globalOrg") or seed_org()
    active   = db_get("activeProjectId")

    project_repo.save_all(projects)
    org_repo.save(org)

    if active and any(p["id"] == active for p in projects):
        project_repo.set_active(active)
    elif projects:
        project_repo.set_active(projects[0]["id"])

    return True
