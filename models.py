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
        "id":           "ph_" + uid(),
        "name":         name,
        "value":        value,
        "unit":         unit,
        "x":            x,
        "y":            y,
        "required":     required or {},
        "children":     [],       # subphases (same schema)
        "workPackages": [],
        "expanded":     True,
    }

def new_work_package(name="New Work Package") -> dict:
    return {
        "id":               "wp_" + uid(),
        "name":             name,
        "description":      "",
        "deliverables":     [],
        "assignedMembers":  [],
        "status":           "not_started",
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
    all_ok = np.ones(n, dtype=bool)
    for ph in phases:
        ph_flat = all_phases_flat([ph])
        ph_ok   = np.ones(n, dtype=bool)
        for p in ph_flat:
            for sk, req in p.get("required", {}).items():
                if sk in ALL_SKILLS:
                    ph_ok &= eff[:, ALL_SKILLS.index(sk)] >= req
        phase_prob.append(float(ph_ok.mean()))
        all_ok &= ph_ok

    return {"overall_prob": float(all_ok.mean()),
            "phase_prob":   phase_prob,
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


# ── Seed data ─────────────────────────────────────────────────────────────────
def _sk(*pairs) -> dict:
    return {ALL_SKILLS[i]: {"m": float(pairs[i*2]), "s": float(pairs[i*2+1])}
            for i in range(len(ALL_SKILLS))}

def seed_org() -> dict:
    return {
        "id": "root", "type": "org", "name": "My Organization", "expanded": True,
        "children": [
            {"id": "d1", "type": "division", "name": "Engineering", "color": "#9b7ee8", "expanded": True, "children": [
                {"id": "dp1", "type": "department", "name": "Frontend & UX", "color": "#4a9eff", "expanded": True, "children": [
                    {"id": "t1", "type": "team", "name": "Frontend Squad", "color": "#4a9eff", "expanded": True, "children": [
                        {"id": "p1", "type": "person", "name": "Alice Chen",   "role": "Senior Frontend Dev", "skills": _sk(8.5,.8,5,1.2,3,1,6,1,6,.8,4,1.2,5,1,3,1,5,1.2,1,1.5,1,1.5,1,1.5,5,1.2,2,1.5,1,1.5,2,1.5,2,1.5,8,.7,9,.5,7,1,7,.8,6,1)},
                        {"id": "p2", "type": "person", "name": "Ben Torres",   "role": "Product Designer",    "skills": _sk(6,1,2,1.5,2,1,4,1.2,9,.5,5,1,4,1.2,2,1,6,1,1,1.5,1,1.5,1,1.5,2,1.5,1,1.5,1,1.5,1,1.5,1,1.5,9,.5,7,1,8,.8,8,.7,5,1.2)},
                    ]},
                ]},
                {"id": "dp2", "type": "department", "name": "Platform & Infrastructure", "color": "#1fb885", "expanded": True, "children": [
                    {"id": "t2", "type": "team", "name": "Platform Team", "color": "#1fb885", "expanded": True, "children": [
                        {"id": "p3", "type": "person", "name": "Carol Murphy", "role": "Backend / DevOps",    "skills": _sk(3,1.5,9,.6,8,.7,7,.9,2,1,6,1,6,1,7,.8,4,1.2,2,1.5,2,1.5,2,1.5,7,.9,3,1.5,3,1.5,6,1.2,5,1.2,6,1.2,9,.4,5,1.2,5,1.2,4,1.2)},
                        {"id": "p4", "type": "person", "name": "Dan Park",     "role": "Junior Full-Stack",   "skills": _sk(5,1.5,5,1.5,3,1.5,3,1.5,3,1.5,3,1.5,5,1.5,3,1.5,4,1.5,1,1.5,1,1.5,1,1.5,4,1.5,2,1.5,1,1.5,2,1.5,2,1.5,7,1,7,1.2,6,1.2,6,1.2,3,1.5)},
                    ]},
                ]},
                {"id": "dp3", "type": "department", "name": "Data & QA", "color": "#9b7ee8", "expanded": True, "children": [
                    {"id": "t3", "type": "team", "name": "Data & QA Team", "color": "#9b7ee8", "expanded": True, "children": [
                        {"id": "p5", "type": "person", "name": "Eva Rossi",    "role": "Data Engineer",       "skills": _sk(3,1.5,7,.9,5,1,5,1.2,2,1.5,9,.5,6,1,4,1.2,5,1.2,4,1.5,4,1.5,4,1.5,8,.7,7,.9,3,1.5,3,1.5,2,1.5,7,.9,8,.7,6,1,6,1,4,1.2)},
                        {"id": "p6", "type": "person", "name": "Frank Liu",    "role": "QA Lead",             "skills": _sk(5,1,5,1.2,4,1.2,4,1.2,4,1,5,1,9,.5,5,1,6,1,2,1.5,2,1.5,2,1.5,5,1.2,3,1.5,2,1.5,3,1.5,2,1.5,7,.9,8,.6,5,1.2,7,.8,6,1)},
                    ]},
                ]},
            ]},
            {"id": "d2", "type": "division", "name": "Power Systems", "color": "#f0a030", "expanded": True, "children": [
                {"id": "dp4", "type": "department", "name": "Simulation", "color": "#f0a030", "expanded": True, "children": [
                    {"id": "t4", "type": "team", "name": "Simulation Experts", "color": "#f0a030", "expanded": True, "children": [
                        {"id": "p7", "type": "person", "name": "Grace Kim",    "role": "Power Systems Eng.",  "skills": _sk(2,1.5,4,1.2,3,1.5,5,1.2,2,1.5,6,1,3,1.5,2,1.5,6,1,8,.7,7,.8,8,.6,8,.6,7,.8,5,1.2,3,1.5,2,1.5,7,.8,9,.4,6,1,6,1,5,1.2)},
                        {"id": "p8", "type": "person", "name": "Hassan Ali",   "role": "Simulation Engineer", "skills": _sk(1,1.5,3,1.5,2,1.5,4,1.2,2,1.5,7,.8,3,1.5,2,1.5,5,1.2,9,.5,8,.6,7,.8,7,.8,8,.6,7,.9,5,1.2,4,1.5,6,1,8,.6,7,.9,6,1,4,1.2)},
                    ]},
                ]},
                {"id": "dp5", "type": "department", "name": "Software Dev", "color": "#e87e5e", "expanded": True, "children": [
                    {"id": "t5", "type": "team", "name": "Simulation Dev", "color": "#e87e5e", "expanded": True, "children": [
                        {"id": "p9",  "type": "person", "name": "Priya Nair",  "role": "Matlab / Python Dev", "skills": _sk(3,1.5,6,1,4,1.2,5,1.2,2,1.5,8,.7,5,1.2,3,1.5,5,1.2,5,1.2,4,1.5,5,1.2,9,.5,8,.6,4,1.5,5,1.2,4,1.5,7,.8,8,.6,6,1,7,.8,5,1.2)},
                        {"id": "p10", "type": "person", "name": "Lukas Bauer", "role": "C / Fortran Dev",     "skills": _sk(2,1.5,5,1.2,4,1.2,5,1.2,1,1.5,6,1,4,1.2,3,1.5,4,1.5,3,1.5,3,1.5,3,1.5,7,.9,6,1,9,.5,8,.6,9,.5,6,1,8,.6,5,1.2,5,1.2,3,1.5)},
                    ]},
                ]},
            ]},
        ]
    }

def seed_projects() -> list:
    def ph(id, name, value, unit, x, y, required, children=None, wps=None):
        return {"id": id, "name": name, "value": value, "unit": unit,
                "x": x, "y": y, "required": required,
                "children": children or [], "workPackages": wps or [],
                "expanded": True}
    return [
        {
            "id": "proj1", "name": "Customer Portal v2", "color": "#4a9eff",
            "selTeamId": "team11", "selMemberId": None, "orgMode": "none",
            "teams": [
                {"id": "team11", "name": "Frontend Squad", "color": "#4a9eff", "x": 30,  "y": 40,  "members": [{"id": "m1", "orgId": "p1"}, {"id": "m2", "orgId": "p2"}]},
                {"id": "team12", "name": "Platform Team",  "color": "#1fb885", "x": 285, "y": 40,  "members": [{"id": "m3", "orgId": "p3"}, {"id": "m4", "orgId": "p4"}]},
                {"id": "team13", "name": "Data & QA",      "color": "#9b7ee8", "x": 157, "y": 210, "members": [{"id": "m5", "orgId": "p5"}, {"id": "m6", "orgId": "p6"}]},
            ],
            "connections": [
                {"id": "c11", "from": "team11", "to": "team12", "label": "API contracts", "type": "integration"},
                {"id": "c12", "from": "team12", "to": "team13", "label": "Data pipeline", "type": "dependency"},
                {"id": "c13", "from": "team11", "to": "team13", "label": "QA handoff",    "type": "handoff"},
            ],
            "phases": [
                ph("ph101","Discovery & Design",3,"weeks",60,60,
                   {"UX/Design":7,"Project Mgmt":6,"Frontend":5,"Collaboration":7},
                   children=[
                       ph("ph101a","Stakeholder Interviews",5,"days",0,0,{"Communication":7,"Collaboration":7}),
                       ph("ph101b","Wireframing",1,"weeks",0,0,{"UX/Design":8,"Frontend":5}),
                   ],
                   wps=[{"id":"wp1","name":"UX Research Report","description":"Synthesise user interviews","deliverables":["Interview notes","Persona document"],"assignedMembers":["m2"],"status":"not_started"}]),
                ph("ph102","Core Development",8,"weeks",60,210,
                   {"Frontend":8,"Backend":8,"Architecture":7,"Security":6,"Collaboration":6},
                   wps=[{"id":"wp2","name":"Auth Module","description":"Login, OAuth, session management","deliverables":["Auth API","Unit tests"],"assignedMembers":["m3","m1"],"status":"not_started"}]),
                ph("ph103","DevOps & Integration",3,"weeks",60,360,{"DevOps":8,"Backend":7,"Security":7,"Reliability":8}),
                ph("ph104","QA & Launch",2,"weeks",60,510,{"QA/Testing":7,"Frontend":6,"Communication":7,"Project Mgmt":6}),
            ],
            "phaseEdges": [
                {"id":"pe11","from":"ph101","to":"ph102"},
                {"id":"pe12","from":"ph102","to":"ph103"},
                {"id":"pe13","from":"ph103","to":"ph104"},
            ],
        },
        {
            "id": "proj2", "name": "Grid Simulation Suite", "color": "#1fb885",
            "selTeamId": "team21", "selMemberId": None, "orgMode": "none",
            "teams": [
                {"id": "team21", "name": "Power Systems", "color": "#f0a030", "x": 30,  "y": 40, "members": [{"id": "m7", "orgId": "p7"}, {"id": "m8", "orgId": "p8"}]},
                {"id": "team22", "name": "Dev Team",      "color": "#e87e5e", "x": 285, "y": 40, "members": [{"id": "m9", "orgId": "p9"}, {"id": "m10","orgId": "p10"}]},
            ],
            "connections": [{"id": "c21", "from": "team21", "to": "team22", "label": "Model specs", "type": "handoff"}],
            "phases": [
                ph("ph201","Requirements & Modelling",1,"months",60,60, {"PSCAD":6,"PSS/E":5,"Python":6,"Project Mgmt":7,"Collaboration":7}),
                ph("ph202","Simulation Development",10,"weeks",60,210,  {"PSCAD":8,"Power Factory":7,"Python":8,"Matlab":7,"Fortran":5}),
                ph("ph203","Validation & Testing",1,"months",60,360,    {"QA/Testing":7,"Python":7,"Matlab":6,"Data/Analytics":7,"Reliability":8}),
                ph("ph204","Reporting & Handover",2,"weeks",60,510,     {"Communication":8,"Project Mgmt":6,"Python":5}),
            ],
            "phaseEdges": [
                {"id":"pe21","from":"ph201","to":"ph202"},
                {"id":"pe22","from":"ph202","to":"ph203"},
                {"id":"pe23","from":"ph203","to":"ph204"},
            ],
        },
    ]
