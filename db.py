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
    """Create the store table if it doesn't exist."""
    with _connect() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS store (
                key   TEXT PRIMARY KEY,
                value TEXT NOT NULL
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
