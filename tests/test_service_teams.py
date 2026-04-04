"""
Unit tests for services/team_service.py.
No Flask or DB — pure Python dict manipulation.
"""
import pytest
from models import new_phase, seed_org, default_skills
from services import team_service


# ── Fixtures ──────────────────────────────────────────────────────────────────

def _proj():
    return {
        "id":          "proj_t",
        "selTeamId":   "team_1",
        "selMemberId": None,
        "teams": [
            {"id": "team_1", "name": "Alpha", "color": "#4a9eff",
             "x": 30, "y": 40, "members": []},
            {"id": "team_2", "name": "Beta",  "color": "#1fb885",
             "x": 200, "y": 40, "members": []},
        ],
        "connections": [],
        "phases": [new_phase("P1", 2, "weeks", 60, 60)],
    }


# ── create_team ───────────────────────────────────────────────────────────────

class TestCreateTeam:
    def test_appends_team(self):
        proj = _proj()
        t    = team_service.create_team(proj, {"name": "Gamma"})
        assert t in proj["teams"]
        assert t["name"] == "Gamma"

    def test_sets_sel_team_id(self):
        proj = _proj()
        t    = team_service.create_team(proj, {})
        assert proj["selTeamId"] == t["id"]

    def test_default_values(self):
        proj = _proj()
        t    = team_service.create_team(proj, {})
        assert t["color"]   == "#4a9eff"
        assert t["members"] == []


# ── update_team ───────────────────────────────────────────────────────────────

class TestUpdateTeam:
    def test_updates_fields(self):
        proj = _proj()
        t    = team_service.update_team(proj, "team_1", {"name": "Renamed", "x": 99})
        assert t["name"] == "Renamed"
        assert t["x"]    == 99

    def test_raises_on_missing(self):
        proj = _proj()
        with pytest.raises(KeyError):
            team_service.update_team(proj, "team_x", {})


# ── delete_team ───────────────────────────────────────────────────────────────

class TestDeleteTeam:
    def test_removes_team(self):
        proj = _proj()
        team_service.delete_team(proj, "team_2")
        assert not any(t["id"] == "team_2" for t in proj["teams"])

    def test_removes_associated_connections(self):
        proj = _proj()
        proj["connections"] = [
            {"id": "c1", "from": "team_1", "to": "team_2"},
            {"id": "c2", "from": "team_2", "to": "team_1"},
            {"id": "c3", "from": "team_1", "to": "team_1"},
        ]
        team_service.delete_team(proj, "team_2")
        assert all(c["id"] == "c3" for c in proj["connections"])

    def test_updates_sel_team_id_when_active_deleted(self):
        proj = _proj()
        proj["selTeamId"] = "team_2"
        team_service.delete_team(proj, "team_2")
        assert proj["selTeamId"] == "team_1"

    def test_raises_value_error_if_last_team(self):
        proj = _proj()
        team_service.delete_team(proj, "team_2")
        with pytest.raises(ValueError):
            team_service.delete_team(proj, "team_1")

    def test_raises_key_error_if_not_found(self):
        proj = _proj()
        with pytest.raises(KeyError):
            team_service.delete_team(proj, "team_x")


# ── create_member ─────────────────────────────────────────────────────────────

class TestCreateMember:
    def test_adds_standalone_member(self):
        proj = _proj()
        m    = team_service.create_member(proj, "team_1", {"name": "Alice", "role": "Dev"})
        assert m in proj["teams"][0]["members"]
        assert m["name"] == "Alice"
        assert "skills"  in m

    def test_adds_org_linked_member(self):
        proj = _proj()
        m    = team_service.create_member(proj, "team_1", {"orgId": "p1"})
        assert m["orgId"] == "p1"
        assert "name" not in m

    def test_sets_sel_member_id(self):
        proj = _proj()
        m    = team_service.create_member(proj, "team_1", {})
        assert proj["selMemberId"] == m["id"]

    def test_raises_on_missing_team(self):
        proj = _proj()
        with pytest.raises(KeyError):
            team_service.create_member(proj, "team_x", {})


# ── update_member ─────────────────────────────────────────────────────────────

class TestUpdateMember:
    def test_updates_name_and_role(self):
        proj = _proj()
        m    = team_service.create_member(proj, "team_1", {"name": "Alice"})
        ret  = team_service.update_member(proj, m["id"], {"name": "Bob", "role": "QA"})
        assert ret["name"] == "Bob"
        assert ret["role"] == "QA"

    def test_updates_individual_skill(self):
        proj = _proj()
        m    = team_service.create_member(proj, "team_1", {"name": "Alice"})
        team_service.update_member(proj, m["id"], {"skill": {"name": "Frontend", "type": "m", "value": "9"}})
        assert m["skills"]["Frontend"]["m"] == 9.0

    def test_raises_on_missing(self):
        proj = _proj()
        with pytest.raises(KeyError):
            team_service.update_member(proj, "m_missing", {})


# ── delete_member ─────────────────────────────────────────────────────────────

