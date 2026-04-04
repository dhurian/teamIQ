"""
test_api_teams.py – integration tests for teams and members.
"""
import pytest


@pytest.fixture()
def second_team_id(client, proj_id):
    """Add a second team and return its id."""
    r = client.post(f"/api/projects/{proj_id}/teams",
                    json={"name": "Team Beta", "color": "#ff0000"})
    assert r.status_code == 200
    return r.get_json()["team"]["id"]


@pytest.fixture()
def member_id(client, proj_id, team_id):
    """Add a member to team_id and return member id."""
    r = client.post(f"/api/projects/{proj_id}/teams/{team_id}/members",
                    json={"name": "Test Person", "role": "Dev"})
    assert r.status_code == 200
    return r.get_json()["member"]["id"]


class TestAddTeam:
    def test_add_team_ok(self, client, proj_id):
        r = client.post(f"/api/projects/{proj_id}/teams",
                        json={"name": "Gamma", "color": "#abc123"})
        assert r.status_code == 200
        data = r.get_json()
        assert data["ok"] is True
        assert data["team"]["name"] == "Gamma"

    def test_add_team_id_prefixed(self, client, proj_id):
        r = client.post(f"/api/projects/{proj_id}/teams", json={"name": "T"})
        assert r.get_json()["team"]["id"].startswith("team_")

    def test_add_team_appears_in_state(self, project_state, proj_id, second_team_id):
        proj = project_state(proj_id)
        assert any(t["id"] == second_team_id for t in proj["teams"])

    def test_add_team_unknown_project_404(self, client):
        r = client.post("/api/projects/ghost/teams", json={"name": "X"})
        assert r.status_code == 404


class TestUpdateTeam:
    def test_patch_team_name(self, client, proj_id, team_id):
        r = client.patch(f"/api/projects/{proj_id}/teams/{team_id}",
                         json={"name": "Renamed"})
        assert r.status_code == 200
        assert r.get_json()["team"]["name"] == "Renamed"

    def test_patch_team_color(self, client, proj_id, team_id):
        r = client.patch(f"/api/projects/{proj_id}/teams/{team_id}",
                         json={"color": "#123456"})
        assert r.get_json()["team"]["color"] == "#123456"

    def test_patch_team_position(self, client, proj_id, team_id):
        r = client.patch(f"/api/projects/{proj_id}/teams/{team_id}",
                         json={"x": 150, "y": 200})
        t = r.get_json()["team"]
        assert t["x"] == 150
        assert t["y"] == 200

    def test_patch_team_persists(self, client, project_state, proj_id, team_id):
        client.patch(f"/api/projects/{proj_id}/teams/{team_id}",
                     json={"name": "Persisted"})
        proj = project_state(proj_id)
        team = next(t for t in proj["teams"] if t["id"] == team_id)
        assert team["name"] == "Persisted"

    def test_patch_unknown_team_404(self, client, proj_id):
        r = client.patch(f"/api/projects/{proj_id}/teams/ghost_team",
                         json={"name": "X"})
        assert r.status_code == 404


class TestDeleteTeam:
    def test_cannot_delete_last_team(self, client, proj_id):
        # Get all current teams and delete all but one
        state = client.get("/api/state").get_json()
        proj = next(p for p in state["projects"] if p["id"] == proj_id)
        all_team_ids = [t["id"] for t in proj["teams"]]
        # Delete until only one remains
        for tid in all_team_ids[1:]:
            client.delete(f"/api/projects/{proj_id}/teams/{tid}")
        # Attempting to delete the last team must be refused
        last_id = all_team_ids[0]
        r = client.delete(f"/api/projects/{proj_id}/teams/{last_id}")
        assert r.status_code == 400
        assert r.get_json()["ok"] is False

    def test_delete_second_team_ok(self, client, proj_id, second_team_id):
        r = client.delete(f"/api/projects/{proj_id}/teams/{second_team_id}")
        assert r.status_code == 200
        assert r.get_json()["ok"] is True

    def test_deleted_team_not_in_state(self, client, project_state, proj_id, second_team_id):
        client.delete(f"/api/projects/{proj_id}/teams/{second_team_id}")
        proj = project_state(proj_id)
        assert not any(t["id"] == second_team_id for t in proj["teams"])

    def test_delete_team_removes_connections(self, client, proj_id, team_id, second_team_id):
        # Create a connection between the two teams
        client.post(f"/api/projects/{proj_id}/connections",
                    json={"from": team_id, "to": second_team_id, "type": "integration"})
        client.delete(f"/api/projects/{proj_id}/teams/{second_team_id}")
        state = client.get("/api/state").get_json()
        proj = next(p for p in state["projects"] if p["id"] == proj_id)
        assert not any(
            c["from"] == second_team_id or c["to"] == second_team_id
            for c in proj.get("connections", [])
        )


