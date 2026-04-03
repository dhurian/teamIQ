"""
test_models.py – unit tests for pure model functions (no Flask, no DB).
"""
import pytest
from models import (
    uid, to_weeks, phase_weeks, new_phase, new_work_package,
    find_phase, all_phases_flat, remove_phase_edges,
    find_node, flat_persons_under, build_org_lookup,
    delete_node_from, run_monte_carlo, default_skills,
)


# ── uid ───────────────────────────────────────────────────────────────────────

class TestUid:
    def test_returns_string(self):
        assert isinstance(uid(), str)

    def test_length_8(self):
        assert len(uid()) == 8

    def test_unique(self):
        ids = {uid() for _ in range(200)}
        assert len(ids) == 200


# ── to_weeks / phase_weeks ────────────────────────────────────────────────────

class TestDurationHelpers:
    def test_days_to_weeks(self):
        assert abs(to_weeks(7, "days") - 1.0) < 0.01

    def test_weeks_identity(self):
        assert to_weeks(3, "weeks") == pytest.approx(3.0)

    def test_months_to_weeks(self):
        assert to_weeks(1, "months") == pytest.approx(4.333, rel=1e-3)

    def test_years_to_weeks(self):
        assert to_weeks(1, "years") == pytest.approx(52.0)

    def test_unknown_unit_defaults_to_weeks(self):
        assert to_weeks(5, "fortnights") == pytest.approx(5.0)

    def test_phase_weeks_uses_value_unit(self):
        ph = new_phase(value=2, unit="months")
        assert phase_weeks(ph) == pytest.approx(to_weeks(2, "months"))

    def test_phase_weeks_legacy_field(self):
        ph = {"weeks": 3}
        assert phase_weeks(ph) == pytest.approx(3.0)


# ── new_phase ─────────────────────────────────────────────────────────────────

class TestNewPhase:
    def test_has_required_keys(self):
        ph = new_phase()
        for key in ("id", "name", "value", "unit", "x", "y",
                    "required", "children", "workPackages", "expanded",
                    "startDateOverride", "endDateOverride"):
            assert key in ph, f"Missing key: {key}"

    def test_id_prefixed(self):
        ph = new_phase()
        assert ph["id"].startswith("ph_")

    def test_custom_values(self):
        ph = new_phase(name="Foo", value=3, unit="months", x=100, y=200)
        assert ph["name"] == "Foo"
        assert ph["value"] == 3
        assert ph["unit"] == "months"
        assert ph["x"] == 100
        assert ph["y"] == 200

    def test_default_overrides_are_none(self):
        ph = new_phase()
        assert ph["startDateOverride"] is None
        assert ph["endDateOverride"] is None

    def test_children_empty_list(self):
        ph = new_phase()
        assert ph["children"] == []

    def test_required_can_be_set(self):
        ph = new_phase(required={"Frontend": 7})
        assert ph["required"]["Frontend"] == 7


# ── new_work_package ──────────────────────────────────────────────────────────

class TestNewWorkPackage:
    def test_has_required_keys(self):
        wp = new_work_package()
        for key in ("id", "name", "description", "deliverables",
                    "assignedMembers", "status", "value", "unit",
                    "startDateOverride", "endDateOverride"):
            assert key in wp

    def test_id_prefixed(self):
        wp = new_work_package()
        assert wp["id"].startswith("wp_")

    def test_default_status(self):
        wp = new_work_package()
        assert wp["status"] == "not_started"

    def test_custom_name(self):
        wp = new_work_package("My WP")
        assert wp["name"] == "My WP"


# ── find_phase / all_phases_flat ──────────────────────────────────────────────

