"""
Unit tests for services/simulation_service.py.
No Flask or DB — verifies output structure and correctness bounds.
"""
import pytest
from models import new_phase, seed_org, default_skills
from services import simulation_service


# ── SECTION: fixtures ────────────────────────────────────────────────────────

def _member(mid="m1"):
    return {"id": mid, "name": "Alice", "role": "Dev", "skills": default_skills()}

def _proj(pid="proj_t", teams=None):
    if teams is None:
        teams = [{"id": "team_1", "members": [_member()]}]
    return {
        "id":     pid,
        "teams":  teams,
        "phases": [new_phase("Phase 1", 2, "weeks", 60, 60)],
    }

def _multi_proj():
    return [_proj("proj_1"), _proj("proj_2")]


# ── SECTION: simulate_project ────────────────────────────────────────────────

class TestSimulateProject:
    def test_returns_combined_and_teams(self):
        proj   = _proj()
        result = simulation_service.simulate_project(proj, seed_org(), n_runs=100)
        assert "combined" in result
        assert "teams"    in result

    def test_combined_has_overall_prob(self):
        proj   = _proj()
        result = simulation_service.simulate_project(proj, seed_org(), n_runs=100)
        prob   = result["combined"]["overall_prob"]
        assert 0.0 <= prob <= 1.0

    def test_teams_keyed_by_team_id(self):
        proj   = _proj()
        result = simulation_service.simulate_project(proj, seed_org(), n_runs=100)
        assert "team_1" in result["teams"]

    def test_each_team_result_has_overall_prob(self):
        proj   = _proj()
        result = simulation_service.simulate_project(proj, seed_org(), n_runs=100)
        for team_result in result["teams"].values():
            assert "overall_prob" in team_result
            assert 0.0 <= team_result["overall_prob"] <= 1.0

    def test_phase_prob_length_matches_phases(self):
        ph1  = new_phase("P1", 2, "weeks", 60, 60)
        ph2  = new_phase("P2", 3, "weeks", 60, 210)
        proj = {
            "id":     "proj_t",
            "teams":  [{"id": "team_1", "members": [_member()]}],
            "phases": [ph1, ph2],
        }
        result = simulation_service.simulate_project(proj, seed_org(), n_runs=100)
        assert len(result["combined"]["phase_prob"]) == 2

    def test_org_linked_member_resolved(self):
        """A member with orgId should resolve skills from the org lookup."""
        proj   = {
            "id":     "proj_t",
            "teams":  [{"id": "team_1", "members": [{"id": "m1", "orgId": "p1"}]}],
            "phases": [new_phase("P1", 2, "weeks", 60, 60)],
        }
        result = simulation_service.simulate_project(proj, seed_org(), n_runs=100)
        assert result["combined"]["overall_prob"] >= 0.0

    def test_empty_members_returns_zero_prob(self):
        proj   = {
            "id":     "proj_t",
            "teams":  [{"id": "team_1", "members": []}],
            "phases": [new_phase("P1", 2, "weeks", 60, 60)],
        }
        result = simulation_service.simulate_project(proj, seed_org(), n_runs=100)
        assert result["combined"]["overall_prob"] == 0.0

    def test_multiple_teams(self):
        proj = {
            "id":    "proj_t",
            "teams": [
                {"id": "team_1", "members": [_member("m1")]},
                {"id": "team_2", "members": [_member("m2")]},
            ],
            "phases": [new_phase("P1", 2, "weeks", 60, 60)],
        }
        result = simulation_service.simulate_project(proj, seed_org(), n_runs=100)
        assert "team_1" in result["teams"]
        assert "team_2" in result["teams"]


# ── SECTION: simulate_portfolio ──────────────────────────────────────────────

class TestSimulatePortfolio:
    def test_returns_dict_keyed_by_project_id(self):
        projects = _multi_proj()
        result   = simulation_service.simulate_portfolio(projects, seed_org(), n_runs=50)
        assert "proj_1" in result
        assert "proj_2" in result

    def test_each_entry_has_overall_prob(self):
        projects = _multi_proj()
        result   = simulation_service.simulate_portfolio(projects, seed_org(), n_runs=50)
        for r in result.values():
            assert "overall_prob" in r
            assert 0.0 <= r["overall_prob"] <= 1.0

    def test_empty_portfolio(self):
        result = simulation_service.simulate_portfolio([], seed_org(), n_runs=50)
        assert result == {}

    def test_project_count_matches(self):
        projects = _multi_proj()
        result   = simulation_service.simulate_portfolio(projects, seed_org(), n_runs=50)
        assert len(result) == len(projects)
