"""
Unit tests for services/requirement_service.py.
No Flask or DB — pure Python dict manipulation.
"""
import pytest
from services import requirement_service


# ── SECTION: fixtures ────────────────────────────────────────────────────────

def _proj():
    return {"id": "proj_t", "requirements": []}


# ── SECTION: create_requirement ──────────────────────────────────────────────

class TestCreateRequirement:
    def test_appends_to_project(self):
        proj = _proj()
        req  = requirement_service.create_requirement(proj, {"text": "The system shall..."})
        assert req in proj["requirements"]
        assert req["text"] == "The system shall..."

    def test_default_empty_text(self):
        proj = _proj()
        req  = requirement_service.create_requirement(proj, {})
        assert req["text"] == ""

    def test_linked_wps(self):
        proj = _proj()
        req  = requirement_service.create_requirement(proj, {"linkedWPs": ["wp1", "wp2"]})
        assert req["linkedWPs"] == ["wp1", "wp2"]

    def test_unique_ids(self):
        proj = _proj()
        r1   = requirement_service.create_requirement(proj, {})
        r2   = requirement_service.create_requirement(proj, {})
        assert r1["id"] != r2["id"]

    def test_creates_requirements_key_if_missing(self):
        proj = {"id": "p1"}   # no requirements key
        req  = requirement_service.create_requirement(proj, {})
        assert req in proj["requirements"]


# ── SECTION: update_requirement ──────────────────────────────────────────────

class TestUpdateRequirement:
    def test_updates_text(self):
        proj = _proj()
        req  = requirement_service.create_requirement(proj, {"text": "Old"})
        ret  = requirement_service.update_requirement(proj, req["id"], {"text": "New"})
        assert ret["text"] == "New"
        assert ret is req

    def test_updates_linked_wps(self):
        proj = _proj()
        req  = requirement_service.create_requirement(proj, {})
        requirement_service.update_requirement(proj, req["id"], {"linkedWPs": ["wp3"]})
        assert req["linkedWPs"] == ["wp3"]

    def test_raises_on_missing(self):
        proj = _proj()
        with pytest.raises(KeyError):
            requirement_service.update_requirement(proj, "req_missing", {})


# ── SECTION: delete_requirement ──────────────────────────────────────────────

class TestDeleteRequirement:
    def test_removes_requirement(self):
        proj = _proj()
        req  = requirement_service.create_requirement(proj, {})
        requirement_service.delete_requirement(proj, req["id"])
        assert proj["requirements"] == []

    def test_only_removes_target(self):
        proj = _proj()
        r1   = requirement_service.create_requirement(proj, {"text": "A"})
        r2   = requirement_service.create_requirement(proj, {"text": "B"})
        requirement_service.delete_requirement(proj, r1["id"])
        assert proj["requirements"] == [r2]

    def test_raises_on_missing(self):
        proj = _proj()
        with pytest.raises(KeyError):
            requirement_service.delete_requirement(proj, "req_missing")