class TestPhaseTree:
    def _tree(self):
        child = new_phase(name="Child")
        parent = new_phase(name="Parent")
        parent["children"] = [child]
        sibling = new_phase(name="Sibling")
        return [parent, sibling], parent, child, sibling

    def test_find_top_level(self):
        phases, parent, _, _ = self._tree()
        found, lst = find_phase(phases, parent["id"])
        assert found is parent
        assert lst is phases

    def test_find_nested(self):
        phases, parent, child, _ = self._tree()
        found, lst = find_phase(phases, child["id"])
        assert found is child
        assert lst is parent["children"]

    def test_find_sibling(self):
        phases, _, _, sibling = self._tree()
        found, lst = find_phase(phases, sibling["id"])
        assert found is sibling
        assert lst is phases

    def test_find_missing_returns_none(self):
        phases, _, _, _ = self._tree()
        found, lst = find_phase(phases, "nonexistent")
        assert found is None
        assert lst is None

    def test_all_phases_flat_includes_nested(self):
        phases, parent, child, sibling = self._tree()
        flat = all_phases_flat(phases)
        ids = [p["id"] for p in flat]
        assert parent["id"] in ids
        assert child["id"] in ids
        assert sibling["id"] in ids

    def test_all_phases_flat_order(self):
        phases, parent, child, sibling = self._tree()
        flat = all_phases_flat(phases)
        # parent comes before child (depth-first)
        parent_i = next(i for i, p in enumerate(flat) if p["id"] == parent["id"])
        child_i  = next(i for i, p in enumerate(flat) if p["id"] == child["id"])
        assert parent_i < child_i


# ── remove_phase_edges ────────────────────────────────────────────────────────

class TestRemovePhaseEdges:
    def _proj_with_edges(self):
        ph1 = new_phase(name="A")
        ph2 = new_phase(name="B")
        child = new_phase(name="B-child")
        ph2["children"] = [child]
        edge_ab  = {"id": "e1", "from": ph1["id"], "to": ph2["id"]}
        edge_bc  = {"id": "e2", "from": ph2["id"], "to": child["id"]}
        edge_ac  = {"id": "e3", "from": ph1["id"], "to": child["id"]}
        return {"phases": [ph1, ph2], "phaseEdges": [edge_ab, edge_bc, edge_ac]}, ph1, ph2, child

    def test_removes_edges_for_top_level_phase(self):
        proj, ph1, ph2, child = self._proj_with_edges()
        remove_phase_edges(proj, ph1["id"])
        remaining_ids = {e["id"] for e in proj["phaseEdges"]}
        assert "e1" not in remaining_ids  # from ph1
        assert "e3" not in remaining_ids  # from ph1
        assert "e2" in remaining_ids      # ph2→child untouched

    def test_removes_edges_for_subphase(self):
        """Regression: this was causing KeyError before the fix."""
        proj, ph1, ph2, child = self._proj_with_edges()
        # Deleting a subphase should not crash and must clean its edges
        remove_phase_edges(proj, child["id"])
        remaining_ids = {e["id"] for e in proj["phaseEdges"]}
        assert "e2" not in remaining_ids  # ph2→child
        assert "e3" not in remaining_ids  # ph1→child
        assert "e1" in remaining_ids      # ph1→ph2 untouched

    def test_removes_parent_and_child_edges_together(self):
        """Deleting ph2 should also remove edges touching its child."""
        proj, ph1, ph2, child = self._proj_with_edges()
        remove_phase_edges(proj, ph2["id"])
        remaining_ids = {e["id"] for e in proj["phaseEdges"]}
        assert "e1" not in remaining_ids  # →ph2
        assert "e2" not in remaining_ids  # ph2→child
        assert "e3" not in remaining_ids  # →child (descendant of ph2)

    def test_missing_phase_cleans_gracefully(self):
        proj, _, _, _ = self._proj_with_edges()
        before = len(proj["phaseEdges"])
        remove_phase_edges(proj, "ghost_id")
        # Should not crash; edges unrelated to ghost_id remain
        assert len(proj["phaseEdges"]) == before


# ── Org tree helpers ──────────────────────────────────────────────────────────

