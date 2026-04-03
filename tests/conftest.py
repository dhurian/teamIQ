"""
conftest.py – shared fixtures for all TeamIQ tests.

Strategy: patch db.DB_PATH to a temp file so every test gets
a clean, isolated SQLite database with no side effects on production data.
"""
import os
import sys
import tempfile
import pytest

# Ensure the project root is on sys.path regardless of where pytest is invoked
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)


@pytest.fixture(scope="session")
def app():
    """Create a Flask test app backed by a temporary SQLite database."""
    import db as db_module

    # Point the persistence layer at a fresh temp file for the whole session
    db_fd, db_path = tempfile.mkstemp(suffix=".db")
    os.close(db_fd)
    db_module.DB_PATH = db_path

    # Re-initialise the DB schema on the temp file
    db_module.init_db()

    # Wipe any residual state (in case the module cached something)
    db_module.db_delete("projects")
    db_module.db_delete("globalOrg")
    db_module.db_delete("activeProjectId")

    # Import after patching DB_PATH so create_app() uses the temp DB
    from app import create_app
    flask_app = create_app()
    flask_app.config.update(
        TESTING=True,
        WTF_CSRF_ENABLED=False,
    )

    yield flask_app

    # Cleanup temp DB
    os.unlink(db_path)


@pytest.fixture()
def client(app):
    """Flask test client with a clean DB before each test."""
    import db as db_module
    from models import seed_projects, seed_org

    # Reset to clean seed state before every test
    projects = seed_projects()
    org = seed_org()
    db_module.db_set("projects", projects)
    db_module.db_set("globalOrg", org)
    db_module.db_set("activeProjectId", projects[0]["id"])

    with app.test_client() as c:
        yield c


@pytest.fixture()
def proj_id(client):
    """Return the active project id from seed data."""
    r = client.get("/api/state")
    return r.get_json()["activeProjectId"]


@pytest.fixture()
def proj(client, proj_id):
    """Return the active project dict from seed data."""
    r = client.get("/api/state")
    data = r.get_json()
    return next(p for p in data["projects"] if p["id"] == proj_id)


@pytest.fixture()
def phase_id(proj):
    """Return the first top-level phase id."""
    return proj["phases"][0]["id"]


@pytest.fixture()
def team_id(proj):
    """Return the first team id."""
    return proj["teams"][0]["id"]
