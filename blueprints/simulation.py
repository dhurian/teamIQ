"""
blueprints/simulation.py
─────────────────────────
Monte Carlo simulation endpoints: per-project and portfolio-wide.
"""
from flask import Blueprint, request, jsonify
from models import run_monte_carlo, build_org_lookup
from blueprints.shared import load_state, get_project

bp = Blueprint("simulation", __name__)


@bp.route("/api/simulate", methods=["POST"])
def api_simulate():
    body   = request.get_json() or {}
    pid    = body.get("projectId")
    n_runs = int(body.get("runs", 2000))
    state  = load_state()
    proj   = get_project(state["projects"], pid)
    lookup = build_org_lookup(state["globalOrg"])
    members = [m for t in proj["teams"] for m in t["members"]]
    result  = run_monte_carlo(members, proj["phases"], lookup, n=n_runs)
    team_results = {
        t["id"]: run_monte_carlo(
            t["members"], proj["phases"], lookup,
            n=max(500, n_runs // 4))
        for t in proj["teams"]
    }
    return jsonify({"combined": result, "teams": team_results})


@bp.route("/api/simulate/portfolio", methods=["POST"])
def api_simulate_portfolio():
    state  = load_state()
    lookup = build_org_lookup(state["globalOrg"])
    return jsonify({
        p["id"]: run_monte_carlo(
            [m for t in p["teams"] for m in t["members"]],
            p["phases"], lookup, n=500)
        for p in state["projects"]
    })