class TestOrgHelpers:
    def _org(self):
        person = {"id": "p1", "type": "person", "name": "Alice",
                  "skills": {}, "children": []}
        team   = {"id": "t1", "type": "team", "name": "Eng",
                  "children": [person]}
        root   = {"id": "root", "type": "org", "name": "Corp",
                  "children": [team]}
        return root, team, person

    def test_find_node_root(self):
        root, _, _ = self._org()
        assert find_node([root], "root") is root

    def test_find_node_deep(self):
        root, _, person = self._org()
        assert find_node([root], "p1") is person

    def test_find_node_missing(self):
        root, _, _ = self._org()
        assert find_node([root], "ghost") is None

    def test_flat_persons_under(self):
        root, _, person = self._org()
        persons = flat_persons_under(root)
        assert len(persons) == 1
        assert persons[0] is person

    def test_build_org_lookup(self):
        root, team, person = self._org()
        lookup = build_org_lookup(root)
        assert "root" in lookup
        assert "t1" in lookup
        assert "p1" in lookup
        assert lookup["p1"] is person

    def test_delete_node_from_leaf(self):
        root, team, person = self._org()
        deleted = delete_node_from([root], "p1")
        assert deleted is True
        assert person not in team["children"]

    def test_delete_node_from_missing(self):
        root, _, _ = self._org()
        deleted = delete_node_from([root], "ghost")
        assert deleted is False


# ── Monte Carlo ───────────────────────────────────────────────────────────────

class TestMonteCarlo:
    def _members_meeting_frontend(self):
        skills = default_skills()
        skills["Frontend"] = {"m": 9.0, "s": 0.1}
        return [{"id": "m1", "skills": skills}]

    def _members_failing_frontend(self):
        skills = default_skills()
        skills["Frontend"] = {"m": 1.0, "s": 0.1}
        return [{"id": "m1", "skills": skills}]

    def _phase_requiring_frontend(self, level=7.0):
        ph = new_phase(name="FE Phase")
        ph["required"] = {"Frontend": level}
        return ph

    def test_no_members_returns_zero(self):
        result = run_monte_carlo([], [new_phase()], {}, n=100)
        assert result["overall_prob"] == 0.0

    def test_no_phases_returns_zero(self):
        result = run_monte_carlo(self._members_meeting_frontend(), [], {}, n=100)
        assert result["overall_prob"] == 0.0

    def test_high_skill_member_passes(self):
        members = self._members_meeting_frontend()
        phases  = [self._phase_requiring_frontend(level=7.0)]
        result  = run_monte_carlo(members, phases, {}, n=500)
        assert result["overall_prob"] > 0.9

    def test_low_skill_member_fails(self):
        members = self._members_failing_frontend()
        phases  = [self._phase_requiring_frontend(level=7.0)]
        result  = run_monte_carlo(members, phases, {}, n=500)
        assert result["overall_prob"] < 0.1

    def test_result_keys(self):
        members = self._members_meeting_frontend()
        phases  = [new_phase()]
        result  = run_monte_carlo(members, phases, {}, n=100)
        assert "overall_prob" in result
        assert "phase_prob" in result
        assert "team_exp" in result

    def test_phase_prob_length_matches_phases(self):
        members = self._members_meeting_frontend()
        phases  = [new_phase(), new_phase(), new_phase()]
        result  = run_monte_carlo(members, phases, {}, n=200)
        assert len(result["phase_prob"]) == 3

    def test_org_lookup_resolves_skills(self):
        """Member with orgId should use the org node's skills."""
        org_skills = default_skills()
        org_skills["Frontend"] = {"m": 9.5, "s": 0.1}
        lookup = {"org_person_1": {"skills": org_skills}}
        member = {"id": "m1", "orgId": "org_person_1"}
        phases = [self._phase_requiring_frontend(level=7.0)]
        result = run_monte_carlo([member], phases, lookup, n=500)
        assert result["overall_prob"] > 0.9

    def test_prob_bounded_0_1(self):
        members = self._members_meeting_frontend()
        phases  = [new_phase()]
        result  = run_monte_carlo(members, phases, {}, n=200)
        assert 0.0 <= result["overall_prob"] <= 1.0
        for p in result["phase_prob"]:
            assert 0.0 <= p <= 1.0
