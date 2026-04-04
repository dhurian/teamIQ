"""
repositories/org_repo.py
─────────────────────────
Normalized SQLite persistence for the global org hierarchy tree.

Stores each node as a flat row with a parent_id FK and reconstructs
the tree on load — same nested-dict format the service layer uses.
"""
import json
from db import _connect


# ── Public API ────────────────────────────────────────────────────────────────

def load() -> dict | None:
    """Return the org tree as a nested dict, or None if no data exists."""
    with _connect() as conn:
        rows = conn.execute("SELECT * FROM org_nodes").fetchall()
    if not rows:
        return None
    return _build_tree(rows)


def save(org_root: dict) -> None:
    """Replace the entire org tree with *org_root*."""
    with _connect() as conn:
        conn.execute("DELETE FROM org_nodes")
        _insert_node(conn, org_root, parent_id=None, sort_order=0)
        conn.commit()


# ── Helpers ───────────────────────────────────────────────────────────────────

def _insert_node(conn, node: dict, parent_id, sort_order: int) -> None:
    conn.execute("""
        INSERT INTO org_nodes
            (id, parent_id, type, name, role, color, expanded, skills_json, sort_order)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (node["id"], parent_id, node["type"], node.get("name", ""),
          node.get("role"), node.get("color"),
          1 if node.get("expanded", True) else 0,
          json.dumps(node["skills"]) if node.get("skills") else None,
          sort_order))
    for i, child in enumerate(node.get("children", [])):
        _insert_node(conn, child, node["id"], i)


def _build_tree(rows) -> dict:
    """Reconstruct nested tree from flat org_nodes rows."""
    # Build node map: id -> (parent_id, sort_order, output_dict)
    nodes = {}
    for row in rows:
        d = {
            "id":       row["id"],
            "type":     row["type"],
            "name":     row["name"],
            "expanded": bool(row["expanded"]),
            "children": [],
        }
        if row["role"] is not None:
            d["role"] = row["role"]
        if row["color"] is not None:
            d["color"] = row["color"]
        if row["skills_json"]:
            d["skills"] = json.loads(row["skills_json"])
        nodes[row["id"]] = (row["parent_id"], row["sort_order"], d)

    # Assign children to parents as (sort_order, dict) tuples
    top_level = []
    children_map = {nid: [] for nid in nodes}
    for nid, (parent_id, so, d) in nodes.items():
        if parent_id is None:
            top_level.append((so, d))
        elif parent_id in nodes:
            children_map[parent_id].append((so, d))

    # Sort and attach children
    def _attach(d):
        nid = d["id"]
        d["children"] = [c for _, c in sorted(children_map[nid], key=lambda t: t[0])]
        for c in d["children"]:
            _attach(c)
        return d

    roots = [_attach(d) for _, d in sorted(top_level, key=lambda t: t[0])]
    return roots[0] if roots else None
