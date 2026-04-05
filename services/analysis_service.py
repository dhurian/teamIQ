"""
services/analysis_service.py
──────────────────────────────
Bottleneck detection and recommendation generation.
No Flask imports — all functions take/return plain dicts.
"""
from models import run_monte_carlo, build_org_lookup, all_phases_flat, phase_weeks


# ── SECTION: bottleneck detection (detect_bottlenecks) ───────────────────────

def detect_bottlenecks(proj: dict, global_org: dict, n_runs: int = 2000) -> dict:
    """
    Run Monte Carlo and identify skill bottlenecks.
    Returns {bottlenecks, simulation, critical_count}.
    """
    lookup  = build_org_lookup(global_org)
    members = [m for t in proj["teams"] for m in t["members"]]
    result  = run_monte_carlo(members, proj["phases"], lookup, n=n_runs)

    team_exp = result.get("team_exp", {})
    flat     = all_phases_flat(proj["phases"])

    # Build per-skill aggregated requirements across all phases
    skill_req: dict[str, dict] = {}
    for ph in flat:
        for sk, req in ph.get("required", {}).items():
            if sk not in skill_req:
                skill_req[sk] = {"max_req": 0.0, "phases_affected": []}
            if req > skill_req[sk]["max_req"]:
                skill_req[sk]["max_req"] = float(req)
            if ph["name"] not in skill_req[sk]["phases_affected"]:
                skill_req[sk]["phases_affected"].append(ph["name"])

    bottlenecks = []
    for sk, info in skill_req.items():
        req = info["max_req"]
        av  = float(team_exp.get(sk, 0.0))
        gap = max(0.0, req - av)
        cov = min(1.0, av / req) if req > 0 else 1.0

        # Severity = gap magnitude × number of phases affected
        severity = gap * len(info["phases_affected"])

        bottlenecks.append({
            "skill":           sk,
            "required":        round(req, 2),
            "available":       round(av, 2),
            "gap":             round(gap, 2),
            "coverage":        round(cov, 3),
            "severity":        round(severity, 3),
            "phases_affected": info["phases_affected"],
            "is_critical":     cov < 0.85,
        })

    bottlenecks.sort(key=lambda x: x["severity"], reverse=True)

    return {
        "bottlenecks":    bottlenecks,
        "simulation":     result,
        "critical_count": sum(1 for b in bottlenecks if b["is_critical"]),
    }


# ── SECTION: recommendation generation (generate_recommendations) ────────────

_PRIORITY_ORDER = {"critical": 0, "high": 1, "medium": 2, "low": 3}

_TYPE_ICONS = {
    "train":     "🎓",
    "hire":      "🧑‍💼",
    "strategic": "🏗",
}


def generate_recommendations(proj: dict, global_org: dict,
                              bottlenecks: list | None = None) -> dict:
    """
    Given a list of bottlenecks (or runs detection if not supplied),
    return actionable recommendations sorted by priority.
    """
    if bottlenecks is None:
        result    = detect_bottlenecks(proj, global_org)
        bottlenecks = result["bottlenecks"]

    recs = []
    for b in bottlenecks:
        gap = b["gap"]
        if gap <= 0:
            continue  # no gap, no recommendation

        sk     = b["skill"]
        phases = b["phases_affected"]
        av     = b["available"]
        req    = b["required"]
        cov    = b["coverage"]
        n_ph   = len(phases)
        ph_str = ", ".join(phases[:2]) + ("…" if n_ph > 2 else "")

        if gap < 1.5:
            recs.append({
                "type":     "train",
                "priority": "medium" if cov >= 0.7 else "high",
                "skill":    sk,
                "icon":     _TYPE_ICONS["train"],
                "action":   f"Upskill team in {sk}",
                "detail":   (f"Current level {av:.1f}/10, need {req:.1f}/10. "
                             f"A {gap:.1f}-point gap affects {ph_str}."),
                "impact":   f"Closes {gap:.1f}-pt gap across {n_ph} phase(s)",
            })
        elif gap < 3.0:
            recs.append({
                "type":     "hire",
                "priority": "high",
                "skill":    sk,
                "icon":     _TYPE_ICONS["hire"],
                "action":   f"Recruit a {sk} specialist",
                "detail":   (f"Team at {av:.1f}/10, need {req:.1f}/10 — "
                             f"gap is too large for internal training alone."),
                "impact":   f"Resolves {gap:.1f}-pt deficit in {n_ph} phase(s): {ph_str}",
            })
        else:
            recs.append({
                "type":     "strategic",
                "priority": "critical",
                "skill":    sk,
                "icon":     _TYPE_ICONS["strategic"],
                "action":   f"Strategic action needed for {sk}",
                "detail":   (f"Critical gap of {gap:.1f} pts (team {av:.1f}/10 vs "
                             f"required {req:.1f}/10). Consider outsourcing or "
                             f"descoping {sk} requirements."),
                "impact":   f"Affects {n_ph} phase(s): {ph_str}",
            })

    recs.sort(key=lambda r: _PRIORITY_ORDER.get(r["priority"], 9))
    return {"recommendations": recs, "count": len(recs)}


