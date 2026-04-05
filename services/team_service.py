"""
services/team_service.py
─────────────────────────
Business logic for teams, members, connections, and org-member import.
No Flask imports.
"""
import copy
from models import uid, default_skills, build_org_lookup


# ── SECTION: teams (create_team, update_team, delete_team) ───────────────────

def create_team(proj: dict, data: dict) -> dict:
    """Append a new team to *proj* and return it. Also sets selTeamId."""
    team_id = "team_" + uid()
    team = {
        "id":      team_id,
        "name":    data.get("name", "New Team"),
        "color":   data.get("color", "#4a9eff"),
        "x":       data.get("x", 30),
        "y":       data.get("y", 40),
        "members": [],
    }
    proj["teams"].append(team)
    proj["selTeamId"] = team_id
    return team


def update_team(proj: dict, tid: str, data: dict) -> dict:
    """Apply field updates to team *tid*. Returns the team."""
    team = _find_team(proj, tid)
    for f in ("name", "color", "x", "y"):
        if f in data:
            team[f] = data[f]
    return team


def delete_team(proj: dict, tid: str) -> None:
    """
    Remove team *tid* and any connections involving it.
    Raises ValueError if it is the last team.
    Raises KeyError if not found.
    """
    if not any(t["id"] == tid for t in proj["teams"]):
        raise KeyError(f"Team {tid} not found")
    if len(proj["teams"]) <= 1:
        raise ValueError("Must keep at least one team")
    proj["teams"]       = [t for t in proj["teams"] if t["id"] != tid]
    proj["connections"] = [c for c in proj.get("connections", [])
                           if c["from"] != tid and c["to"] != tid]
    if proj.get("selTeamId") == tid:
        proj["selTeamId"] = proj["teams"][0]["id"] if proj["teams"] else None


# ── SECTION: members (create_member, update_member, delete_member, move_member, unlink_member, import_org_members) ──

def create_member(proj: dict, tid: str, data: dict) -> dict:
    """Add a member to team *tid*. Returns the new member dict."""
    team = _find_team(proj, tid)
    mid  = "m_" + uid()
    member = {"id": mid, "allocation": int(data.get("allocation", 100))}
    if data.get("orgId"):
        member["orgId"] = data["orgId"]
    else:
        member["name"]   = data.get("name", "New Colleague")
        member["role"]   = data.get("role", "Role")
        member["skills"] = default_skills()
    team["members"].append(member)
    proj["selMemberId"] = mid
    return member


def update_member(proj: dict, mid: str, data: dict) -> dict:
    """Find member *mid* across all teams and apply updates. Returns the member."""
    for team in proj["teams"]:
        member = next((m for m in team["members"] if m["id"] == mid), None)
        if member:
            for f in ("name", "role"):
                if f in data:
                    member[f] = data[f]
            if "allocation" in data:
                member["allocation"] = max(0, min(200, int(data["allocation"])))
            if "skills" in data:
                member["skills"] = data["skills"]
            if "skill" in data:
                sk = data["skill"]
                member.setdefault("skills", default_skills())
                member["skills"][sk["name"]][sk["type"]] = float(sk["value"])
            return member
    raise KeyError(f"Member {mid} not found")


def delete_member(proj: dict, mid: str) -> None:
    """Remove member *mid* from its team. Raises KeyError if not found."""
    for team in proj["teams"]:
        before = len(team["members"])
        team["members"] = [m for m in team["members"] if m["id"] != mid]
        if len(team["members"]) < before:
            if proj.get("selMemberId") == mid:
                proj["selMemberId"] = None
            return
    raise KeyError(f"Member {mid} not found")


def move_member(proj: dict, mid: str, to_tid: str) -> None:
    """
    Move member *mid* to team *to_tid*.
    Raises KeyError if member or destination team not found.
    """
    member = None
    for team in proj["teams"]:
        idx = next((i for i, m in enumerate(team["members"]) if m["id"] == mid), None)
        if idx is not None:
            member = team["members"].pop(idx)
            break
    if not member:
        raise KeyError(f"Member {mid} not found")
    dest = _find_team(proj, to_tid)
    dest["members"].append(member)
    proj["selTeamId"] = to_tid


def unlink_member(proj: dict, mid: str, global_org: dict) -> dict:
    """
    Convert an org-linked member into a standalone member by copying
    name/role/skills from the org node. Returns the updated member.
    Raises KeyError if member not found or not linked.
    """
    lookup = build_org_lookup(global_org)
    for team in proj["teams"]:
        member = next((m for m in team["members"] if m["id"] == mid), None)
        if member and member.get("orgId"):
            node = lookup.get(member["orgId"], {})
            member["name"]   = node.get("name", "Unknown")
            member["role"]   = node.get("role", "")
            member["skills"] = copy.deepcopy(node.get("skills", default_skills()))
            del member["orgId"]
            return member
    raise KeyError(f"Member {mid} not found or not linked")


def import_org_members(proj: dict, tid: str, org_ids: list, global_org: dict) -> int:
    """
    Add org-linked members from *org_ids* into team *tid*, skipping duplicates.
    Returns the count of newly added members.
    Raises KeyError if team not found.
    """
    team   = _find_team(proj, tid)
    lookup = build_org_lookup(global_org)
    already = {m["orgId"] for t in proj["teams"]
               for m in t["members"] if m.get("orgId")}
    added = 0
    for oid in org_ids:
        if oid not in already and oid in lookup:
            team["members"].append({"id": "m_" + uid(), "orgId": oid})
            already.add(oid)
            added += 1
    proj["selTeamId"] = tid
    return added


# ── SECTION: connections (add_connection, update_connection, delete_connection) ─

def add_connection(proj: dict, data: dict) -> dict:
    """
    Add a connection between two teams. Returns the new connection dict.
    Raises ValueError for self-connections.
    """
    frm = data.get("from")
    to  = data.get("to")
    if frm == to:
        raise ValueError("Cannot connect a team to itself")
    conn = {
        "id":    "c_" + uid(),
        "from":  frm,
        "to":    to,
        "label": data.get("label", ""),
        "type":  data.get("type", "integration"),
    }
    proj.setdefault("connections", []).append(conn)
    return conn


def update_connection(proj: dict, cid: str, data: dict) -> dict:
    """Update label/type of connection *cid*. Raises KeyError if not found."""
    conn = next((c for c in proj.get("connections", []) if c["id"] == cid), None)
    if not conn:
        raise KeyError(f"Connection {cid} not found")
    for f in ("label", "type"):
        if f in data:
            conn[f] = data[f]
    return conn


def delete_connection(proj: dict, cid: str) -> None:
    """Remove connection *cid* from *proj* (silent if already missing)."""
    proj["connections"] = [c for c in proj.get("connections", []) if c["id"] != cid]


# ── SECTION: internal helpers (_find_team) ────────────────────────────────────

def _find_team(proj: dict, tid: str) -> dict:
    team = next((t for t in proj["teams"] if t["id"] == tid), None)
    if not team:
        raise KeyError(f"Team {tid} not found")
    return team
