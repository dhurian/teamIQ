"""
services/simulation_service.py
────────────────────────────────
Business logic for Monte Carlo simulation: per-project and portfolio-wide.
No Flask imports.
"""
from models import run_monte_carlo, build_org_lookup


def simulate_project(proj: dict, global_org: dict, n_runs: int = 2000) -> dict:
    """
    Run Monte Carlo for *proj* (all members combined) and per-team.
    Returns {"combined": result, "teams": {team_id: result, ...}}.
    """
    lookup  = build_org_lookup(global_org)
    members = [m for t in proj["teams"] for m in t["members"]]
    combined = run_monte_carlo(members, proj["phases"], lookup, n=n_runs)
    teams = {
        t["id"]: run_monte_carlo(
            t["members"], proj["phases"], lookup,
            n=max(500, n_runs // 4))
        for t in proj["teams"]
    }
    return {"combined": combined, "teams": teams}


def simulate_portfolio(projects: list, global_org: dict, n_runs: int = 500) -> dict:
    """
    Run Monte Carlo for every project in *projects*.
    Returns {project_id: result, ...}.
    """
    lookup = build_org_lookup(global_org)
    return {
        p["id"]: run_monte_carlo(
            [m for t in p["teams"] for m in t["members"]],
            p["phases"], lookup, n=n_runs)
        for p in projects
    }
