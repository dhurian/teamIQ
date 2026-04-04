"""
Unit tests for services/org_service.py.
No Flask or DB — pure Python dict manipulation.
"""
import pytest
from models import seed_org, new_phase
from services import org_service


# ── Fixtures ──────────────────────────────────────────────────────────────────

def _org():
    """Minimal org: root → division → department → team → person."""
    return {
        "id": "root", "type": "org", "name": "Corp", "expanded": True,
        "children": [{
            "id": "div1", "type": "division", "name": "Engineering",
            "color": "#fff", "expanded": True,
            "children": [{
                "id": "dep1", "type": "department", "name": "Backend",
                "color": "#fff", "expanded": True,
                "children": [{
                    "id": "t1", "type": "team", "name": "Backend Squad",
                    "color": "#fff", "expanded": True,
                    "children": [{
                        "id": "p1", "type": "person", "name": "Alice",
                        "role": "Dev", "skills": {}, "children": [],
                    }],
                }],
            }],
        }],
    }

def _projects_with_member(org_id="p1"):
    return [{
        "id": "proj_t",
        "teams": [{"id": "team_t", "members": [{"id": "m1", "orgId": org_id}]}],
    }]


# ── create_org_node ───────────────────────────────────────────────────────────

class TestCreateOrgNode:
    def test_adds_child_to_division(self):
        org  = _org()
        node = org_service.create_org_node(org, {"parentId": "div1"})
        div  = org["children"][0]
        assert node in div["children"]
        assert node["type"] == "department"

    def test_adds_person_to_team(self):
        org  = _org()
        node = org_service.create_org_node(org, {"parentId": "t1"})
        team = org["children"][0]["children"][0]["children"][0]
        assert node in team["children"]
        assert node["type"] == "person"
        assert "skills" in node
        assert "role" in node

    def test_sets_parent_expanded(self):
        org = _org()
        org["children"][0]["expanded"] = False
        org_service.create_org_node(org, {"parentId": "div1"})
        assert org["children"][0]["expanded"] is True

    def test_raises_on_missing_parent(self):
        org = _org()
        with pytest.raises(KeyError):
            org_service.create_org_node(org, {"parentId": "nonexistent"})

    def test_raises_on_person_parent(self):
        org = _org()
        with pytest.raises(ValueError):
            org_service.create_org_node(org, {"parentId": "p1"})


# ── update_org_node ───────────────────────────────────────────────────────────

class TestUpdateOrgNode:
    def test_updates_name(self):
        org  = _org()
        node = org_service.update_org_node(org, "p1", {"name": "Bob"})
        assert node["name"] == "Bob"

    def test_updates_skill(self):
        org  = _org()
        # Ensure node has skills dict
        from models import default_skills
        org["children"][0]["children"][0]["children"][0]["children"][0]["skills"] = default_skills()
        org_service.update_org_node(org, "p1",
            {"skill": {"name": "Frontend", "type": "m", "value": "8"}})
        from models import find_node
        p = find_node([org], "p1")
        assert p["skills"]["Frontend"]["m"] == 8.0

    def test_raises_on_missing(self):
        org = _org()
        with pytest.raises(KeyError):
            org_service.update_org_node(org, "n_missing", {"name": "X"})


# ── delete_org_node ───────────────────────────────────────────────────────────

class TestDeleteOrgNode:
    def test_removes_node(self):
        org      = _org()
        projects = []
        org_service.delete_org_node(org, "t1", projects)
        from models import find_node
        assert find_node([org], "t1") is None

    def test_cascades_to_project_members(self):
        org      = _org()
        projects = _projects_with_member("p1")
        org_service.delete_org_node(org, "p1", projects)
        assert projects[0]["teams"][0]["members"] == []

    def test_cascade_removes_all_persons_under_subtree(self):
        org      = _org()
        projects = _projects_with_member("p1")
        # Delete the team (which contains p1)
        removed  = org_service.delete_org_node(org, "t1", projects)
        assert "p1" in removed
        assert projects[0]["teams"][0]["members"] == []

    def test_raises_on_root(self):
        org = _org()
        with pytest.raises(ValueError):
            org_service.delete_org_node(org, "root", [])

    def test_raises_on_missing(self):
        org = _org()
        with pytest.raises(KeyError):
            org_service.delete_org_node(org, "n_missing", [])

    def test_returns_removed_person_ids(self):
        org      = _org()
        projects = []
        removed  = org_service.delete_org_node(org, "p1", projects)
        assert "p1" in removed


# ── toggle_org_node ───────────────────────────────────────────────────────────

class TestToggleOrgNode:
    def test_toggles_to_false(self):
        org  = _org()
        val  = org_service.toggle_org_node(org, "div1")
        assert val is False

    def test_toggles_back_to_true(self):
        org = _org()
        org_service.toggle_org_node(org, "div1")   # → False
        val = org_service.toggle_org_node(org, "div1")   # → True
        assert val is True

    def test_raises_on_missing(self):
        org = _org()
        with pytest.raises(KeyError):
            org_service.toggle_org_node(org, "n_missing")
