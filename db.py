"""
TeamIQ – persistence layer using Python's built-in sqlite3.
Stores the entire application state as a single JSON blob per key,
giving us the simplicity of the original dict with durability.
"""
import sqlite3
import json
import os
from pathlib import Path

# Where to store the database.
# On Render/Railway: use /data (mounted persistent disk) if available,
# otherwise fall back to the app directory.
_DATA_DIR = Path(os.environ.get("DATA_DIR", Path(__file__).parent))
DB_PATH   = _DATA_DIR / "teamiq.db"


def _connect() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    """Create all tables (legacy store + normalized schema)."""
    with _connect() as conn:
        # ── Legacy key-value store (kept for migration reads) ──────────────────
        conn.execute("""
            CREATE TABLE IF NOT EXISTS store (
                key   TEXT PRIMARY KEY,
                value TEXT NOT NULL
            )
        """)

        # ── Normalized project tables ──────────────────────────────────────────
        conn.execute("""
            CREATE TABLE IF NOT EXISTS projects (
                id                TEXT PRIMARY KEY,
                name              TEXT NOT NULL DEFAULT '',
                color             TEXT NOT NULL DEFAULT '#4a9eff',
                sel_team_id       TEXT,
                sel_member_id     TEXT,
                org_mode          TEXT NOT NULL DEFAULT 'none',
                start_date        TEXT,
                business_case_json TEXT NOT NULL DEFAULT '{}',
                task_edges_json   TEXT NOT NULL DEFAULT '[]'
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS teams (
                id         TEXT PRIMARY KEY,
                project_id TEXT NOT NULL,
                name       TEXT NOT NULL DEFAULT '',
                color      TEXT NOT NULL DEFAULT '#4a9eff',
                x          REAL NOT NULL DEFAULT 30,
                y          REAL NOT NULL DEFAULT 40,
                sort_order INTEGER NOT NULL DEFAULT 0
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS members (
                id         TEXT PRIMARY KEY,
                team_id    TEXT NOT NULL,
                org_id     TEXT,
                name       TEXT,
                role       TEXT,
                skills_json TEXT,
                sort_order INTEGER NOT NULL DEFAULT 0
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS connections (
                id         TEXT PRIMARY KEY,
                project_id TEXT NOT NULL,
                from_id    TEXT NOT NULL,
                to_id      TEXT NOT NULL,
                label      TEXT NOT NULL DEFAULT '',
                type       TEXT NOT NULL DEFAULT 'integration'
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS requirements (
                id             TEXT PRIMARY KEY,
                project_id     TEXT NOT NULL,
                text           TEXT NOT NULL DEFAULT '',
                linked_wps_json TEXT NOT NULL DEFAULT '[]',
                sort_order     INTEGER NOT NULL DEFAULT 0
            )
        """)

        # ── Timeline tables (Phase 0 deliverable) ──────────────────────────────
        conn.execute("""
            CREATE TABLE IF NOT EXISTS timeline_items (
                id                    TEXT PRIMARY KEY,
                project_id            TEXT NOT NULL,
                parent_id             TEXT,
                item_type             TEXT NOT NULL,
                name                  TEXT NOT NULL DEFAULT '',
                value                 REAL NOT NULL DEFAULT 1,
                unit                  TEXT NOT NULL DEFAULT 'weeks',
                x                     REAL DEFAULT 60,
                y                     REAL DEFAULT 60,
                expanded              INTEGER NOT NULL DEFAULT 1,
                required_json         TEXT NOT NULL DEFAULT '{}',
                start_date_override   TEXT,
                end_date_override     TEXT,
                sort_order            INTEGER NOT NULL DEFAULT 0,
                description           TEXT DEFAULT '',
                deliverables_json     TEXT DEFAULT '[]',
                assigned_members_json TEXT DEFAULT '[]',
                status                TEXT DEFAULT 'not_started'
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS timeline_dependencies (
                id         TEXT PRIMARY KEY,
                project_id TEXT NOT NULL,
                from_id    TEXT NOT NULL,
                to_id      TEXT NOT NULL,
                dep_type   TEXT NOT NULL DEFAULT 'phase'
            )
        """)

        # ── Organisation hierarchy ─────────────────────────────────────────────
        conn.execute("""
            CREATE TABLE IF NOT EXISTS org_nodes (
                id          TEXT PRIMARY KEY,
                parent_id   TEXT,
                type        TEXT NOT NULL,
                name        TEXT NOT NULL DEFAULT '',
                role        TEXT,
                color       TEXT,
                expanded    INTEGER NOT NULL DEFAULT 1,
                skills_json TEXT,
                sort_order  INTEGER NOT NULL DEFAULT 0
            )
        """)

        # ── Active project singleton ───────────────────────────────────────────
        conn.execute("""
            CREATE TABLE IF NOT EXISTS active_project (
                singleton_key INTEGER PRIMARY KEY DEFAULT 1,
                project_id    TEXT
            )
        """)

        conn.commit()


def db_get(key: str, default=None):
    """Retrieve a JSON value by key."""
    with _connect() as conn:
        row = conn.execute("SELECT value FROM store WHERE key = ?", (key,)).fetchone()
    if row is None:
        return default
    return json.loads(row["value"])


def db_set(key: str, value) -> None:
    """Persist a JSON-serialisable value."""
    with _connect() as conn:
        conn.execute(
            "INSERT INTO store (key, value) VALUES (?, ?) "
            "ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            (key, json.dumps(value, ensure_ascii=False)),
        )
        conn.commit()


def db_delete(key: str) -> None:
    with _connect() as conn:
        conn.execute("DELETE FROM store WHERE key = ?", (key,))
        conn.commit()
