"""
TeamIQ – data models and Monte Carlo simulation engine.
"""
import uuid
import numpy as np

# ── Skill taxonomy ────────────────────────────────────────────────────────────
TECH_SKILLS = [
    "Frontend", "Backend", "DevOps", "Architecture", "UX/Design",
    "Data/Analytics", "QA/Testing", "Security", "Project Mgmt",
    "PSCAD", "PSS/E", "Power Factory", "Python", "Matlab", "Fortran", "C", "C++",
]
PERS_SKILLS = ["Collaboration", "Reliability", "Innovation", "Communication", "Leadership"]
ALL_SKILLS  = TECH_SKILLS + PERS_SKILLS

DURATION_UNITS = ["days", "weeks", "months", "years"]
WP_STATUSES    = ["not_started", "in_progress", "complete", "blocked"]

# ── Defaults ──────────────────────────────────────────────────────────────────
def default_skills() -> dict:
    return {sk: {"m": 5.0, "s": 1.5} for sk in ALL_SKILLS}

def uid() -> str:
    return str(uuid.uuid4())[:8]

# ── Duration helpers ──────────────────────────────────────────────────────────
_TO_WEEKS = {"days": 1/7, "weeks": 1.0, "months": 4.333, "years": 52.0}

def to_weeks(value: float, unit: str) -> float:
    """Normalise any duration to weeks for calculations."""
    return float(value) * _TO_WEEKS.get(unit, 1.0)

def phase_weeks(phase: dict) -> float:
    """Return the normalised week-duration of a phase (backward-compat)."""
    if "value" in phase and "unit" in phase:
        return to_weeks(phase["value"], phase["unit"])
    # Legacy field
    return float(phase.get("weeks", 2))

def new_phase(name="New Phase", value=2, unit="weeks",
              x=60, y=60, required=None) -> dict:
    return {
        "id":                "ph_" + uid(),
        "name":              name,
        "value":             value,
        "unit":              unit,
        "x":                 x,
        "y":                 y,
        "required":          required or {},
        "children":          [],       # subphases (same schema)
        "workPackages":      [],
        "expanded":          True,
        "startDateOverride": None,
        "endDateOverride":   None,
    }

def new_work_package(name="New Work Package") -> dict:
    return {
        "id":                "wp_" + uid(),
        "name":              name,
        "description":       "",
        "deliverables":      [],
        "assignedMembers":   [],
        "status":            "not_started",
        "value":             1,
        "unit":              "weeks",
        "startDateOverride": None,
        "endDateOverride":   None,
    }

# ── Org hierarchy types ───────────────────────────────────────────────────────
ORG_CHILD_TYPES = {
    "org":        ["division"],
    "division":   ["department"],
    "department": ["team"],
    "team":       ["person"],
    "person":     [],
}
ORG_TYPE_ICON  = {"org": "🏢", "division": "🏛", "department": "📂", "team": "👥", "person": "👤"}
ORG_TYPE_COLOR = {"org": "#f0a030", "division": "#9b7ee8", "department": "#4a9eff",
                  "team": "#1fb885", "person": "#e8eaf0"}

# ── Phase tree helpers ────────────────────────────────────────────────────────
def find_phase(phases: list, phid: str):
    """Depth-first search through top-level phases and their children."""
    for ph in phases:
        if ph["id"] == phid:
            return ph, phases
        found, parent_list = find_phase(ph.get("children", []), phid)
        if found is not None:
            return found, parent_list
    return None, None

def all_phases_flat(phases: list) -> list:
    """Return every phase and subphase as a flat list."""
    out = []
    for ph in phases:
        out.append(ph)
        out.extend(all_phases_flat(ph.get("children", [])))
    return out

def remove_phase_edges(proj: dict, phid: str):
    """Remove all edges touching phid (and recursively its children)."""
    ph, _ = find_phase(proj["phases"], phid)
    ids = {p["id"] for p in all_phases_flat([ph])} if ph else {phid}
    proj["phaseEdges"] = [e for e in proj.get("phaseEdges", [])
                          if e["from"] not in ids and e["to"] not in ids]

