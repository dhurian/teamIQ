"""
test_api_workpackages.py – integration tests for work package API endpoints.
"""
import pytest


@pytest.fixture()
def wp_id(client, proj_id, phase_id):
    """Create a fresh work package and return its id."""
    r = client.post(f"/api/projects/{proj_id}/phases/{phase_id}/work-packages",
                    json={"name": "Test WP"})
    assert r.status_code == 200
    return r.get_json()["workPackage"]["id"]


class TestAddWorkPackage:
    def test_add_wp_ok(self, client, proj_id, phase_id):
        r = client.post(f"/api/projects/{proj_id}/phases/{phase_id}/work-packages",
                        json={"name": "My WP"})
        assert r.status_code == 200
        data = r.get_json()
        assert data["ok"] is True
        assert data["workPackage"]["name"] == "My WP"

    def test_add_wp_id_prefixed(self, client, proj_id, phase_id):
        r = client.post(f"/api/projects/{proj_id}/phases/{phase_id}/work-packages",
                        json={"name": "X"})
        assert r.get_json()["workPackage"]["id"].startswith("wp_")

    def test_add_wp_default_status(self, client, proj_id, phase_id):
        r = client.post(f"/api/projects/{proj_id}/phases/{phase_id}/work-packages",
                        json={"name": "X"})
        assert r.get_json()["workPackage"]["status"] == "not_started"

    def test_add_wp_custom_status(self, client, proj_id, phase_id):
        r = client.post(f"/api/projects/{proj_id}/phases/{phase_id}/work-packages",
                        json={"name": "X", "status": "in_progress"})
        assert r.get_json()["workPackage"]["status"] == "in_progress"

    def test_add_wp_to_subphase(self, client, proj_id, phase_id):
        sub = client.post(f"/api/projects/{proj_id}/phases/{phase_id}/children",
                          json={"name": "Sub"}).get_json()["phase"]["id"]
        r = client.post(f"/api/projects/{proj_id}/phases/{sub}/work-packages",
                        json={"name": "WP in Sub"})
        assert r.status_code == 200

    def test_add_wp_unknown_phase_404(self, client, proj_id):
        r = client.post(f"/api/projects/{proj_id}/phases/ghost_ph/work-packages",
                        json={"name": "X"})
        assert r.status_code == 404

    def test_add_wp_appears_in_phase(self, client, proj_id, phase_id, wp_id):
        state = client.get("/api/state").get_json()
        proj = next(p for p in state["projects"] if p["id"] == proj_id)
        phase = next(p for p in proj["phases"] if p["id"] == phase_id)
        assert any(w["id"] == wp_id for w in phase.get("workPackages", []))


