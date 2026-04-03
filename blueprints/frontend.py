"""
blueprints/frontend.py
──────────────────────
Static asset routes, the main SPA shell, and utility endpoints
(health, meta).  No business logic lives here.
"""
import json
from flask import Blueprint, render_template, send_from_directory, jsonify
from models import (
    ALL_SKILLS, TECH_SKILLS, PERS_SKILLS,
    DURATION_UNITS, WP_STATUSES,
    ORG_CHILD_TYPES, ORG_TYPE_ICON, ORG_TYPE_COLOR,
)

bp = Blueprint("frontend", __name__)


# ── PWA assets ────────────────────────────────────────────────────────────────

@bp.route("/manifest.json")
def manifest():
    return send_from_directory("static/pwa", "manifest.json",
                               mimetype="application/manifest+json")


@bp.route("/sw.js")
def service_worker():
    r = send_from_directory("static/pwa", "sw.js")
    r.headers["Service-Worker-Allowed"] = "/"
    r.headers["Cache-Control"] = "no-cache"
    return r


@bp.route("/offline.html")
def offline():
    return send_from_directory("static/pwa", "offline.html")


@bp.route("/favicon.ico")
def favicon():
    return send_from_directory("static", "favicon.ico", mimetype="image/x-icon")


# ── SPA shell ─────────────────────────────────────────────────────────────────

@bp.route("/")
def index():
    return render_template(
        "index.html",
        all_skills=ALL_SKILLS,
        tech_skills=TECH_SKILLS,
        pers_skills=PERS_SKILLS,
        duration_units=DURATION_UNITS,
        wp_statuses=WP_STATUSES,
        org_type_icon=json.dumps(ORG_TYPE_ICON),
        org_type_color=json.dumps(ORG_TYPE_COLOR),
        org_child_types=json.dumps(ORG_CHILD_TYPES),
    )


# ── Utility ───────────────────────────────────────────────────────────────────

@bp.route("/api/state")
def api_state():
    from blueprints.shared import load_state
    return jsonify(load_state())


@bp.route("/api/meta")
def api_meta():
    return jsonify({
        "allSkills":    ALL_SKILLS,
        "techSkills":   TECH_SKILLS,
        "persSkills":   PERS_SKILLS,
        "orgTypeIcon":  ORG_TYPE_ICON,
        "orgTypeColor": ORG_TYPE_COLOR,
        "orgChildTypes": ORG_CHILD_TYPES,
        "durationUnits": DURATION_UNITS,
        "wpStatuses":   WP_STATUSES,
    })


@bp.route("/health")
def health():
    return jsonify({"status": "ok"})
