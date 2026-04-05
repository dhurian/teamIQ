"""
services/resource_service.py
─────────────────────────────
Compute cross-project resource allocation per person.
No Flask imports.
"""
from models import build_org_lookup


# ── SECTION: compute allocation ───────────────────────────────────────────────

def compute_allocation(projects: list, global_org: dict) -> dict:
    """
    Walk all projects → teams → members and aggregate allocation % per person.

    A person is identified by their orgId (so the same real person appearing
    in multiple projects is collapsed into one entry).  Standalone members
    (no orgId) are tracked per member-id.

    Returns:
        {
          "people": [
            {
              "id":               str,   # orgId or member id
              "name":             str,
              "role":             str,
              "total_allocation": int,   # sum across all projects
              "status":           "overloaded" | "full" | "available",
              "projects": [
                {
                  "projectId":   str,
                  "projectName": str,
                  "color":       str,
                  "teamName":    str,
                  "memberId":    str,
                  "allocation":  int,
                }
              ]
            }
          ],
          "summary": {
            "total":      int,
            "overloaded": int,
            "full":       int,
            "available":  int,
          }
        }
    """
    org_lookup = build_org_lookup(global_org) if global_org else {}
    people: dict = {}

    for proj in projects:
        for team in proj.get("teams", []):
            for member in team.get("members", []):
                allocation = int(member.get("allocation", 100))
                org_id     = member.get("orgId")

                # Deduplicate by orgId so the same real person is one row
                key  = f"org:{org_id}" if org_id else f"m:{member['id']}"
                node = org_lookup.get(org_id, {}) if org_id else {}
                name = node.get("name") or member.get("name", "Unknown")
                role = node.get("role") or member.get("role", "")

                if key not in people:
                    people[key] = {
                        "id":               org_id or member["id"],
                        "name":             name,
                        "role":             role,
                        "total_allocation": 0,
                        "projects":         [],
                    }
                else:
                    if name and name != "Unknown":
                        people[key]["name"] = name
                    if role:
                        people[key]["role"] = role

                people[key]["total_allocation"] += allocation
                people[key]["projects"].append({
                    "projectId":   proj["id"],
                    "projectName": proj.get("name", ""),
                    "color":       proj.get("color", "#4a9eff"),
                    "teamName":    team.get("name", ""),
                    "memberId":    member["id"],
                    "allocation":  allocation,
                })

    # Classify and sort by total allocation descending
    result  = []
    summary = {"total": 0, "overloaded": 0, "full": 0, "available": 0}

    for p in sorted(people.values(), key=lambda x: -x["total_allocation"]):
        total = p["total_allocation"]
        if total > 100:
            p["status"] = "overloaded"
            summary["overloaded"] += 1
        elif total >= 80:
            p["status"] = "full"
            summary["full"] += 1
        else:
            p["status"] = "available"
            summary["available"] += 1
        summary["total"] += 1
        result.append(p)

    return {"people": result, "summary": summary}