class TestUpdateWorkPackage:
    def test_patch_name(self, client, proj_id, wp_id):
        r = client.patch(f"/api/projects/{proj_id}/work-packages/{wp_id}",
                         json={"name": "Renamed WP"})
        assert r.status_code == 200
        assert r.get_json()["workPackage"]["name"] == "Renamed WP"

    def test_patch_status(self, client, proj_id, wp_id):
        r = client.patch(f"/api/projects/{proj_id}/work-packages/{wp_id}",
                         json={"status": "complete"})
        assert r.get_json()["workPackage"]["status"] == "complete"

    def test_patch_description(self, client, proj_id, wp_id):
        r = client.patch(f"/api/projects/{proj_id}/work-packages/{wp_id}",
                         json={"description": "Some details"})
        assert r.get_json()["workPackage"]["description"] == "Some details"

    def test_patch_deliverables(self, client, proj_id, wp_id):
        r = client.patch(f"/api/projects/{proj_id}/work-packages/{wp_id}",
                         json={"deliverables": ["D1", "D2"]})
        assert r.get_json()["workPackage"]["deliverables"] == ["D1", "D2"]

    def test_patch_value_unit(self, client, proj_id, wp_id):
        r = client.patch(f"/api/projects/{proj_id}/work-packages/{wp_id}",
                         json={"value": 3, "unit": "days"})
        wp = r.get_json()["workPackage"]
        assert wp["value"] == 3
        assert wp["unit"] == "days"

    def test_patch_startDateOverride(self, client, proj_id, wp_id):
        r = client.patch(f"/api/projects/{proj_id}/work-packages/{wp_id}",
                         json={"startDateOverride": "2025-03-01"})
        assert r.get_json()["workPackage"]["startDateOverride"] == "2025-03-01"

    def test_patch_endDateOverride(self, client, proj_id, wp_id):
        r = client.patch(f"/api/projects/{proj_id}/work-packages/{wp_id}",
                         json={"endDateOverride": "2025-03-31"})
        assert r.get_json()["workPackage"]["endDateOverride"] == "2025-03-31"

    def test_patch_persists(self, client, proj_id, phase_id, wp_id):
        client.patch(f"/api/projects/{proj_id}/work-packages/{wp_id}",
                     json={"name": "Saved WP"})
        state = client.get("/api/state").get_json()
        proj = next(p for p in state["projects"] if p["id"] == proj_id)
        phase = next(p for p in proj["phases"] if p["id"] == phase_id)
        wp = next(w for w in phase["workPackages"] if w["id"] == wp_id)
        assert wp["name"] == "Saved WP"

    def test_patch_unknown_wp_404(self, client, proj_id):
        r = client.patch(f"/api/projects/{proj_id}/work-packages/ghost_wp",
                         json={"name": "X"})
        assert r.status_code == 404


class TestDeleteWorkPackage:
    def test_delete_wp_ok(self, client, proj_id, wp_id):
        r = client.delete(f"/api/projects/{proj_id}/work-packages/{wp_id}")
        assert r.status_code == 200
        assert r.get_json()["ok"] is True

    def test_deleted_wp_not_in_phase(self, client, proj_id, phase_id, wp_id):
        client.delete(f"/api/projects/{proj_id}/work-packages/{wp_id}")
        state = client.get("/api/state").get_json()
        proj = next(p for p in state["projects"] if p["id"] == proj_id)
        phase = next(p for p in proj["phases"] if p["id"] == phase_id)
        assert not any(w["id"] == wp_id for w in phase.get("workPackages", []))

    def test_delete_unknown_wp_404(self, client, proj_id):
        r = client.delete(f"/api/projects/{proj_id}/work-packages/ghost_wp")
        assert r.status_code == 404

    def test_delete_wp_in_subphase(self, client, proj_id, phase_id):
        """WPs inside a subphase must also be deletable."""
        sub_id = client.post(
            f"/api/projects/{proj_id}/phases/{phase_id}/children",
            json={"name": "Sub"}
        ).get_json()["phase"]["id"]
        wp_id = client.post(
            f"/api/projects/{proj_id}/phases/{sub_id}/work-packages",
            json={"name": "SubWP"}
        ).get_json()["workPackage"]["id"]
        r = client.delete(f"/api/projects/{proj_id}/work-packages/{wp_id}")
        assert r.status_code == 200


class TestMoveWorkPackage:
    def test_move_wp_down(self, client, proj_id, phase_id):
        w1 = client.post(f"/api/projects/{proj_id}/phases/{phase_id}/work-packages",
                         json={"name": "WP1"}).get_json()["workPackage"]["id"]
        w2 = client.post(f"/api/projects/{proj_id}/phases/{phase_id}/work-packages",
                         json={"name": "WP2"}).get_json()["workPackage"]["id"]
        r = client.post(f"/api/projects/{proj_id}/work-packages/{w1}/move",
                        json={"direction": 1})
        assert r.status_code == 200
        wps = r.get_json()["workPackages"]
        # w1 should now be after w2 (or at least position changed)
        ids = [w["id"] for w in wps]
        assert ids.index(w2) < ids.index(w1)

    def test_move_wp_unknown_404(self, client, proj_id):
        r = client.post(f"/api/projects/{proj_id}/work-packages/ghost/move",
                        json={"direction": 1})
        assert r.status_code == 404