class TestAddMember:
    def test_add_member_ok(self, client, proj_id, team_id):
        r = client.post(f"/api/projects/{proj_id}/teams/{team_id}/members",
                        json={"name": "Alice", "role": "Dev"})
        assert r.status_code == 200
        assert r.get_json()["member"]["name"] == "Alice"

    def test_add_member_id_prefixed(self, client, proj_id, team_id):
        r = client.post(f"/api/projects/{proj_id}/teams/{team_id}/members",
                        json={"name": "X"})
        assert r.get_json()["member"]["id"].startswith("m_")

    def test_add_member_has_skills(self, client, proj_id, team_id):
        r = client.post(f"/api/projects/{proj_id}/teams/{team_id}/members",
                        json={"name": "Bob", "role": "QA"})
        assert "skills" in r.get_json()["member"]

    def test_add_org_linked_member(self, client, proj_id, team_id):
        """Adding a member via orgId should store the orgId reference."""
        r = client.post(f"/api/projects/{proj_id}/teams/{team_id}/members",
                        json={"orgId": "p1"})
        assert r.status_code == 200
        assert r.get_json()["member"]["orgId"] == "p1"

    def test_add_member_unknown_team_404(self, client, proj_id):
        r = client.post(f"/api/projects/{proj_id}/teams/ghost_t/members",
                        json={"name": "X"})
        assert r.status_code == 404


class TestUpdateMember:
    def test_patch_member_name(self, client, proj_id, member_id):
        r = client.patch(f"/api/projects/{proj_id}/members/{member_id}",
                         json={"name": "Renamed"})
        assert r.status_code == 200
        assert r.get_json()["member"]["name"] == "Renamed"

    def test_patch_member_role(self, client, proj_id, member_id):
        r = client.patch(f"/api/projects/{proj_id}/members/{member_id}",
                         json={"role": "Architect"})
        assert r.get_json()["member"]["role"] == "Architect"

    def test_patch_member_skill(self, client, proj_id, member_id):
        r = client.patch(f"/api/projects/{proj_id}/members/{member_id}",
                         json={"skill": {"name": "Frontend", "type": "m", "value": 9.0}})
        assert r.status_code == 200
        assert r.get_json()["member"]["skills"]["Frontend"]["m"] == 9.0

    def test_patch_member_unknown_404(self, client, proj_id):
        r = client.patch(f"/api/projects/{proj_id}/members/ghost_m",
                         json={"name": "X"})
        assert r.status_code == 404


class TestDeleteMember:
    def test_delete_member_ok(self, client, proj_id, member_id):
        r = client.delete(f"/api/projects/{proj_id}/members/{member_id}")
        assert r.status_code == 200
        assert r.get_json()["ok"] is True

    def test_deleted_member_not_in_team(self, client, project_state, proj_id, team_id, member_id):
        client.delete(f"/api/projects/{proj_id}/members/{member_id}")
        proj = project_state(proj_id)
        team = next(t for t in proj["teams"] if t["id"] == team_id)
        assert not any(m["id"] == member_id for m in team["members"])

    def test_delete_member_unknown_404(self, client, proj_id):
        r = client.delete(f"/api/projects/{proj_id}/members/ghost_m")
        assert r.status_code == 404


class TestMoveMember:
    def test_move_member_to_other_team(self, client, proj_id, team_id,
                                       second_team_id, member_id):
        r = client.post(f"/api/projects/{proj_id}/members/{member_id}/move",
                        json={"teamId": second_team_id})
        assert r.status_code == 200
        state = client.get("/api/state").get_json()
        proj = next(p for p in state["projects"] if p["id"] == proj_id)
        orig = next(t for t in proj["teams"] if t["id"] == team_id)
        dest = next(t for t in proj["teams"] if t["id"] == second_team_id)
        assert not any(m["id"] == member_id for m in orig["members"])
        assert any(m["id"] == member_id for m in dest["members"])

    def test_move_member_unknown_404(self, client, proj_id, team_id):
        r = client.post(f"/api/projects/{proj_id}/members/ghost_m/move",
                        json={"teamId": team_id})
        assert r.status_code == 404


class TestConnections:
    def test_add_connection_ok(self, client, proj_id, team_id, second_team_id):
        r = client.post(f"/api/projects/{proj_id}/connections",
                        json={"from": team_id, "to": second_team_id,
                              "type": "integration", "label": "API"})
        assert r.status_code == 200
        conn = r.get_json()["connection"]
        assert conn["from"] == team_id
        assert conn["to"] == second_team_id
        assert conn["label"] == "API"

    def test_add_self_connection_rejected(self, client, proj_id, team_id):
        r = client.post(f"/api/projects/{proj_id}/connections",
                        json={"from": team_id, "to": team_id})
        assert r.status_code == 400

    def test_delete_connection(self, client, proj_id, team_id, second_team_id):
        conn_id = client.post(
            f"/api/projects/{proj_id}/connections",
            json={"from": team_id, "to": second_team_id}
        ).get_json()["connection"]["id"]
        r = client.delete(f"/api/projects/{proj_id}/connections/{conn_id}")
        assert r.status_code == 200
        state = client.get("/api/state").get_json()
        proj = next(p for p in state["projects"] if p["id"] == proj_id)
        assert not any(c["id"] == conn_id for c in proj.get("connections", []))
