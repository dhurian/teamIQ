"""
Unit tests for services/work_package_service.py.
No Flask or DB — pure Python dict manipulation.
"""
import pytest
from models import new_phase
from services import work_package_service


# ── Fixtures ──────────────────────────────────────────────────────────────────

def _proj_with_phase():
    ph = new_phase("Phase 1", 2, "weeks", 60, 60)
    return {
        "id":     "proj_t",
        "phases": [ph],
    }, ph


# ── create_wp ─────────────────────────────────────────────────────────────────

class TestCreateWp:
    def test_adds_to_phase(self):
        proj, ph = _proj_with_phase()
        wp = work_package_service.create_wp(proj, ph["id"], {})
        assert wp in ph["workPackages"]

    def test_default_name(self):
        proj, ph = _proj_with_phase()
        wp = work_package_service.create_wp(proj, ph["id"], {})
        assert wp["name"] == "New Work Package"

    def test_custom_fields(self):
        proj, ph = _proj_with_phase()
        wp = work_package_service.create_wp(proj, ph["id"], {
            "name": "Auth", "description": "Login flow",
            "status": "in_progress", "assignedMembers": ["m1"]})
        assert wp["name"]            == "Auth"
        assert wp["description"]     == "Login flow"
        assert wp["status"]          == "in_progress"
        assert wp["assignedMembers"] == ["m1"]

    def test_raises_on_missing_phase(self):
        proj, _ = _proj_with_phase()
        with pytest.raises(KeyError):
            work_package_service.create_wp(proj, "ph_missing", {})


# ── update_wp ─────────────────────────────────────────────────────────────────

class TestUpdateWp:
    def test_updates_fields(self):
        proj, ph = _proj_with_phase()
        wp = work_package_service.create_wp(proj, ph["id"], {"name": "Original"})
        work_package_service.update_wp(proj, wp["id"], {"name": "Updated", "status": "complete"})
        assert wp["name"]   == "Updated"
        assert wp["status"] == "complete"

    def test_returns_wp(self):
        proj, ph = _proj_with_phase()
        wp  = work_package_service.create_wp(proj, ph["id"], {})
        ret = work_package_service.update_wp(proj, wp["id"], {"name": "X"})
        assert ret is wp

    def test_raises_on_missing(self):
        proj, _ = _proj_with_phase()
        with pytest.raises(KeyError):
            work_package_service.update_wp(proj, "wp_missing", {})

    def test_updates_date_overrides(self):
        proj, ph = _proj_with_phase()
        wp = work_package_service.create_wp(proj, ph["id"], {})
        work_package_service.update_wp(proj, wp["id"],
            {"startDateOverride": "2025-06-01", "endDateOverride": "2025-07-01"})
        assert wp["startDateOverride"] == "2025-06-01"
        assert wp["endDateOverride"]   == "2025-07-01"


# ── delete_wp ─────────────────────────────────────────────────────────────────

class TestDeleteWp:
    def test_removes_wp(self):
        proj, ph = _proj_with_phase()
        wp = work_package_service.create_wp(proj, ph["id"], {})
        work_package_service.delete_wp(proj, wp["id"])
        assert ph["workPackages"] == []

    def test_raises_on_missing(self):
        proj, _ = _proj_with_phase()
        with pytest.raises(KeyError):
            work_package_service.delete_wp(proj, "wp_missing")

    def test_finds_in_subphase(self):
        proj, ph = _proj_with_phase()
        sub = new_phase("Sub", 1, "weeks", 0, 0)
        ph["children"].append(sub)
        wp = work_package_service.create_wp(proj, sub["id"], {"name": "Deep WP"})
        work_package_service.delete_wp(proj, wp["id"])
        assert sub["workPackages"] == []


# ── move_wp ───────────────────────────────────────────────────────────────────

class TestMoveWp:
    def test_moves_down(self):
        proj, ph = _proj_with_phase()
        wp1 = work_package_service.create_wp(proj, ph["id"], {"name": "First"})
        wp2 = work_package_service.create_wp(proj, ph["id"], {"name": "Second"})
        work_package_service.move_wp(proj, wp1["id"], 1)
        assert ph["workPackages"][0]["id"] == wp2["id"]
        assert ph["workPackages"][1]["id"] == wp1["id"]

    def test_moves_up(self):
        proj, ph = _proj_with_phase()
        wp1 = work_package_service.create_wp(proj, ph["id"], {"name": "First"})
        wp2 = work_package_service.create_wp(proj, ph["id"], {"name": "Second"})
        work_package_service.move_wp(proj, wp2["id"], -1)
        assert ph["workPackages"][0]["id"] == wp2["id"]

    def test_no_op_at_boundary(self):
        proj, ph = _proj_with_phase()
        wp = work_package_service.create_wp(proj, ph["id"], {})
        work_package_service.move_wp(proj, wp["id"], 1)   # already last
        assert ph["workPackages"][0]["id"] == wp["id"]

    def test_raises_on_missing(self):
        proj, _ = _proj_with_phase()
        with pytest.raises(KeyError):
            work_package_service.move_wp(proj, "wp_missing", 1)
