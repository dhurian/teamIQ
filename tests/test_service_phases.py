"""
Unit tests for services/phase_service.py.
No Flask or DB — pure Python dict manipulation.
"""
import pytest
from models import new_phase, uid
from services import phase_service


# ── Fixtures ──────────────────────────────────────────────────────────────────

def _proj():
    ph = new_phase("Phase 1", 2, "weeks", 60, 60)
    return {
        "id":         "proj_t",
        "phases":     [ph],
        "phaseEdges": [],
    }


# ── create_phase ──────────────────────────────────────────────────────────────

class TestCreatePhase:
    def test_appends_to_phases(self):
        proj = _proj()
        phase = phase_service.create_phase(proj, {})
        assert phase in proj["phases"]

    def test_default_name(self):
        proj  = _proj()
        phase = phase_service.create_phase(proj, {})
        assert phase["name"] == "New Phase"

    def test_custom_fields(self):
        proj  = _proj()
        phase = phase_service.create_phase(
            proj, {"name": "Sprint", "value": 4, "unit": "days"})
        assert phase["name"]  == "Sprint"
        assert phase["value"] == 4.0
        assert phase["unit"]  == "days"

    def test_y_increments_from_last(self):
        proj = _proj()
        first_y = proj["phases"][0]["y"]
        phase = phase_service.create_phase(proj, {})
        assert phase["y"] == first_y + 150

    def test_creates_edge_from_from_phase_id(self):
        proj   = _proj()
        src_id = proj["phases"][0]["id"]
        new_ph = phase_service.create_phase(proj, {"fromPhaseId": src_id})
        assert any(e["from"] == src_id and e["to"] == new_ph["id"]
                   for e in proj["phaseEdges"])

    def test_no_edge_without_from_phase_id(self):
        proj = _proj()
        phase_service.create_phase(proj, {})
        assert proj["phaseEdges"] == []


# ── update_phase ──────────────────────────────────────────────────────────────

class TestUpdatePhase:
    def test_updates_name(self):
        proj = _proj()
        phid = proj["phases"][0]["id"]
        ph   = phase_service.update_phase(proj, phid, {"name": "Renamed"})
        assert ph["name"] == "Renamed"

    def test_updates_value_and_unit(self):
        proj = _proj()
        phid = proj["phases"][0]["id"]
        phase_service.update_phase(proj, phid, {"value": 6, "unit": "months"})
        assert proj["phases"][0]["value"] == 6.0
        assert proj["phases"][0]["unit"]  == "months"

    def test_legacy_weeks_key(self):
        proj = _proj()
        phid = proj["phases"][0]["id"]
        phase_service.update_phase(proj, phid, {"weeks": 10})
        assert proj["phases"][0]["value"] == 10.0
        assert proj["phases"][0]["unit"]  == "weeks"

    def test_raises_key_error_if_missing(self):
        proj = _proj()
        with pytest.raises(KeyError):
            phase_service.update_phase(proj, "ph_missing", {"name": "X"})

    def test_updates_date_overrides(self):
        proj = _proj()
        phid = proj["phases"][0]["id"]
        phase_service.update_phase(proj, phid,
            {"startDateOverride": "2025-01-01", "endDateOverride": "2025-03-01"})
        assert proj["phases"][0]["startDateOverride"] == "2025-01-01"
        assert proj["phases"][0]["endDateOverride"]   == "2025-03-01"


# ── delete_phase ──────────────────────────────────────────────────────────────

class TestDeletePhase:
    def test_removes_phase(self):
        proj = _proj()
        phid = proj["phases"][0]["id"]
        phase_service.delete_phase(proj, phid)
        assert proj["phases"] == []

    def test_removes_associated_edges(self):
        proj  = _proj()
        phid  = proj["phases"][0]["id"]
        ph2   = phase_service.create_phase(proj, {})
        proj["phaseEdges"].append({"id": "pe_x", "from": phid, "to": ph2["id"]})
        phase_service.delete_phase(proj, phid)
        assert proj["phaseEdges"] == []

    def test_raises_key_error_if_missing(self):
        proj = _proj()
        with pytest.raises(KeyError):
            phase_service.delete_phase(proj, "ph_missing")


