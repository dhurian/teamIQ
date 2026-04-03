"""
services/org_service.py
────────────────────────
Business logic for the global organisation hierarchy.
Deleting a person node cascades into all project teams.
No Flask imports.
"""
from models import uid, default_skills, ORG_CHILD_TYPES, find_node, flat_persons_under, delete_node_from


def create_org_node(org: dict, data: dict) -> dict:
    """
    Add a child node under the parent identified by data['parentId'].
    Returns the new node.
    Raises KeyError if parent not found.
    Raises ValueError if the parent type cannot have children.
    """
    parent = find_node([org], data.get("parentId"))
    if not parent:
        raise KeyError("Parent not found")
    ctype = (ORG_CHILD_TYPES.get(parent["type"], []) or [None])[0]
    if not ctype:
        raise ValueError(f"Cannot add children to {parent['type']}")
    node = {
        "id":       "n_" + uid(),
        "type":     ctype,
        "name":     f"New {ctype.capitalize()}",
        "expanded": True,
        "children": [],
    }
    if ctype not in ("person", "org"):
        node["color"] = data.get("color", "#4a9eff")
    if ctype == "person":
        node["role"]   = ""
        node["skills"] = default_skills()
    parent.setdefault("children", []).append(node)
    parent["expanded"] = True
    return node


def update_org_node(org: dict, nid: str, data: dict) -> dict:
    """
    Apply field updates to node *nid*. Returns the node.
    Raises KeyError if not found.
    """
    node = find_node([org], nid)
    if not node:
        raise KeyError(f"Node {nid} not found")
    for f in ("name", "role", "color", "expanded"):
        if f in data:
            node[f] = data[f]
    if "skills" in data:
        node["skills"] = data["skills"]
    if "skill" in data:
        sk = data["skill"]
        node.setdefault("skills", default_skills())
        node["skills"][sk["name"]][sk["type"]] = float(sk["value"])
    return node


def delete_org_node(org: dict, nid: str, projects: list) -> set:
    """
    Remove node *nid* from the org tree and cascade-remove linked members
    from all project teams.
    Returns the set of removed person IDs so the caller can save both stores.
    Raises ValueError if *nid* is the root.
    Raises KeyError if not found.
    """
    if nid == org["id"]:
        raise ValueError("Cannot delete root")
    target     = find_node([org], nid)
    person_ids = {p["id"] for p in flat_persons_under(target or {})}
    if not delete_node_from(org.get("children", []), nid):
        raise KeyError(f"Node {nid} not found")
    # Cascade: remove linked members from every project team
    for proj in projects:
        for team in proj["teams"]:
            team["members"] = [m for m in team["members"]
                               if m.get("orgId") not in person_ids]
    return person_ids


def toggle_org_node(org: dict, nid: str) -> bool:
    """
    Toggle the expanded flag of node *nid*.
    Returns the new value of expanded.
    Raises KeyError if not found.
    """
    node = find_node([org], nid)
    if not node:
        raise KeyError(f"Node {nid} not found")
    node["expanded"] = not node.get("expanded", True)
    return node["expanded"]
