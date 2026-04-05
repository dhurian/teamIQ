"""
blueprints/resources.py
────────────────────────
Resource allocation endpoint.
Thin HTTP wrapper — logic lives in services/resource_service.py.
"""
from flask import Blueprint
from blueprints.shared import load_state, ok
from services import resource_service

bp = Blueprint("resources", __name__)


# ── SECTION: resource allocation (GET /api/resources) ────────────────────────

@bp.route("/api/resources", methods=["GET"])
def api_get_resources():
    state  = load_state()
    result = resource_service.compute_allocation(
        state["projects"], state.get("globalOrg", {})
    )
    return ok(result)
