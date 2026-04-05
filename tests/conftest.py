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

    # Re-initialise the DB schema on the temp file (creates all tables)
    db_module.init_db()

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
    from repositories import project_repo, org_repo
    from models import seed_projects, seed_org

    # Reset to clean seed state before every test
    projects = seed_projects()
    org      = seed_org()
    project_repo.save_all(projects)
    org_repo.save(org)
    project_repo.set_active(projects[0]["id"])

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
    r    = client.get("/api/state")
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


@pytest.fixture()
def state_data(client):
    """Return a callable that fetches the latest API state."""
    def _get_state():
        return client.get("/api/state").get_json()
    return _get_state


@pytest.fixture()
def project_state(state_data):
    """Return a callable that fetches a project by id from API state."""
    def _get_project(project_id):
        data = state_data()
        return next(p for p in data["projects"] if p["id"] == project_id)
    return _get_project


# ── Shared resource-creation fixtures ────────────────────────────────────────
# These eliminate per-file @pytest.fixture boilerplate for common resources.

@pytest.fixture()
def second_team_id(client, proj_id):
    """Add a second team and return its id."""
    r = client.post(f"/api/projects/{proj_id}/teams",
                    json={"name": "Team Beta", "color": "#ff0000"})
    assert r.status_code == 200
    return r.get_json()["team"]["id"]


@pytest.fixture()
def member_id(client, proj_id, team_id):
    """Add a standalone member to team_id and return its id."""
    r = client.post(f"/api/projects/{proj_id}/teams/{team_id}/members",
                    json={"name": "Test Person", "role": "Dev"})
    assert r.status_code == 200
    return r.get_json()["member"]["id"]


@pytest.fixture()
def wp_id(client, proj_id, phase_id):
    """Create a work package in the first phase and return its id."""
    r = client.post(f"/api/projects/{proj_id}/phases/{phase_id}/work-packages",
                    json={"name": "Test WP"})
    assert r.status_code == 200
    return r.get_json()["workPackage"]["id"]


@pytest.fixture()
def conn_id(client, proj_id, team_id, second_team_id):
    """Create a connection between team_id and second_team_id and return its id."""
    r = client.post(f"/api/projects/{proj_id}/connections",
                    json={"from": team_id, "to": second_team_id,
                          "type": "integration", "label": "Test"})
    assert r.status_code == 200
    return r.get_json()["connection"]["id"]
