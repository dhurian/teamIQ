"""
test_api_phases.py – integration tests for phases, subphases, and phase edges.
"""
import pytest


# ── SECTION: TestAddPhase ────────────────────────────────────────────────────

class TestAddPhase:
    def test_add_phase_ok(self, client, proj_id):
        r = client.post(f"/api/projects/{proj_id}/phases",
                        json={"name": "Alpha", "value": 3, "unit": "weeks"})
        assert r.status_code == 200
        data = r.get_json()
        assert data["ok"] is True
        assert data["phase"]["name"] == "Alpha"

    def test_add_phase_id_prefixed(self, client, proj_id):
        r = client.post(f"/api/projects/{proj_id}/phases", json={"name": "P"})
        assert r.get_json()["phase"]["id"].startswith("ph_")

    def test_add_phase_appears_in_state(self, client, proj_id):
        r = client.post(f"/api/projects/{proj_id}/phases", json={"name": "NewPh"})
        new_id = r.get_json()["phase"]["id"]
        state = client.get("/api/state").get_json()
        proj = next(p for p in state["projects"] if p["id"] == proj_id)
        ids = [ph["id"] for ph in proj["phases"]]
        assert new_id in ids

    def test_add_phase_from_another_creates_edge(self, client, proj_id, phase_id):
        r = client.post(f"/api/projects/{proj_id}/phases",
                        json={"name": "B", "fromPhaseId": phase_id})
        state = client.get("/api/state").get_json()
        proj = next(p for p in state["projects"] if p["id"] == proj_id)
        edges = proj.get("phaseEdges", [])
        new_id = r.get_json()["phase"]["id"]
        assert any(e["from"] == phase_id and e["to"] == new_id for e in edges)

    def test_add_phase_unknown_project_404(self, client):
        r = client.post("/api/projects/ghost/phases", json={"name": "X"})
        assert r.status_code == 404


# ── SECTION: TestUpdatePhase ─────────────────────────────────────────────────

class TestUpdatePhase:
    def test_patch_name(self, client, proj_id, phase_id):
        r = client.patch(f"/api/projects/{proj_id}/phases/{phase_id}",
                         json={"name": "Renamed"})
        assert r.status_code == 200
        assert r.get_json()["phase"]["name"] == "Renamed"

    def test_patch_value_unit(self, client, proj_id, phase_id):
        r = client.patch(f"/api/projects/{proj_id}/phases/{phase_id}",
                         json={"value": 6, "unit": "months"})
        ph = r.get_json()["phase"]
        assert ph["value"] == 6
        assert ph["unit"] == "months"

    def test_patch_startDateOverride(self, client, proj_id, phase_id):
        r = client.patch(f"/api/projects/{proj_id}/phases/{phase_id}",
                         json={"startDateOverride": "2025-06-01"})
        assert r.get_json()["phase"]["startDateOverride"] == "2025-06-01"

    def test_patch_endDateOverride(self, client, proj_id, phase_id):
        r = client.patch(f"/api/projects/{proj_id}/phases/{phase_id}",
                         json={"endDateOverride": "2025-09-30"})
        assert r.get_json()["phase"]["endDateOverride"] == "2025-09-30"

    def test_patch_phase_persists(self, client, proj_id, phase_id):
        client.patch(f"/api/projects/{proj_id}/phases/{phase_id}",
                     json={"name": "Saved"})
        state = client.get("/api/state").get_json()
        proj = next(p for p in state["projects"] if p["id"] == proj_id)
        ph = next(p for p in proj["phases"] if p["id"] == phase_id)
        assert ph["name"] == "Saved"

    def test_patch_unknown_phase_404(self, client, proj_id):
        r = client.patch(f"/api/projects/{proj_id}/phases/ghost_ph",
                         json={"name": "X"})
        assert r.status_code == 404

    def test_patch_required_skills(self, client, proj_id, phase_id):
        r = client.patch(f"/api/projects/{proj_id}/phases/{phase_id}",
                         json={"required": {"Frontend": 8}})
        assert r.get_json()["phase"]["required"]["Frontend"] == 8

    def test_legacy_weeks_field_accepted(self, client, proj_id, phase_id):
        """Backward-compat: sending 'weeks' without 'value' should still work."""
        r = client.patch(f"/api/projects/{proj_id}/phases/{phase_id}",
                         json={"weeks": 5})
        assert r.status_code == 200
        assert r.get_json()["phase"]["value"] == 5.0