# ── SECTION: critical chain (critical_chain_report) ───────────────────────────

def _build_phase_graph(phases_flat: list, phase_edges: list) -> dict:
    """Returns {phase_id: [downstream_phase_ids]} adjacency dict."""
    ids = {ph["id"] for ph in phases_flat}
    graph: dict[str, list] = {ph["id"]: [] for ph in phases_flat}
    for edge in phase_edges:
        src, dst = edge.get("from"), edge.get("to")
        if src in ids and dst in ids:
            graph[src].append(dst)
    return graph


def _topo_sort(graph: dict) -> list:
    """
    Kahn's algorithm — returns topologically sorted node list.
    Returns empty list if a cycle is detected.
    """
    in_deg: dict[str, int] = {n: 0 for n in graph}
    for neighbours in graph.values():
        for nb in neighbours:
            if nb in in_deg:
                in_deg[nb] += 1

    queue = [n for n, d in in_deg.items() if d == 0]
    order: list[str] = []
    while queue:
        node = queue.pop(0)
        order.append(node)
        for nb in graph.get(node, []):
            in_deg[nb] -= 1
            if in_deg[nb] == 0:
                queue.append(nb)

    return order if len(order) == len(graph) else []  # empty = cycle


def _longest_path(graph: dict, durations: dict) -> list:
    """
    Returns the list of node ids on the longest (critical) path.
    Assumes *graph* is a DAG (run _topo_sort first to verify).
    """
    topo = _topo_sort(graph)
    if not topo:
        return list(graph.keys())  # cycle fallback — return all

    dist:  dict[str, float] = {n: 0.0 for n in graph}
    prev:  dict[str, str | None] = {n: None for n in graph}

    for node in topo:
        for nb in graph.get(node, []):
            new_dist = dist[node] + durations.get(node, 0.0)
            if new_dist > dist[nb]:
                dist[nb] = new_dist
                prev[nb] = node

    # Trace back from the node with the longest distance
    end = max(dist, key=lambda n: dist[n] + durations.get(n, 0.0))
    path: list[str] = []
    cur: str | None = end
    while cur is not None:
        path.append(cur)
        cur = prev.get(cur)
    path.reverse()
    return path


def _count_downstream(node: str, graph: dict) -> list:
    """BFS — returns list of all reachable node ids from *node* (exclusive)."""
    visited: set[str] = set()
    queue = list(graph.get(node, []))
    while queue:
        n = queue.pop(0)
        if n not in visited:
            visited.add(n)
            queue.extend(graph.get(n, []))
    return list(visited)


def critical_chain_report(proj: dict) -> dict:
    """
    Compute the critical (longest) dependency chain through the project's
    phase graph.

    Returns:
      {
        "chain": [
          {
            "phaseId": str,
            "phaseName": str,
            "duration_weeks": float,
            "blocks_count": int,        # how many phases fail if this one is late
            "blocked_phases": [str],    # names of those phases
          }, ...
        ],
        "total_chain_weeks": float,
        "has_cycle": bool,
      }
    """
    flat        = all_phases_flat(proj.get("phases", []))
    phase_edges = proj.get("phaseEdges", [])
    id_to_phase = {ph["id"]: ph for ph in flat}

    graph     = _build_phase_graph(flat, phase_edges)
    topo      = _topo_sort(graph)
    has_cycle = len(topo) == 0

    durations = {ph["id"]: phase_weeks(ph) for ph in flat}
    chain_ids = _longest_path(graph, durations)

    chain = []
    for pid in chain_ids:
        ph   = id_to_phase.get(pid, {})
        down = _count_downstream(pid, graph)
        chain.append({
            "phaseId":        pid,
            "phaseName":      ph.get("name", pid),
            "duration_weeks": round(durations.get(pid, 0.0), 1),
            "blocks_count":   len(down),
            "blocked_phases": [id_to_phase[d]["name"]
                               for d in down if d in id_to_phase],
        })

    total = sum(durations.get(pid, 0.0) for pid in chain_ids)

    return {
        "chain":             chain,
        "total_chain_weeks": round(total, 1),
        "has_cycle":         has_cycle,
    }
