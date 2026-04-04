"""
repositories/project_repo.py
──────────────────────────────
Normalized SQLite persistence for projects, teams, members, connections,
requirements, timeline items, and phase dependency edges.

All public functions accept/return the same plain-dict format that the
service layer uses, so no service code needs to change.
"""
import json
from db import _connect


# ── Public API ────────────────────────────────────────────────────────────────

def load_all() -> list:
    """Return every project as a fully reconstructed dict."""
    with _connect() as conn:
        rows = conn.execute("SELECT * FROM projects").fetchall()
        return [_load_project(conn, row) for row in rows]


def save_all(projects: list) -> None:
    """Replace all project data with *projects* (full replace strategy)."""
    with _connect() as conn:
        _clear_all_project_tables(conn)
        for proj in projects:
            _save_project(conn, proj)
        conn.commit()


def get_active() -> str | None:
    """Return the active project ID, or None."""
    with _connect() as conn:
        row = conn.execute(
            "SELECT project_id FROM active_project WHERE singleton_key = 1"
        ).fetchone()
    return row["project_id"] if row else None


def set_active(pid: str) -> None:
    """Upsert the active project ID."""
    with _connect() as conn:
        conn.execute("""
            INSERT INTO active_project (singleton_key, project_id) VALUES (1, ?)
            ON CONFLICT(singleton_key) DO UPDATE SET project_id = excluded.project_id
        """, (pid,))
        conn.commit()


# ── Load helpers ──────────────────────────────────────────────────────────────

def _load_project(conn, row) -> dict:
    pid  = row["id"]
    proj = {
        "id":           pid,
        "name":         row["name"],
        "color":        row["color"],
        "selTeamId":    row["sel_team_id"],
        "selMemberId":  row["sel_member_id"],
        "orgMode":      row["org_mode"],
        "startDate":    row["start_date"],
        "businessCase": json.loads(row["business_case_json"] or "{}"),
        "taskEdges":    json.loads(row["task_edges_json"] or "[]"),
    }

    # Teams + members
    proj["teams"] = _load_teams(conn, pid)

    # Connections
    proj["connections"] = [
        {"id": c["id"], "from": c["from_id"], "to": c["to_id"],
         "label": c["label"], "type": c["type"]}
        for c in conn.execute(
            "SELECT * FROM connections WHERE project_id = ?", (pid,)).fetchall()
    ]

    # Phases / subphases / work packages (from timeline_items)
    item_rows  = conn.execute(
        "SELECT * FROM timeline_items WHERE project_id = ?", (pid,)).fetchall()
    proj["phases"] = _build_phase_tree(item_rows)

    # Phase dependency edges
    proj["phaseEdges"] = [
        {"id": e["id"], "from": e["from_id"], "to": e["to_id"]}
        for e in conn.execute(
            "SELECT * FROM timeline_dependencies "
            "WHERE project_id = ? AND dep_type = 'phase'", (pid,)).fetchall()
    ]

    # Requirements
    proj["requirements"] = [
        {"id": r["id"], "text": r["text"],
         "linkedWPs": json.loads(r["linked_wps_json"] or "[]")}
        for r in conn.execute(
            "SELECT * FROM requirements WHERE project_id = ? ORDER BY sort_order",
            (pid,)).fetchall()
    ]

    return proj


def _load_teams(conn, pid: str) -> list:
    teams = []
    for t in conn.execute(
            "SELECT * FROM teams WHERE project_id = ? ORDER BY sort_order",
            (pid,)).fetchall():
        members = []
        for m in conn.execute(
                "SELECT * FROM members WHERE team_id = ? ORDER BY sort_order",
                (t["id"],)).fetchall():
            entry = {"id": m["id"]}
            if m["org_id"]:
                entry["orgId"] = m["org_id"]
            else:
                entry["name"]   = m["name"] or ""
                entry["role"]   = m["role"] or ""
                entry["skills"] = json.loads(m["skills_json"]) if m["skills_json"] else {}
            members.append(entry)
        teams.append({
            "id":      t["id"],
            "name":    t["name"],
            "color":   t["color"],
            "x":       t["x"],
            "y":       t["y"],
            "members": members,
        })
    return teams


def _build_phase_tree(item_rows) -> list:
    """Reconstruct the nested phase/subphase/WP tree from flat rows."""
    # Build a map: id -> (meta_dict, output_dict)
    items = {}
    for row in item_rows:
        it = row["item_type"]
        d  = {
            "id":                row["id"],
            "name":              row["name"],
            "value":             float(row["value"]),
            "unit":              row["unit"],
            "expanded":          bool(row["expanded"]),
            "required":          json.loads(row["required_json"] or "{}"),
            "startDateOverride": row["start_date_override"],
            "endDateOverride":   row["end_date_override"],
        }
        if it in ("phase", "subphase"):
            d.update({"x": float(row["x"] or 60), "y": float(row["y"] or 60),
                      "children": [], "workPackages": []})
        else:  # work_package
            d.update({
                "description":     row["description"] or "",
                "deliverables":    json.loads(row["deliverables_json"] or "[]"),
                "assignedMembers": json.loads(row["assigned_members_json"] or "[]"),
                "status":          row["status"] or "not_started",
            })
        items[row["id"]] = (dict(row), d)

    # Assign each item to its parent's list as (sort_order, dict) tuples
    top_phases = []
    for nid, (meta, d) in items.items():
        pid = meta["parent_id"]
        so  = meta["sort_order"]
        if pid is None:
            top_phases.append((so, d))
        elif pid in items:
            _, parent_d = items[pid]
            key = "workPackages" if meta["item_type"] == "work_package" else "children"
            parent_d[key].append((so, d))

    # Sort + unwrap at every level
    def _sort(lst):
        return [d for _, d in sorted(lst, key=lambda t: t[0])]

    def _finalize(node):
        node["children"]     = _sort(node.get("children", []))
        node["workPackages"] = _sort(node.get("workPackages", []))
        for c in node["children"]:
            _finalize(c)
        return node

    return [_finalize(d) for _, d in sorted(top_phases, key=lambda t: t[0])]


