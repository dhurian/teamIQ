"""
Seed/sample data payloads for TeamIQ.

Separated from models.py to keep core modeling + simulation logic lightweight.
"""


def _sk(all_skills, *pairs) -> dict:
    return {all_skills[i]: {"m": float(pairs[i * 2]), "s": float(pairs[i * 2 + 1])}
            for i in range(len(all_skills))}


def seed_org(all_skills) -> dict:
    return {
        "id": "root", "type": "org", "name": "My Organization", "expanded": True,
        "children": [
            {"id": "d1", "type": "division", "name": "Engineering", "color": "#9b7ee8", "expanded": True, "children": [
                {"id": "dp1", "type": "department", "name": "Frontend & UX", "color": "#4a9eff", "expanded": True, "children": [
                    {"id": "t1", "type": "team", "name": "Frontend Squad", "color": "#4a9eff", "expanded": True, "children": [
                        {"id": "p1", "type": "person", "name": "Alice Chen",   "role": "Senior Frontend Dev", "skills": _sk(all_skills, 8.5,.8,5,1.2,3,1,6,1,6,.8,4,1.2,5,1,3,1,5,1.2,1,1.5,1,1.5,1,1.5,5,1.2,2,1.5,1,1.5,2,1.5,2,1.5,8,.7,9,.5,7,1,7,.8,6,1)},
                        {"id": "p2", "type": "person", "name": "Ben Torres",   "role": "Product Designer",    "skills": _sk(all_skills, 6,1,2,1.5,2,1,4,1.2,9,.5,5,1,4,1.2,2,1,6,1,1,1.5,1,1.5,1,1.5,2,1.5,1,1.5,1,1.5,1,1.5,1,1.5,9,.5,7,1,8,.8,8,.7,5,1.2)},
                    ]},
                ]},
                {"id": "dp2", "type": "department", "name": "Platform & Infrastructure", "color": "#1fb885", "expanded": True, "children": [
                    {"id": "t2", "type": "team", "name": "Platform Team", "color": "#1fb885", "expanded": True, "children": [
                        {"id": "p3", "type": "person", "name": "Carol Murphy", "role": "Backend / DevOps",    "skills": _sk(all_skills, 3,1.5,9,.6,8,.7,7,.9,2,1,6,1,6,1,7,.8,4,1.2,2,1.5,2,1.5,2,1.5,7,.9,3,1.5,3,1.5,6,1.2,5,1.2,6,1.2,9,.4,5,1.2,5,1.2,4,1.2)},
                        {"id": "p4", "type": "person", "name": "Dan Park",     "role": "Junior Full-Stack",   "skills": _sk(all_skills, 5,1.5,5,1.5,3,1.5,3,1.5,3,1.5,3,1.5,5,1.5,3,1.5,4,1.5,1,1.5,1,1.5,1,1.5,4,1.5,2,1.5,1,1.5,2,1.5,2,1.5,7,1,7,1.2,6,1.2,6,1.2,3,1.5)},
                    ]},
                ]},
                {"id": "dp3", "type": "department", "name": "Data & QA", "color": "#9b7ee8", "expanded": True, "children": [
                    {"id": "t3", "type": "team", "name": "Data & QA Team", "color": "#9b7ee8", "expanded": True, "children": [
                        {"id": "p5", "type": "person", "name": "Eva Rossi",    "role": "Data Engineer",       "skills": _sk(all_skills, 3,1.5,7,.9,5,1,5,1.2,2,1.5,9,.5,6,1,4,1.2,5,1.2,4,1.5,4,1.5,4,1.5,8,.7,7,.9,3,1.5,3,1.5,2,1.5,7,.9,8,.7,6,1,6,1,4,1.2)},
                        {"id": "p6", "type": "person", "name": "Frank Liu",    "role": "QA Lead",             "skills": _sk(all_skills, 5,1,5,1.2,4,1.2,4,1.2,4,1,5,1,9,.5,5,1,6,1,2,1.5,2,1.5,2,1.5,5,1.2,3,1.5,2,1.5,3,1.5,2,1.5,7,.9,8,.6,5,1.2,7,.8,6,1)},
                    ]},
                ]},
            ]},
            {"id": "d2", "type": "division", "name": "Power Systems", "color": "#f0a030", "expanded": True, "children": [
                {"id": "dp4", "type": "department", "name": "Simulation", "color": "#f0a030", "expanded": True, "children": [
                    {"id": "t4", "type": "team", "name": "Simulation Experts", "color": "#f0a030", "expanded": True, "children": [
                        {"id": "p7", "type": "person", "name": "Grace Kim",    "role": "Power Systems Eng.",  "skills": _sk(all_skills, 2,1.5,4,1.2,3,1.5,5,1.2,2,1.5,6,1,3,1.5,2,1.5,6,1,8,.7,7,.8,8,.6,8,.6,7,.8,5,1.2,3,1.5,2,1.5,7,.8,9,.4,6,1,6,1,5,1.2)},
                        {"id": "p8", "type": "person", "name": "Hassan Ali",   "role": "Simulation Engineer", "skills": _sk(all_skills, 1,1.5,3,1.5,2,1.5,4,1.2,2,1.5,7,.8,3,1.5,2,1.5,5,1.2,9,.5,8,.6,7,.8,7,.8,8,.6,7,.9,5,1.2,4,1.5,6,1,8,.6,7,.9,6,1,4,1.2)},
                    ]},
                ]},
                {"id": "dp5", "type": "department", "name": "Software Dev", "color": "#e87e5e", "expanded": True, "children": [
                    {"id": "t5", "type": "team", "name": "Simulation Dev", "color": "#e87e5e", "expanded": True, "children": [
                        {"id": "p9",  "type": "person", "name": "Priya Nair",  "role": "Matlab / Python Dev", "skills": _sk(all_skills, 3,1.5,6,1,4,1.2,5,1.2,2,1.5,8,.7,5,1.2,3,1.5,5,1.2,5,1.2,4,1.5,5,1.2,9,.5,8,.6,4,1.5,5,1.2,4,1.5,7,.8,8,.6,6,1,7,.8,5,1.2)},
                        {"id": "p10", "type": "person", "name": "Lukas Bauer", "role": "C / Fortran Dev",     "skills": _sk(all_skills, 2,1.5,5,1.2,4,1.2,5,1.2,1,1.5,6,1,4,1.2,3,1.5,4,1.5,3,1.5,3,1.5,3,1.5,7,.9,6,1,9,.5,8,.6,9,.5,6,1,8,.6,5,1.2,5,1.2,3,1.5)},
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
                ph("ph101", "Discovery & Design", 3, "weeks", 60, 60,
                   {"UX/Design": 7, "Project Mgmt": 6, "Frontend": 5, "Collaboration": 7},
                   children=[
                       ph("ph101a", "Stakeholder Interviews", 5, "days", 0, 0, {"Communication": 7, "Collaboration": 7}),
                       ph("ph101b", "Wireframing", 1, "weeks", 0, 0, {"UX/Design": 8, "Frontend": 5}),
                   ],
                   wps=[{"id": "wp1", "name": "UX Research Report", "description": "Synthesise user interviews", "deliverables": ["Interview notes", "Persona document"], "assignedMembers": ["m2"], "status": "not_started"}]),
                ph("ph102", "Core Development", 8, "weeks", 60, 210,
                   {"Frontend": 8, "Backend": 8, "Architecture": 7, "Security": 6, "Collaboration": 6},
                   wps=[{"id": "wp2", "name": "Auth Module", "description": "Login, OAuth, session management", "deliverables": ["Auth API", "Unit tests"], "assignedMembers": ["m3", "m1"], "status": "not_started"}]),
                ph("ph103", "DevOps & Integration", 3, "weeks", 60, 360, {"DevOps": 8, "Backend": 7, "Security": 7, "Reliability": 8}),
                ph("ph104", "QA & Launch", 2, "weeks", 60, 510, {"QA/Testing": 7, "Frontend": 6, "Communication": 7, "Project Mgmt": 6}),
            ],
            "phaseEdges": [
                {"id": "pe11", "from": "ph101", "to": "ph102"},
                {"id": "pe12", "from": "ph102", "to": "ph103"},
                {"id": "pe13", "from": "ph103", "to": "ph104"},
            ],
        },
        {
            "id": "proj2", "name": "Grid Simulation Suite", "color": "#1fb885",
            "selTeamId": "team21", "selMemberId": None, "orgMode": "none",
            "teams": [
                {"id": "team21", "name": "Power Systems", "color": "#f0a030", "x": 30,  "y": 40, "members": [{"id": "m7", "orgId": "p7"}, {"id": "m8", "orgId": "p8"}]},
                {"id": "team22", "name": "Dev Team",      "color": "#e87e5e", "x": 285, "y": 40, "members": [{"id": "m9", "orgId": "p9"}, {"id": "m10", "orgId": "p10"}]},
            ],
            "connections": [{"id": "c21", "from": "team21", "to": "team22", "label": "Model specs", "type": "handoff"}],
            "phases": [
                ph("ph201", "Requirements & Modelling", 1, "months", 60, 60, {"PSCAD": 6, "PSS/E": 5, "Python": 6, "Project Mgmt": 7, "Collaboration": 7}),
                ph("ph202", "Simulation Development", 10, "weeks", 60, 210,  {"PSCAD": 8, "Power Factory": 7, "Python": 8, "Matlab": 7, "Fortran": 5}),
                ph("ph203", "Validation & Testing", 1, "months", 60, 360,    {"QA/Testing": 7, "Python": 7, "Matlab": 6, "Data/Analytics": 7, "Reliability": 8}),
                ph("ph204", "Reporting & Handover", 2, "weeks", 60, 510,     {"Communication": 8, "Project Mgmt": 6, "Python": 5}),
            ],
            "phaseEdges": [
                {"id": "pe21", "from": "ph201", "to": "ph202"},
                {"id": "pe22", "from": "ph202", "to": "ph203"},
                {"id": "pe23", "from": "ph203", "to": "ph204"},
            ],
        },
    ]