# ── move_phase ────────────────────────────────────────────────────────────────

class TestMovePhase:
    def test_swaps_down(self):
        proj = _proj()
        ph2  = phase_service.create_phase(proj, {})
        phid = proj["phases"][0]["id"]
        phase_service.move_phase(proj, phid, 1)
        assert proj["phases"][0]["id"] == ph2["id"]

    def test_no_op_at_boundary(self):
        proj  = _proj()
        phid  = proj["phases"][0]["id"]
        original_order = [p["id"] for p in proj["phases"]]
        phase_service.move_phase(proj, phid, -1)   # already first
        assert [p["id"] for p in proj["phases"]] == original_order

    def test_raises_key_error_if_missing(self):
        proj = _proj()
        with pytest.raises(KeyError):
            phase_service.move_phase(proj, "ph_missing", 1)


# ── create_subphase ───────────────────────────────────────────────────────────

class TestCreateSubphase:
    def test_adds_child(self):
        proj   = _proj()
        parent = proj["phases"][0]
        child  = phase_service.create_subphase(proj, parent["id"], {"name": "Sub"})
        assert child in parent["children"]
        assert child["name"] == "Sub"

    def test_sets_parent_expanded(self):
        proj   = _proj()
        parent = proj["phases"][0]
        parent["expanded"] = False
        phase_service.create_subphase(proj, parent["id"], {})
        assert parent["expanded"] is True

    def test_raises_key_error_if_parent_missing(self):
        proj = _proj()
        with pytest.raises(KeyError):
            phase_service.create_subphase(proj, "ph_missing", {})


# ── add_phase_edge ────────────────────────────────────────────────────────────

class TestAddPhaseEdge:
    def test_adds_edge(self):
        proj  = _proj()
        ph2   = phase_service.create_phase(proj, {})
        phid  = proj["phases"][0]["id"]
        edge  = phase_service.add_phase_edge(proj, phid, ph2["id"])
        assert edge["from"] == phid
        assert edge["to"]   == ph2["id"]
        assert len(proj["phaseEdges"]) == 1

    def test_deduplicates(self):
        proj  = _proj()
        ph2   = phase_service.create_phase(proj, {})
        phid  = proj["phases"][0]["id"]
        e1    = phase_service.add_phase_edge(proj, phid, ph2["id"])
        e2    = phase_service.add_phase_edge(proj, phid, ph2["id"])
        assert e1 is e2
        assert len(proj["phaseEdges"]) == 1

    def test_raises_on_self_loop(self):
        proj = _proj()
        phid = proj["phases"][0]["id"]
        with pytest.raises(ValueError):
            phase_service.add_phase_edge(proj, phid, phid)

    def test_raises_on_missing_args(self):
        proj = _proj()
        with pytest.raises(ValueError):
            phase_service.add_phase_edge(proj, None, "ph_x")
        with pytest.raises(ValueError):
            phase_service.add_phase_edge(proj, "ph_x", None)


# ── delete_phase_edge ─────────────────────────────────────────────────────────

class TestDeletePhaseEdge:
    def test_removes_edge(self):
        proj = _proj()
        ph2  = phase_service.create_phase(proj, {})
        phid = proj["phases"][0]["id"]
        edge = phase_service.add_phase_edge(proj, phid, ph2["id"])
        phase_service.delete_phase_edge(proj, edge["id"])
        assert proj["phaseEdges"] == []

    def test_silent_on_missing(self):
        proj = _proj()
        phase_service.delete_phase_edge(proj, "pe_nonexistent")  # no error
        assert proj["phaseEdges"] == []