# ── Save helpers ──────────────────────────────────────────────────────────────

def _clear_all_project_tables(conn) -> None:
    for tbl in ("timeline_dependencies", "timeline_items", "members",
                "connections", "requirements", "teams", "projects"):
        conn.execute(f"DELETE FROM {tbl}")


def _save_project(conn, proj: dict) -> None:
    pid = proj["id"]
    conn.execute("""
        INSERT INTO projects
            (id, name, color, sel_team_id, sel_member_id,
             org_mode, start_date, business_case_json, task_edges_json)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (pid,
          proj.get("name", ""),
          proj.get("color", "#4a9eff"),
          proj.get("selTeamId"),
          proj.get("selMemberId"),
          proj.get("orgMode", "none"),
          proj.get("startDate"),
          json.dumps(proj.get("businessCase", {})),
          json.dumps(proj.get("taskEdges", []))))

    for i, team in enumerate(proj.get("teams", [])):
        conn.execute("""
            INSERT INTO teams (id, project_id, name, color, x, y, sort_order)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (team["id"], pid, team.get("name", ""), team.get("color", "#4a9eff"),
              team.get("x", 30), team.get("y", 40), i))
        for j, m in enumerate(team.get("members", [])):
            conn.execute("""
                INSERT INTO members
                    (id, team_id, org_id, name, role, skills_json, sort_order)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (m["id"], team["id"],
                  m.get("orgId"),
                  m.get("name"),
                  m.get("role"),
                  json.dumps(m["skills"]) if m.get("skills") else None,
                  j))

    for c in proj.get("connections", []):
        conn.execute("""
            INSERT INTO connections (id, project_id, from_id, to_id, label, type)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (c["id"], pid, c["from"], c["to"],
              c.get("label", ""), c.get("type", "integration")))

    _save_timeline_items(conn, pid, proj.get("phases", []), parent_id=None)

    for edge in proj.get("phaseEdges", []):
        conn.execute("""
            INSERT INTO timeline_dependencies (id, project_id, from_id, to_id, dep_type)
            VALUES (?, ?, ?, ?, 'phase')
        """, (edge["id"], pid, edge["from"], edge["to"]))

    for i, req in enumerate(proj.get("requirements", [])):
        conn.execute("""
            INSERT INTO requirements (id, project_id, text, linked_wps_json, sort_order)
            VALUES (?, ?, ?, ?, ?)
        """, (req["id"], pid, req.get("text", ""),
              json.dumps(req.get("linkedWPs", [])), i))


def _save_timeline_items(conn, project_id: str, phases: list,
                          parent_id, sort_offset: int = 0) -> None:
    for i, ph in enumerate(phases):
        conn.execute("""
            INSERT INTO timeline_items
                (id, project_id, parent_id, item_type, name, value, unit,
                 x, y, expanded, required_json,
                 start_date_override, end_date_override, sort_order)
            VALUES (?, ?, ?, 'phase', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (ph["id"], project_id, parent_id,
              ph.get("name", ""),
              float(ph.get("value", 2)), ph.get("unit", "weeks"),
              float(ph.get("x", 60)), float(ph.get("y", 60)),
              1 if ph.get("expanded", True) else 0,
              json.dumps(ph.get("required", {})),
              ph.get("startDateOverride"), ph.get("endDateOverride"),
              sort_offset + i))

        # Subphases
        for j, sub in enumerate(ph.get("children", [])):
            conn.execute("""
                INSERT INTO timeline_items
                    (id, project_id, parent_id, item_type, name, value, unit,
                     x, y, expanded, required_json,
                     start_date_override, end_date_override, sort_order)
                VALUES (?, ?, ?, 'subphase', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (sub["id"], project_id, ph["id"],
                  sub.get("name", ""),
                  float(sub.get("value", 1)), sub.get("unit", "weeks"),
                  float(sub.get("x", 0)), float(sub.get("y", 0)),
                  1 if sub.get("expanded", True) else 0,
                  json.dumps(sub.get("required", {})),
                  sub.get("startDateOverride"), sub.get("endDateOverride"),
                  j))
            _save_wps(conn, project_id, sub["id"], sub.get("workPackages", []))

        # Work packages directly in this phase
        _save_wps(conn, project_id, ph["id"], ph.get("workPackages", []))


def _save_wps(conn, project_id: str, parent_id: str, wps: list) -> None:
    for i, wp in enumerate(wps):
        conn.execute("""
            INSERT INTO timeline_items
                (id, project_id, parent_id, item_type, name, value, unit,
                 expanded, required_json, start_date_override, end_date_override,
                 sort_order, description, deliverables_json,
                 assigned_members_json, status)
            VALUES (?, ?, ?, 'work_package', ?, ?, ?,
                    1, '{}', ?, ?,
                    ?, ?, ?,
                    ?, ?)
        """, (wp["id"], project_id, parent_id,
              wp.get("name", ""), float(wp.get("value", 1)), wp.get("unit", "weeks"),
              wp.get("startDateOverride"), wp.get("endDateOverride"),
              i,
              wp.get("description", ""),
              json.dumps(wp.get("deliverables", [])),
              json.dumps(wp.get("assignedMembers", [])),
              wp.get("status", "not_started")))