class TestDeleteMember:
    def test_removes_member(self):
        proj = _proj()
        m    = team_service.create_member(proj, "team_1", {})
        team_service.delete_member(proj, m["id"])
        assert proj["teams"][0]["members"] == []

    def test_clears_sel_member_id(self):
        proj = _proj()
        m    = team_service.create_member(proj, "team_1", {})
        proj["selMemberId"] = m["id"]
        team_service.delete_member(proj, m["id"])
        assert proj["selMemberId"] is None

    def test_raises_on_missing(self):
        proj = _proj()
        with pytest.raises(KeyError):
            team_service.delete_member(proj, "m_missing")


# ── move_member ───────────────────────────────────────────────────────────────

class TestMoveMember:
    def test_moves_to_other_team(self):
        proj = _proj()
        m    = team_service.create_member(proj, "team_1", {"name": "Alice"})
        team_service.move_member(proj, m["id"], "team_2")
        assert proj["teams"][0]["members"] == []
        assert m in proj["teams"][1]["members"]

    def test_updates_sel_team_id(self):
        proj = _proj()
        m    = team_service.create_member(proj, "team_1", {})
        team_service.move_member(proj, m["id"], "team_2")
        assert proj["selTeamId"] == "team_2"

    def test_raises_on_missing_member(self):
        proj = _proj()
        with pytest.raises(KeyError):
            team_service.move_member(proj, "m_missing", "team_2")

    def test_raises_on_missing_destination(self):
        proj = _proj()
        m    = team_service.create_member(proj, "team_1", {})
        with pytest.raises(KeyError):
            team_service.move_member(proj, m["id"], "team_x")


# ── unlink_member ─────────────────────────────────────────────────────────────

class TestUnlinkMember:
    def test_copies_from_org(self):
        proj = _proj()
        org  = seed_org()
        # p1 is "Alice Chen" in seed org
        m    = team_service.create_member(proj, "team_1", {"orgId": "p1"})
        ret  = team_service.unlink_member(proj, m["id"], org)
        assert "orgId" not in ret
        assert ret["name"] == "Alice Chen"
        assert "skills" in ret

    def test_raises_on_missing_member(self):
        proj = _proj()
        with pytest.raises(KeyError):
            team_service.unlink_member(proj, "m_missing", seed_org())

    def test_raises_when_not_linked(self):
        proj = _proj()
        m    = team_service.create_member(proj, "team_1", {"name": "Standalone"})
        with pytest.raises(KeyError):
            team_service.unlink_member(proj, m["id"], seed_org())


# ── import_org_members ────────────────────────────────────────────────────────

class TestImportOrgMembers:
    def test_imports_known_ids(self):
        proj  = _proj()
        org   = seed_org()
        added = team_service.import_org_members(proj, "team_1", ["p1", "p2"], org)
        assert added == 2
        assert len(proj["teams"][0]["members"]) == 2

    def test_skips_unknown_ids(self):
        proj  = _proj()
        org   = seed_org()
        added = team_service.import_org_members(proj, "team_1", ["p_unknown"], org)
        assert added == 0

    def test_skips_duplicates(self):
        proj  = _proj()
        org   = seed_org()
        team_service.import_org_members(proj, "team_1", ["p1"], org)
        added = team_service.import_org_members(proj, "team_1", ["p1"], org)
        assert added == 0
        assert len(proj["teams"][0]["members"]) == 1

    def test_raises_on_missing_team(self):
        proj = _proj()
        with pytest.raises(KeyError):
            team_service.import_org_members(proj, "team_x", ["p1"], seed_org())


# ── add_connection ────────────────────────────────────────────────────────────

class TestAddConnection:
    def test_adds_connection(self):
        proj = _proj()
        conn = team_service.add_connection(proj, {"from": "team_1", "to": "team_2"})
        assert conn in proj["connections"]
        assert conn["from"] == "team_1"
        assert conn["to"]   == "team_2"

    def test_default_type(self):
        proj = _proj()
        conn = team_service.add_connection(proj, {"from": "team_1", "to": "team_2"})
        assert conn["type"] == "integration"

    def test_raises_on_self_connection(self):
        proj = _proj()
        with pytest.raises(ValueError):
            team_service.add_connection(proj, {"from": "team_1", "to": "team_1"})


# ── update_connection ─────────────────────────────────────────────────────────

class TestUpdateConnection:
    def test_updates_label_and_type(self):
        proj = _proj()
        conn = team_service.add_connection(proj, {"from": "team_1", "to": "team_2"})
        ret  = team_service.update_connection(proj, conn["id"], {"label": "API", "type": "dependency"})
        assert ret["label"] == "API"
        assert ret["type"]  == "dependency"

    def test_raises_on_missing(self):
        proj = _proj()
        with pytest.raises(KeyError):
            team_service.update_connection(proj, "c_missing", {})


# ── delete_connection ─────────────────────────────────────────────────────────

class TestDeleteConnection:
    def test_removes_connection(self):
        proj = _proj()
        conn = team_service.add_connection(proj, {"from": "team_1", "to": "team_2"})
        team_service.delete_connection(proj, conn["id"])
        assert proj["connections"] == []

    def test_silent_on_missing(self):
        proj = _proj()
        team_service.delete_connection(proj, "c_nonexistent")  # no error
