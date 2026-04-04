"""
services/project_service.py
────────────────────────────
Business logic for project-level CRUD and import/export.
No Flask imports — all functions take/return plain dicts.
"""
import datetime
from models import uid, new_phase, all_phases_flat
from seed_data import seed_projects, seed_org


# ── Schema normalisation ──────────────────────────────────────────────────────

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


# ── CRUD ──────────────────────────────────────────────────────────────────────

def create_project(data: dict) -> dict:
    """Build and return a new project dict (not yet persisted)."""
    new_id  = "proj_" + uid()
    team_id = "team_" + uid()
    return {
        "id":          new_id,
        "name":        data.get("name", "New Project"),
        "color":       data.get("color", "#4a9eff"),
        "selTeamId":   team_id,
        "selMemberId": None,
        "orgMode":     "none",
        "teams": [{"id": team_id, "name": "Team 1", "color": "#4a9eff",
                   "x": 30, "y": 40, "members": []}],
        "connections": [],
        "phases":      [new_phase("Phase 1", 4, "weeks", 60, 60)],
        "phaseEdges":  [],
    }


def update_project(proj: dict, data: dict) -> dict:
    """Apply allowed field updates to a project in-place. Returns the project."""
    for f in ("name", "color", "selTeamId", "selMemberId", "orgMode",
              "businessCase", "startDate", "taskEdges"):
        if f in data:
            proj[f] = data[f]
    return proj


def delete_project(projects: list, pid: str, active_id: str) -> tuple[list, str]:
    """
    Remove project *pid* from *projects*.
    Returns (new_projects_list, new_active_id).
    Raises ValueError if pid not found or only one project remains.
    """
    if not any(p["id"] == pid for p in projects):
        raise KeyError(f"Project {pid} not found")
    if len(projects) <= 1:
        raise ValueError("Must keep at least one project")
    new_list = [p for p in projects if p["id"] != pid]
    new_active = active_id if active_id != pid else new_list[0]["id"]
    return new_list, new_active


# ── Import / Export ───────────────────────────────────────────────────────────

def build_export(state: dict) -> dict:
    """Return the full export payload dict."""
    return {
        "version":    1,
        "exportedAt": datetime.datetime.utcnow().isoformat() + "Z",
        "globalOrg":  state["globalOrg"],
        "projects":   state["projects"],
    }


def apply_import(state: dict, data: dict) -> tuple[list, dict | None, int]:
    """
    Merge imported projects (and optional org) into *state*.
    Returns (merged_projects, new_org_or_None, count_added).
    Raises ValueError for invalid payloads.
    """
    projects = data.get("projects")
    org      = data.get("globalOrg")
    if not projects or not isinstance(projects, list):
        raise ValueError("Invalid export file — missing projects array")

    existing_ids = {p["id"] for p in state["projects"]}
    merged = list(state["projects"])
    added  = 0
    for proj in normalize_projects(list(projects)):
        if proj.get("id") in existing_ids:
            proj["id"] = "proj_" + uid()
        merged.append(proj)
        added += 1

    return merged, org, added
