"""
test_api_projects.py – integration tests for project-level API endpoints.
"""
import pytest


class TestState:
    def test_get_state_200(self, client):
        r = client.get("/api/state")
        assert r.status_code == 200

    def test_state_has_projects(self, client):
        data = client.get("/api/state").get_json()
        assert isinstance(data["projects"], list)
        assert len(data["projects"]) >= 1

    def test_state_has_active_project(self, client):
        data = client.get("/api/state").get_json()
        assert data["activeProjectId"] is not None

    def test_state_active_project_exists_in_list(self, client):
        data = client.get("/api/state").get_json()
        ids = {p["id"] for p in data["projects"]}
        assert data["activeProjectId"] in ids

    def test_state_has_globalOrg(self, client):
        data = client.get("/api/state").get_json()
        assert "globalOrg" in data
        assert data["globalOrg"]["type"] == "org"


class TestGetProjects:
    def test_get_projects_200(self, client):
        r = client.get("/api/projects")
        assert r.status_code == 200
        assert isinstance(r.get_json(), list)


class TestAddProject:
    def test_add_project_201_ok(self, client):
        r = client.post("/api/projects", json={"name": "Test Project", "color": "#ff0000"})
        assert r.status_code == 200
        data = r.get_json()
        assert data["ok"] is True
        assert data["project"]["name"] == "Test Project"
        assert data["project"]["color"] == "#ff0000"

    def test_add_project_has_id(self, client):
        r = client.post("/api/projects", json={"name": "P"})
        pid = r.get_json()["project"]["id"]
        assert pid.startswith("proj_")

    def test_add_project_appears_in_list(self, client):
        r = client.post("/api/projects", json={"name": "NewOne"})
        pid = r.get_json()["project"]["id"]
        projects = client.get("/api/projects").get_json()
        ids = {p["id"] for p in projects}
        assert pid in ids

    def test_add_project_default_name(self, client):
        r = client.post("/api/projects", json={})
        assert r.get_json()["project"]["name"] == "New Project"

    def test_add_project_has_default_team(self, client):
        r = client.post("/api/projects", json={"name": "T"})
        proj = r.get_json()["project"]
        assert len(proj["teams"]) == 1

    def test_add_project_has_default_phase(self, client):
        r = client.post("/api/projects", json={"name": "T"})
        proj = r.get_json()["project"]
        assert len(proj["phases"]) >= 1


class TestUpdateProject:
    def test_patch_name(self, client, proj_id):
        r = client.patch(f"/api/projects/{proj_id}", json={"name": "Renamed"})
        assert r.status_code == 200
        assert r.get_json()["project"]["name"] == "Renamed"

    def test_patch_color(self, client, proj_id):
        r = client.patch(f"/api/projects/{proj_id}", json={"color": "#aabbcc"})
        assert r.get_json()["project"]["color"] == "#aabbcc"

    def test_patch_startDate(self, client, proj_id):
        r = client.patch(f"/api/projects/{proj_id}", json={"startDate": "2025-01-01"})
        assert r.get_json()["project"]["startDate"] == "2025-01-01"

    def test_patch_unknown_project_404(self, client):
        r = client.patch("/api/projects/ghost_id", json={"name": "X"})
        assert r.status_code == 404

    def test_patch_persists(self, client, proj_id):
        client.patch(f"/api/projects/{proj_id}", json={"name": "Persisted"})
        state = client.get("/api/state").get_json()
        proj = next(p for p in state["projects"] if p["id"] == proj_id)
        assert proj["name"] == "Persisted"


class TestDeleteProject:
    def test_cannot_delete_last_project(self, client, proj_id):
        # Seed has >=2 projects; delete until only one remains
        state = client.get("/api/state").get_json()
        all_ids = [p["id"] for p in state["projects"]]
        # Delete all but one
        for pid in all_ids[1:]:
            client.delete(f"/api/projects/{pid}")
        # Now try to delete the last one
        r = client.delete(f"/api/projects/{all_ids[0]}")
        assert r.status_code == 400
        assert r.get_json()["ok"] is False

    def test_delete_project_removes_from_list(self, client):
        r = client.post("/api/projects", json={"name": "ToDelete"})
        pid = r.get_json()["project"]["id"]
        client.delete(f"/api/projects/{pid}")
        projects = client.get("/api/projects").get_json()
        assert all(p["id"] != pid for p in projects)

    def test_delete_unknown_project_404(self, client):
        r = client.delete("/api/projects/ghost_id")
        assert r.status_code == 404


class TestSetActiveProject:
    def test_set_active_valid(self, client):
        state = client.get("/api/state").get_json()
        other = next(p for p in state["projects"] if p["id"] != state["activeProjectId"])
        r = client.post("/api/active-project", json={"projectId": other["id"]})
        assert r.status_code == 200
        assert r.get_json()["ok"] is True

    def test_set_active_invalid(self, client):
        r = client.post("/api/active-project", json={"projectId": "ghost"})
        assert r.status_code == 400
        assert r.get_json()["ok"] is False

    def test_set_active_persists(self, client):
        state = client.get("/api/state").get_json()
        other = next(p for p in state["projects"] if p["id"] != state["activeProjectId"])
        client.post("/api/active-project", json={"projectId": other["id"]})
        new_state = client.get("/api/state").get_json()
        assert new_state["activeProjectId"] == other["id"]


class TestErrorHandlers:
    def test_404_returns_json(self, client):
        r = client.get("/api/nonexistent_endpoint")
        assert r.status_code == 404
        data = r.get_json()
        assert data["ok"] is False

    def test_405_returns_json(self, client):
        r = client.put("/api/projects")   # PUT not allowed
        assert r.status_code == 405
        data = r.get_json()
        assert data["ok"] is False