# ── Monte Carlo ───────────────────────────────────────────────────────────────
def run_monte_carlo(members: list, phases: list, org_nodes: dict, n: int = 2000) -> dict:
    """
    phases    – top-level phases only (children expanded inside)
    Returns   – {overall_prob, phase_prob[], team_exp{}}
    """
    # Flatten phases + subphases for simulation (each is independent check)
    flat = all_phases_flat(phases)

    if not members or not flat:
        return {"overall_prob": 0.0, "phase_prob": [0.0] * len(phases), "team_exp": {}}

    resolved = []
    for m in members:
        if m.get("orgId") and m["orgId"] in org_nodes:
            skills = org_nodes[m["orgId"]].get("skills", default_skills())
        else:
            skills = m.get("skills", default_skills())
        resolved.append(skills)

    n_members = len(resolved)
    n_skills  = len(ALL_SKILLS)

    means  = np.array([[resolved[mi].get(sk, {}).get("m", 5.0) for sk in ALL_SKILLS]
                       for mi in range(n_members)], dtype=float)
    sigmas = np.array([[resolved[mi].get(sk, {}).get("s", 1.5) for sk in ALL_SKILLS]
                       for mi in range(n_members)], dtype=float)

    noise   = np.random.randn(n, n_members, n_skills)
    samples = np.clip(means[None] + sigmas[None] * noise, 0.0, 10.0)
    eff     = samples.max(axis=1)  # (n, skills)

    team_exp = {sk: float(eff[:, si].mean()) for si, sk in enumerate(ALL_SKILLS)}

    # Phase probs — only top-level (each is the AND of itself + children)
    phase_prob = []
    _phase_ok_arrays = []
    all_ok = np.ones(n, dtype=bool)
    for ph in phases:
        ph_flat = all_phases_flat([ph])
        ph_ok   = np.ones(n, dtype=bool)
        for p in ph_flat:
            for sk, req in p.get("required", {}).items():
                if sk in ALL_SKILLS:
                    ph_ok &= eff[:, ALL_SKILLS.index(sk)] >= req
        phase_prob.append(float(ph_ok.mean()))
        _phase_ok_arrays.append(ph_ok)
        all_ok &= ph_ok

    def _ci95(arr):
        p = float(arr.mean())
        h = 1.96 * float(np.sqrt(max(p * (1 - p), 0) / len(arr)))
        return [round(max(0.0, p - h), 4), round(min(1.0, p + h), 4)]

    return {"overall_prob": float(all_ok.mean()),
            "overall_ci95": _ci95(all_ok),
            "phase_prob":   phase_prob,
            "phase_ci95":   [_ci95(arr) for arr in _phase_ok_arrays],
            "team_exp":     team_exp}


# ── Org tree helpers ──────────────────────────────────────────────────────────
def find_node(nodes: list, node_id: str):
    for n in nodes:
        if n["id"] == node_id: return n
        if n.get("children"):
            f = find_node(n["children"], node_id)
            if f: return f
    return None

def flat_persons(node, acc=None):
    if acc is None: acc = []
    if not node: return acc
    if node.get("type") == "person": acc.append(node)
    for c in node.get("children", []): flat_persons(c, acc)
    return acc

def flat_persons_under(node):
    if not node: return []
    if node.get("type") == "person": return [node]
    out = []
    for c in node.get("children", []): out.extend(flat_persons_under(c))
    return out

def build_org_lookup(org_root: dict) -> dict:
    lookup = {}
    def walk(n):
        lookup[n["id"]] = n
        for c in n.get("children", []): walk(c)
    walk(org_root)
    return lookup

def delete_node_from(nodes: list, node_id: str) -> bool:
    for i, n in enumerate(nodes):
        if n["id"] == node_id: nodes.pop(i); return True
        if n.get("children") and delete_node_from(n["children"], node_id): return True
    return False


# ── Seed data (delegated to seed_data.py) ────────────────────────────────────
from seed_data import seed_org as _seed_org_impl, seed_projects as _seed_projects_impl

def seed_org() -> dict:
    return _seed_org_impl()

def seed_projects() -> list:
    return _seed_projects_impl()
