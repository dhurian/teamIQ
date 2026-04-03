"""
blueprints/simulation.py
─────────────────────────
Monte Carlo simulation endpoints: per-project and portfolio-wide.
Thin HTTP wrapper — all logic lives in services/simulation_service.py.
"""
from flask import Blueprint, request, jsonify
from blueprints.shared import load_state, get_project
from services import simulation_service

bp = Blueprint("simulation", __name__)


@bp.route("/api/simulate", methods=["POST"])
def api_simulate():
    body   = request.get_json() or {}
    pid    = body.get("projectId")
    n_runs = int(body.get("runs", 2000))
    state  = load_state()
    proj   = get_project(state["projects"], pid)
    result = simulation_service.simulate_project(proj, state["globalOrg"], n_runs)
    return jsonify(result)


@bp.route("/api/simulate/portfolio", methods=["POST"])
def api_simulate_portfolio():
    state = load_state()
    return jsonify(simulation_service.simulate_portfolio(
        state["projects"], state["globalOrg"]))
