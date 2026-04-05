"""
test_api_simulation.py – integration tests for the simulation API endpoints.
"""
import pytest


# ── SECTION: TestProjectSimulation ───────────────────────────────────────────

class TestProjectSimulation:
    def test_simulate_200(self, client, proj_id):
        r = client.post("/api/simulate",
                        json={"projectId": proj_id, "runs": 200})
        assert r.status_code == 200

    def test_simulate_has_combined(self, client, proj_id):
        data = client.post("/api/simulate",
                           json={"projectId": proj_id, "runs": 200}).get_json()
        assert "combined" in data

    def test_simulate_combined_has_overall_prob(self, client, proj_id):
        data = client.post("/api/simulate",
                           json={"projectId": proj_id, "runs": 200}).get_json()
        assert "overall_prob" in data["combined"]

    def test_simulate_overall_prob_bounded(self, client, proj_id):
        data = client.post("/api/simulate",
                           json={"projectId": proj_id, "runs": 500}).get_json()
        p = data["combined"]["overall_prob"]
        assert 0.0 <= p <= 1.0

    def test_simulate_has_teams(self, client, proj_id):
        data = client.post("/api/simulate",
                           json={"projectId": proj_id, "runs": 200}).get_json()
        assert "teams" in data
        assert isinstance(data["teams"], dict)

    def test_simulate_has_phase_prob(self, client, proj_id, proj):
        data = client.post("/api/simulate",
                           json={"projectId": proj_id, "runs": 200}).get_json()
        n_phases = len(proj["phases"])
        assert len(data["combined"]["phase_prob"]) == n_phases

    def test_simulate_has_team_exp(self, client, proj_id):
        data = client.post("/api/simulate",
                           json={"projectId": proj_id, "runs": 200}).get_json()
        assert "team_exp" in data["combined"]
        # team_exp should have at least one skill
        assert len(data["combined"]["team_exp"]) > 0

    def test_simulate_unknown_project_404(self, client):
        r = client.post("/api/simulate", json={"projectId": "ghost", "runs": 100})
        assert r.status_code == 404

    def test_simulate_no_members_returns_zero(self, client, proj_id):
        """Project with no members → overall_prob = 0."""
        # Add a fresh project with no team members
        r = client.post("/api/projects", json={"name": "Empty Project"})
        empty_pid = r.get_json()["project"]["id"]
        data = client.post("/api/simulate",
                           json={"projectId": empty_pid, "runs": 100}).get_json()
        assert data["combined"]["overall_prob"] == 0.0

    def test_simulate_default_runs(self, client, proj_id):
        """Omitting 'runs' should still return a valid result."""
        r = client.post("/api/simulate", json={"projectId": proj_id})
        assert r.status_code == 200

    def test_simulate_team_results_match_team_ids(self, client, proj_id, proj):
        data = client.post("/api/simulate",
                           json={"projectId": proj_id, "runs": 200}).get_json()
        team_ids = {t["id"] for t in proj["teams"]}
        result_ids = set(data["teams"].keys())
        assert result_ids == team_ids


# ── SECTION: TestPortfolioSimulation ─────────────────────────────────────────

class TestPortfolioSimulation:
    def test_portfolio_simulate_200(self, client):
        r = client.post("/api/simulate/portfolio")
        assert r.status_code == 200

    def test_portfolio_returns_dict_keyed_by_proj_id(self, client):
        data = client.post("/api/simulate/portfolio").get_json()
        assert isinstance(data, dict)

    def test_portfolio_contains_all_projects(self, client):
        projects = client.get("/api/projects").get_json()
        data = client.post("/api/simulate/portfolio").get_json()
        for p in projects:
            assert p["id"] in data, f"Project {p['id']} missing from portfolio result"

    def test_portfolio_each_result_has_overall_prob(self, client):
        data = client.post("/api/simulate/portfolio").get_json()
        for pid, result in data.items():
            assert "overall_prob" in result, f"Project {pid} missing overall_prob"
            assert 0.0 <= result["overall_prob"] <= 1.0
