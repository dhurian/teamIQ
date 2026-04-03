"""
test_api_org.py – integration tests for the global org hierarchy API.
"""
import pytest


class TestGetOrg:
    def test_get_org_200(self, client):
        r = client.get("/api/org")
        assert r.status_code == 200

    def test_org_has_root(self, client):
        org = client.get("/api/org").get_json()
        assert org["type"] == "org"
        assert "children" in org

    def test_org_has_seed_data(self, client):
        org = client.get("/api/org").get_json()
        assert len(org["children"]) > 0


class TestAddOrgNode:
    def _root_id(self, client):
        return client.get("/api/org").get_json()["id"]

    def _division_id(self, client):
        org = client.get("/api/org").get_json()
        return org["children"][0]["id"]

    def _department_id(self, client):
        org = client.get("/api/org").get_json()
        return org["children"][0]["children"][0]["id"]

    def _team_id(self, client):
        org = client.get("/api/org").get_json()
        return org["children"][0]["children"][0]["children"][0]["id"]

    def test_add_child_to_org_creates_division(self, client):
        root_id = self._root_id(client)
        r = client.post("/api/org/nodes", json={"parentId": root_id})
        assert r.status_code == 200
        node = r.get_json()["node"]
        assert node["type"] == "division"

    def test_add_child_to_division_creates_department(self, client):
        div_id = self._division_id(client)
        r = client.post("/api/org/nodes", json={"parentId": div_id})
        assert r.status_code == 200
        assert r.get_json()["node"]["type"] == "department"

    def test_add_child_to_department_creates_team(self, client):
        dep_id = self._department_id(client)
        r = client.post("/api/org/nodes", json={"parentId": dep_id})
        assert r.status_code == 200
        assert r.get_json()["node"]["type"] == "team"

    def test_add_child_to_team_creates_person(self, client):
        team_id = self._team_id(client)
        r = client.post("/api/org/nodes", json={"parentId": team_id})
        assert r.status_code == 200
        node = r.get_json()["node"]
        assert node["type"] == "person"
        assert "skills" in node

    def test_add_child_unknown_parent_404(self, client):
        r = client.post("/api/org/nodes", json={"parentId": "ghost_id"})
        assert r.status_code == 404

    def test_add_child_to_person_rejected(self, client):
        """Person nodes cannot have children."""
        org = client.get("/api/org").get_json()
        # Navigate to a person node
        person_id = org["children"][0]["children"][0]["children"][0]["children"][0]["id"]
        r = client.post("/api/org/nodes", json={"parentId": person_id})
        assert r.status_code == 400

    def test_new_node_has_id(self, client):
        root_id = self._root_id(client)
        r = client.post("/api/org/nodes", json={"parentId": root_id})
        node = r.get_json()["node"]
        assert "id" in node
        assert node["id"].startswith("n_")


class TestUpdateOrgNode:
    def _any_division_id(self, client):
        return client.get("/api/org").get_json()["children"][0]["id"]

    def _any_person_id(self, client):
        org = client.get("/api/org").get_json()
        return org["children"][0]["children"][0]["children"][0]["children"][0]["id"]

    def test_patch_name(self, client):
        div_id = self._any_division_id(client)
        r = client.patch(f"/api/org/nodes/{div_id}", json={"name": "Renamed Div"})
        assert r.status_code == 200
        assert r.get_json()["node"]["name"] == "Renamed Div"

    def test_patch_color(self, client):
        div_id = self._any_division_id(client)
        r = client.patch(f"/api/org/nodes/{div_id}", json={"color": "#ff00ff"})
        assert r.get_json()["node"]["color"] == "#ff00ff"

    def test_patch_person_skill_m(self, client):
        pid = self._any_person_id(client)
        r = client.patch(f"/api/org/nodes/{pid}",
                         json={"skill": {"name": "Backend", "type": "m", "value": 8.5}})
        assert r.status_code == 200
        assert r.get_json()["node"]["skills"]["Backend"]["m"] == 8.5

    def test_patch_person_skill_s(self, client):
        pid = self._any_person_id(client)
        r = client.patch(f"/api/org/nodes/{pid}",
                         json={"skill": {"name": "Backend", "type": "s", "value": 0.5}})
        assert r.status_code == 200
        assert r.get_json()["node"]["skills"]["Backend"]["s"] == 0.5

    def test_patch_expanded(self, client):
        div_id = self._any_division_id(client)
        r = client.patch(f"/api/org/nodes/{div_id}", json={"expanded": False})
        assert r.get_json()["node"]["expanded"] is False

    def test_patch_unknown_node_404(self, client):
        r = client.patch("/api/org/nodes/ghost_node", json={"name": "X"})
        assert r.status_code == 404

    def test_patch_persists(self, client):
        div_id = self._any_division_id(client)
        client.patch(f"/api/org/nodes/{div_id}", json={"name": "Saved"})
        org = client.get("/api/org").get_json()
        div = next(c for c in org["children"] if c["id"] == div_id)
        assert div["name"] == "Saved"


class TestDeleteOrgNode:
    def test_delete_node_ok(self, client):
        # Add a fresh node then delete it
        root_id = client.get("/api/org").get_json()["id"]
        new_id = client.post("/api/org/nodes",
                             json={"parentId": root_id}).get_json()["node"]["id"]
        r = client.delete(f"/api/org/nodes/{new_id}")
        assert r.status_code == 200
        assert r.get_json()["ok"] is True

    def test_deleted_node_not_in_org(self, client):
        root_id = client.get("/api/org").get_json()["id"]
        new_id = client.post("/api/org/nodes",
                             json={"parentId": root_id}).get_json()["node"]["id"]
        client.delete(f"/api/org/nodes/{new_id}")
        org = client.get("/api/org").get_json()
        child_ids = [c["id"] for c in org["children"]]
        assert new_id not in child_ids

    def test_delete_unknown_node_404(self, client):
        r = client.delete("/api/org/nodes/ghost_node")
        assert r.status_code == 404