# ── SECTION: TestDeletePhase ─────────────────────────────────────────────────

class TestDeletePhase:
    def test_delete_top_level_phase(self, client, proj_id):
        # Add a phase then delete it
        pid_new = client.post(f"/api/projects/{proj_id}/phases",
                              json={"name": "Temp"}).get_json()["phase"]["id"]
        r = client.delete(f"/api/projects/{proj_id}/phases/{pid_new}")
        assert r.status_code == 200
        assert r.get_json()["ok"] is True

    def test_deleted_phase_not_in_state(self, client, proj_id):
        pid_new = client.post(f"/api/projects/{proj_id}/phases",
                              json={"name": "Temp2"}).get_json()["phase"]["id"]
        client.delete(f"/api/projects/{proj_id}/phases/{pid_new}")
        state = client.get("/api/state").get_json()
        proj = next(p for p in state["projects"] if p["id"] == proj_id)
        all_ids = [p["id"] for p in proj["phases"]]
        assert pid_new not in all_ids

    def test_delete_phase_removes_edges(self, client, proj_id, phase_id):
        """Deleting a phase must also remove any phaseEdges referencing it."""
        r = client.post(f"/api/projects/{proj_id}/phases",
                        json={"name": "B", "fromPhaseId": phase_id})
        new_id = r.get_json()["phase"]["id"]
        client.delete(f"/api/projects/{proj_id}/phases/{new_id}")
        state = client.get("/api/state").get_json()
        proj = next(p for p in state["projects"] if p["id"] == proj_id)
        edges = proj.get("phaseEdges", [])
        assert not any(e["to"] == new_id or e["from"] == new_id for e in edges)

    def test_delete_unknown_phase_404(self, client, proj_id):
        r = client.delete(f"/api/projects/{proj_id}/phases/ghost_ph")
        assert r.status_code == 404


# ── SECTION: TestSubphases ───────────────────────────────────────────────────

class TestSubphases:
    def test_add_subphase_ok(self, client, proj_id, phase_id):
        r = client.post(f"/api/projects/{proj_id}/phases/{phase_id}/children",
                        json={"name": "Sub1", "value": 1, "unit": "weeks"})
        assert r.status_code == 200
        assert r.get_json()["phase"]["name"] == "Sub1"

    def test_subphase_appears_in_parent_children(self, client, proj_id, phase_id):
        r = client.post(f"/api/projects/{proj_id}/phases/{phase_id}/children",
                        json={"name": "SubX"})
        sub_id = r.get_json()["phase"]["id"]
        state = client.get("/api/state").get_json()
        proj = next(p for p in state["projects"] if p["id"] == proj_id)
        parent = next(p for p in proj["phases"] if p["id"] == phase_id)
        child_ids = [c["id"] for c in parent.get("children", [])]
        assert sub_id in child_ids

    def test_delete_subphase_no_crash(self, client, proj_id, phase_id):
        """Regression: deleting a subphase was crashing with KeyError: 'id'."""
        r = client.post(f"/api/projects/{proj_id}/phases/{phase_id}/children",
                        json={"name": "SubDel"})
        sub_id = r.get_json()["phase"]["id"]
        r2 = client.delete(f"/api/projects/{proj_id}/phases/{sub_id}")
        assert r2.status_code == 200
        assert r2.get_json()["ok"] is True

    def test_deleted_subphase_not_in_parent(self, client, proj_id, phase_id):
        r = client.post(f"/api/projects/{proj_id}/phases/{phase_id}/children",
                        json={"name": "SubGone"})
        sub_id = r.get_json()["phase"]["id"]
        client.delete(f"/api/projects/{proj_id}/phases/{sub_id}")
        state = client.get("/api/state").get_json()
        proj = next(p for p in state["projects"] if p["id"] == proj_id)
        parent = next(p for p in proj["phases"] if p["id"] == phase_id)
        child_ids = [c["id"] for c in parent.get("children", [])]
        assert sub_id not in child_ids

    def test_patch_subphase_by_id(self, client, proj_id, phase_id):
        r = client.post(f"/api/projects/{proj_id}/phases/{phase_id}/children",
                        json={"name": "SubPatch"})
        sub_id = r.get_json()["phase"]["id"]
        r2 = client.patch(f"/api/projects/{proj_id}/phases/{sub_id}",
                          json={"name": "SubPatched"})
        assert r2.status_code == 200
        assert r2.get_json()["phase"]["name"] == "SubPatched"

    def test_subphase_unknown_parent_404(self, client, proj_id):
        r = client.post(f"/api/projects/{proj_id}/phases/ghost/children",
                        json={"name": "X"})
        assert r.status_code == 404  # err("Parent phase not found", 404)


