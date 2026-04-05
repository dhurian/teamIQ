"""
blueprints/simulation.py
─────────────────────────
Monte Carlo simulation, bottleneck detection, recommendations,
and scenario comparison endpoints.
Thin HTTP wrappers — all logic lives in services/*.py.
"""
from flask import Blueprint, request, jsonify
from blueprints.shared import load_state, get_project
from services import simulation_service
from services import analysis_service

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


# ── Bottleneck detection ──────────────────────────────────────────────────────

@bp.route("/api/bottlenecks", methods=["GET"])
def api_bottlenecks():
    pid    = request.args.get("projectId")
    n_runs = int(request.args.get("runs", 2000))
    state  = load_state()
    proj   = get_project(state["projects"], pid)
    result = analysis_service.detect_bottlenecks(proj, state["globalOrg"], n_runs)
    result["critical_chain"] = analysis_service.critical_chain_report(proj)
    return jsonify(result)


# ── Recommendations ───────────────────────────────────────────────────────────

@bp.route("/api/recommendations", methods=["POST"])
def api_recommendations():
    body   = request.get_json() or {}
    pid    = body.get("projectId")
    n_runs = int(body.get("runs", 1000))
    state  = load_state()
    proj   = get_project(state["projects"], pid)

    # Run bottleneck detection, then derive recommendations
    bn     = analysis_service.detect_bottlenecks(proj, state["globalOrg"], n_runs)
    result = analysis_service.generate_recommendations(
        proj, state["globalOrg"], bn["bottlenecks"])
    # Include simulation summary for context
    result["simulation"] = bn["simulation"]
    result["critical_count"] = bn["critical_count"]
    return jsonify(result)


# ── Scenario comparison ───────────────────────────────────────────────────────

@bp.route("/api/scenarios/compare", methods=["POST"])
def api_scenarios_compare():
    body       = request.get_json() or {}
    pid_list   = body.get("projectIds", [])
    n_runs     = int(body.get("runs", 1000))
    state      = load_state()

    results = []
    for pid in pid_list:
        proj = next((p for p in state["projects"] if p["id"] == pid), None)
        if proj is None:
            continue
        sim = simulation_service.simulate_project(proj, state["globalOrg"], n_runs)
        results.append({
            "id":     proj["id"],
            "name":   proj["name"],
            "color":  proj.get("color", "#4a9eff"),
            "phases": [ph["name"] for ph in proj.get("phases", [])],
            "combined": sim["combined"],
        })

    return jsonify({"projects": results})
