"""
Unit tests for services/project_service.py.
No Flask or DB — pure Python dict manipulation.
"""
import pytest
from models import new_phase, seed_projects, seed_org
from services import project_service


# ── Fixtures ──────────────────────────────────────────────────────────────────

def _two_projects():
    return [
        {"id": "proj_a", "name": "Alpha", "color": "#fff",
         "phases": [], "teams": [], "connections": [],
         "phaseEdges": [], "taskEdges": [], "businessCase": {}, "startDate": None},
        {"id": "proj_b", "name": "Beta", "color": "#000",
         "phases": [], "teams": [], "connections": [],
         "phaseEdges": [], "taskEdges": [], "businessCase": {}, "startDate": None},
    ]

def _state(projects=None, org=None):
    return {
        "projects":        projects or _two_projects(),
        "globalOrg":       org or seed_org(),
        "activeProjectId": "proj_a",
    }


# ── normalize_projects ────────────────────────────────────────────────────────

class TestNormalizeProjects:
    def test_non_list_returns_seed(self):
        result = project_service.normalize_projects(None)
        assert isinstance(result, list)
        assert len(result) > 0

    def test_adds_missing_project_keys(self):
        projects = [{"id": "p1", "phases": []}]
        result = project_service.normalize_projects(projects)
        p = result[0]
        assert "phaseEdges"   in p
        assert "taskEdges"    in p
        assert "teams"        in p
        assert "connections"  in p
        assert "businessCase" in p
        assert "startDate"    in p

    def test_adds_missing_phase_keys(self):
        ph = {"id": "ph1", "name": "P", "weeks": 3, "workPackages": []}
        projects = [{"id": "p1", "phases": [ph]}]
        project_service.normalize_projects(projects)
        assert ph["value"] == 3.0
        assert ph["unit"] == "weeks"
        assert ph["expanded"] is True
        assert ph["children"] == []

    def test_adds_missing_wp_keys(self):
        wp = {"id": "wp1", "name": "W"}
        ph = {"id": "ph1", "name": "P", "value": 1, "unit": "weeks",
              "workPackages": [wp], "children": []}
        projects = [{"id": "p1", "phases": [ph]}]
        project_service.normalize_projects(projects)
        assert wp["description"]    == ""
        assert wp["status"]         == "not_started"
        assert wp["assignedMembers"] == []

    def test_preserves_existing_value_field(self):
        ph = {"id": "ph1", "name": "P", "value": 5, "unit": "days",
              "weeks": 99, "workPackages": [], "children": []}
        projects = [{"id": "p1", "phases": [ph]}]
        project_service.normalize_projects(projects)
        assert ph["value"] == 5   # must NOT overwrite with weeks


# ── create_project ────────────────────────────────────────────────────────────

class TestCreateProject:
    def test_defaults(self):
        proj = project_service.create_project({})
        assert proj["name"] == "New Project"
        assert proj["color"] == "#4a9eff"
        assert len(proj["teams"]) == 1
        assert len(proj["phases"]) == 1
        assert proj["selMemberId"] is None

    def test_custom_name_color(self):
        proj = project_service.create_project({"name": "X", "color": "#123456"})
        assert proj["name"]  == "X"
        assert proj["color"] == "#123456"

    def test_ids_are_unique(self):
        a = project_service.create_project({})
        b = project_service.create_project({})
        assert a["id"]                != b["id"]
        assert a["teams"][0]["id"]    != b["teams"][0]["id"]

    def test_team_matches_selteamid(self):
        proj = project_service.create_project({})
        assert proj["teams"][0]["id"] == proj["selTeamId"]


# ── update_project ────────────────────────────────────────────────────────────

class TestUpdateProject:
    def test_updates_allowed_fields(self):
        proj = {"id": "p1", "name": "Old", "color": "#fff"}
        project_service.update_project(proj, {"name": "New", "color": "#000"})
        assert proj["name"]  == "New"
        assert proj["color"] == "#000"

    def test_ignores_unknown_fields(self):
        proj = {"id": "p1", "name": "Old"}
        project_service.update_project(proj, {"hacked": True})
        assert "hacked" not in proj

    def test_returns_project(self):
        proj = {"id": "p1"}
        result = project_service.update_project(proj, {"name": "X"})
        assert result is proj


# ── delete_project ────────────────────────────────────────────────────────────

class TestDeleteProject:
    def test_removes_project(self):
        projects = _two_projects()
        new_list, _ = project_service.delete_project(projects, "proj_a", "proj_a")
        assert len(new_list) == 1
        assert new_list[0]["id"] == "proj_b"

    def test_active_switches_when_deleted(self):
        projects = _two_projects()
        _, new_active = project_service.delete_project(projects, "proj_a", "proj_a")
        assert new_active == "proj_b"

    def test_active_unchanged_when_other_deleted(self):
        projects = _two_projects()
        _, new_active = project_service.delete_project(projects, "proj_b", "proj_a")
        assert new_active == "proj_a"

    def test_raises_key_error_if_not_found(self):
        projects = _two_projects()
        with pytest.raises(KeyError):
            project_service.delete_project(projects, "proj_x", "proj_a")

    def test_raises_value_error_if_last_project(self):
        projects = [_two_projects()[0]]
        with pytest.raises(ValueError):
            project_service.delete_project(projects, "proj_a", "proj_a")


# ── build_export ──────────────────────────────────────────────────────────────

class TestBuildExport:
    def test_structure(self):
        state  = _state()
        result = project_service.build_export(state)
        assert result["version"]   == 1
        assert "exportedAt"        in result
        assert result["projects"]  is state["projects"]
        assert result["globalOrg"] is state["globalOrg"]


# ── apply_import ──────────────────────────────────────────────────────────────

class TestApplyImport:
    def test_merges_new_projects(self):
        state = _state()
        data  = {"projects": [{"id": "proj_new", "phases": [], "teams": []}]}
        merged, org, added = project_service.apply_import(state, data)
        assert added == 1
        assert any(p["id"] == "proj_new" for p in merged)

    def test_deduplicates_existing_id(self):
        state = _state()
        data  = {"projects": [{"id": "proj_a", "phases": [], "teams": []}]}
        merged, _, added = project_service.apply_import(state, data)
        ids = [p["id"] for p in merged]
        assert ids.count("proj_a") == 1   # original untouched; import got new id

    def test_raises_on_missing_projects(self):
        state = _state()
        with pytest.raises(ValueError):
            project_service.apply_import(state, {})

    def test_raises_on_non_list_projects(self):
        state = _state()
        with pytest.raises(ValueError):
            project_service.apply_import(state, {"projects": "bad"})

    def test_imports_org(self):
        state = _state()
        new_org = {"id": "root2", "type": "org", "name": "New Org", "children": []}
        data  = {"projects": [{"id": "proj_z", "phases": [], "teams": []}],
                 "globalOrg": new_org}
        _, org, _ = project_service.apply_import(state, data)
        assert org is new_org

    def test_org_none_when_not_in_payload(self):
        state = _state()
        data  = {"projects": [{"id": "proj_z", "phases": [], "teams": []}]}
        _, org, _ = project_service.apply_import(state, data)
        assert org is None
