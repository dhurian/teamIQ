"""
TeamIQ – Flask application entry point.

All route logic lives in blueprints/.  This file is intentionally minimal:
it wires blueprints together, registers error handlers, and starts the server.
"""
import os
from flask import Flask, jsonify
from db import init_db
from migrations.v1_json_to_tables import run as run_migration

from blueprints.frontend      import bp as frontend_bp
from blueprints.projects      import bp as projects_bp
from blueprints.phases        import bp as phases_bp
from blueprints.work_packages import bp as work_packages_bp
from blueprints.teams         import bp as teams_bp
from blueprints.org           import bp as org_bp
from blueprints.simulation    import bp as simulation_bp
from blueprints.requirements  import bp as requirements_bp


def create_app() -> Flask:
    application = Flask(__name__)

    # ── Blueprints ─────────────────────────────────────────────────────────────
    application.register_blueprint(frontend_bp)
    application.register_blueprint(projects_bp)
    application.register_blueprint(phases_bp)
    application.register_blueprint(work_packages_bp)
    application.register_blueprint(teams_bp)
    application.register_blueprint(org_bp)
    application.register_blueprint(simulation_bp)
    application.register_blueprint(requirements_bp)

    # ── Error handlers ─────────────────────────────────────────────────────────
    @application.errorhandler(404)
    def not_found(e):
        return jsonify({"ok": False, "error": "Not found"}), 404

    @application.errorhandler(405)
    def method_not_allowed(e):
        return jsonify({"ok": False, "error": "Method not allowed"}), 405

    return application


# Module-level app instance (used by gunicorn: `gunicorn app:app`)
init_db()
run_migration()
app = create_app()


if __name__ == "__main__":
    port  = int(os.environ.get("PORT", 8080))
    debug = os.environ.get("FLASK_ENV") == "development"
    print(f"\n  TeamIQ → http://localhost:{port}\n")
    app.run(host="0.0.0.0", port=port, debug=debug)