# ── SECTION: TestMovePhase ───────────────────────────────────────────────────

class TestMovePhase:
    def test_move_phase_down(self, client, proj_id):
        state = client.get("/api/state").get_json()
        proj = next(p for p in state["projects"] if p["id"] == proj_id)
        if len(proj["phases"]) < 2:
            client.post(f"/api/projects/{proj_id}/phases", json={"name": "Extra"})
            state = client.get("/api/state").get_json()
            proj = next(p for p in state["projects"] if p["id"] == proj_id)
        first_id = proj["phases"][0]["id"]
        r = client.post(f"/api/projects/{proj_id}/phases/{first_id}/move",
                        json={"direction": 1})
        assert r.status_code == 200
        new_phases = r.get_json()["phases"]
        assert new_phases[1]["id"] == first_id

    def test_move_phase_up(self, client, proj_id):
        state = client.get("/api/state").get_json()
        proj = next(p for p in state["projects"] if p["id"] == proj_id)
        if len(proj["phases"]) < 2:
            client.post(f"/api/projects/{proj_id}/phases", json={"name": "Extra"})
            state = client.get("/api/state").get_json()
            proj = next(p for p in state["projects"] if p["id"] == proj_id)
        last_id = proj["phases"][-1]["id"]
        r = client.post(f"/api/projects/{proj_id}/phases/{last_id}/move",
                        json={"direction": -1})
        assert r.status_code == 200
        new_phases = r.get_json()["phases"]
        assert new_phases[-2]["id"] == last_id


# ── SECTION: TestPhaseEdges ──────────────────────────────────────────────────

class TestPhaseEdges:
    def test_add_edge_ok(self, client, proj_id, phase_id):
        r2 = client.post(f"/api/projects/{proj_id}/phases", json={"name": "B"})
        b_id = r2.get_json()["phase"]["id"]
        r = client.post(f"/api/projects/{proj_id}/phase-edges",
                        json={"from": phase_id, "to": b_id})
        assert r.status_code == 200
        assert r.get_json()["edge"]["from"] == phase_id
        assert r.get_json()["edge"]["to"] == b_id

    def test_add_self_loop_rejected(self, client, proj_id, phase_id):
        r = client.post(f"/api/projects/{proj_id}/phase-edges",
                        json={"from": phase_id, "to": phase_id})
        assert r.status_code == 400

    def test_duplicate_edge_idempotent(self, client, proj_id, phase_id):
        r2 = client.post(f"/api/projects/{proj_id}/phases", json={"name": "C"})
        c_id = r2.get_json()["phase"]["id"]
        client.post(f"/api/projects/{proj_id}/phase-edges",
                    json={"from": phase_id, "to": c_id})
        r = client.post(f"/api/projects/{proj_id}/phase-edges",
                        json={"from": phase_id, "to": c_id})
        assert r.status_code == 200
        # Only one edge in state
        state = client.get("/api/state").get_json()
        proj = next(p for p in state["projects"] if p["id"] == proj_id)
        count = sum(1 for e in proj["phaseEdges"]
                    if e["from"] == phase_id and e["to"] == c_id)
        assert count == 1

    def test_delete_edge(self, client, proj_id, phase_id):
        r2 = client.post(f"/api/projects/{proj_id}/phases", json={"name": "D"})
        d_id = r2.get_json()["phase"]["id"]
        edge = client.post(f"/api/projects/{proj_id}/phase-edges",
                           json={"from": phase_id, "to": d_id}).get_json()["edge"]
        r = client.delete(f"/api/projects/{proj_id}/phase-edges/{edge['id']}")
        assert r.status_code == 200
        state = client.get("/api/state").get_json()
        proj = next(p for p in state["projects"] if p["id"] == proj_id)
        assert not any(e["id"] == edge["id"] for e in proj.get("phaseEdges", []))
