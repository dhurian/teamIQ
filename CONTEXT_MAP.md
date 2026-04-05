# TeamIQ Context Map (token-efficient)

Load ONLY the files listed for each change type.
Use `grep "SECTION:" <file>` to get line numbers, then `Read` with offset+limit to load only the relevant section.

---

## ① Timeline — bar drag / resize
```
static/js/timeline_render.js   SECTION: bar drag  (lines ~1–154)
static/js/state.js             only if adding a new drag state variable
static/js/timeline_utils.js   only if changing date/duration math
```

## ② Timeline — scheduling / row layout
```
static/js/timeline_scheduling.js   buildGanttRows, precedence logic
static/js/timeline_utils.js        task accessors, date helpers
```

## ③ Timeline — inspector panel (floating detail)
```
static/js/timeline_inspector.js   all inspector HTML + drag
static/js/timeline_scheduling.js  only if reading task/predecessor data
```

## ④ Timeline — main render (header, grid, SVG bars)
```
static/js/timeline_render.js   SECTION: main render (renderTimeline)  (lines ~198–346)
static/js/timeline_scheduling.js   only if changing row structure
```

## ⑤ Analysis — bottleneck cards or severity logic
```
services/analysis_service.py             detect_bottlenecks()
static/js/panel_analysis_cards.js        SECTION: bottleneck cards  (_buildBnCards)
```

## ⑥ Analysis — recommendation cards or priority logic
```
services/analysis_service.py             generate_recommendations()
static/js/panel_analysis_cards.js        SECTION: recommendation cards  (_buildRecCards)
```

## ⑦ Analysis — scenario compare
```
blueprints/simulation.py                 POST /api/scenarios/compare
static/js/panel_analysis_scenario.js     SECTION: run comparison  (runScenarioCompare)
services/project_service.py              SECTION: clone  (only for clone changes)
```

## ⑧ Analysis — charts (skill coverage, phase probabilities, CI)
```
static/js/panel_analysis_charts.js       SECTION: chart init  (_initAnalysisCharts)
models.py                                SECTION: Monte Carlo  (only if changing CI calc)
```

## ⑨ Analysis — KPI metrics / gap calculations
```
static/js/panel_analysis.js              SECTION: KPI + gap calculations
services/analysis_service.py             only if changing bottleneck scoring
```

## ⑩ Monte Carlo simulation
```
models.py                            SECTION: Monte Carlo  (run_monte_carlo)
services/simulation_service.py       simulate_project / simulate_portfolio
blueprints/simulation.py             route only if adding endpoint
```

## ⑪ New phase or WP field
```
models.py                            new_phase() or new_work_package()
services/project_service.py          SECTION: schema normalisation  (normalize_projects)
blueprints/phases.py                 SECTION: top-level phases  OR  SECTION: subphases
blueprints/work_packages.py          PATCH allowed fields
static/js/phase_card.js              display in card
static/js/timeline_render.js         SECTION: SVG row generation  (only if shown in gantt)
tests/test_api_phases.py             SECTION: TestUpdatePhase  (if changing patch fields)
tests/test_service_phases.py         SECTION: update_phase
```

## ⑫ Phase diagram (SVG canvas, node drag, edges, auto-layout)
```
static/js/phase_diagram.js          entire file (~212 lines)
static/js/panel_phases_helpers.js   constants: PH_W, PH_H, pdMode, pdPan, pdZoom
```

## ⑬ Phase card display (collapsed / expanded / WP rows)
```
static/js/phase_card.js             phaseCard(), wpRow()
static/js/phase_actions.js          selectPhase() — only if selection changes
```

## ⑭ Org hierarchy — map / tree / editor UI
```
static/js/panel_org_hier.js   buildOrgMap, buildOrgDetail, buildOrgEditor, renderOrgHier, computeLayout
```

## ⑮ Org hierarchy — node or skill data
```
services/org_service.py        CRUD logic
blueprints/org.py              HTTP routes
static/js/panel_org_hier.js   SECTION: org-editor  (orgSkillRow, buildOrgEditor)
```

## ⑯ Team / member changes
```
services/team_service.py            SECTION: teams  OR  SECTION: members
blueprints/teams.py                 SECTION: teams  OR  SECTION: members  OR  SECTION: connections
static/js/panel_teams.js            display
static/js/api_actions.js            SECTION: teams + members
tests/test_api_teams.py             SECTION: TestAddTeam … TestConnections
tests/test_service_teams.py         SECTION: create_team … import_org_members
```

## ⑰ Project CRUD (create, update, delete, clone, import/export)
```
services/project_service.py         full file (~168 lines)
blueprints/projects.py              routes
static/js/api_actions.js            SECTION: projects
tests/test_api_projects.py          SECTION: TestAddProject … TestDeleteProject
tests/test_service_projects.py      SECTION: create_project … delete_project
```

## ⑱ Org chart — SVG canvas, node drag, connect mode
```
static/js/panel_orgchart.js         SECTION: main render  (renderOrgChart)
static/js/api_actions.js            SECTION: org chart — connect mode + node layout
static/js/panel_orgchart.js         SECTION: svg-events  (initProjOrgEvents)  — drag/pan/zoom only
static/js/panel_orgchart.js         SECTION: lightweight redraw  (_redrawOrgChart)  — drag perf only
```

## ⑲ Resource allocation — cross-project workload panel
```
services/resource_service.py        compute_allocation()  — deduplicate by orgId, sum per person
blueprints/resources.py             SECTION: resource allocation  (GET /api/resources)
static/js/panel_resources.js        SECTION: main render  (renderResources, _renderResourcesContent)
static/js/panel_resources.js        SECTION: person row   (_resPersonRow)  — stacked bar + chips
static/js/panel_resources.js        SECTION: filter toggle  (_resSetFilter)
static/js/panel_teams.js            allocation slider in member editor  (alloc range 0–200)
static/js/api_actions.js            SECTION: teams + members  (patchMemberAlloc — fire-and-forget)
services/project_service.py         SECTION: schema normalisation  (member.setdefault allocation)
services/team_service.py            SECTION: members  (create/update allocation field)
app.py                              resources_bp registration
```

## ⑳ New API endpoint (new blueprint)
```
app.py                              register blueprint
blueprints/<name>.py                thin HTTP wrapper (create new)
services/<name>_service.py          business logic (create new)
```

## ㉑ Styling only
```
static/css/app.css                  full file (~131 lines)
```

## ㉒ Sidebar / navigation / tab routing
```
static/js/sidebar.js                full file (~50 lines)
```

## ㉓ Business case
```
static/js/panel_bizcase.js          full file (~91 lines)
```

## ㉔ Requirements
```
static/js/panel_reqs.js             full file (~57 lines)
services/requirement_service.py     business logic
blueprints/requirements.py          routes
```

---

## Dead files — DELETED
```
panel_timeline.js         443 lines  ┐
panel_timeline_helpers.js 122 lines  │  deleted — superseded by
timeline_events.js         89 lines  │  timeline_render.js + timeline_scheduling.js
timeline_layout.js        169 lines  │
timeline_svg.js            72 lines  ┘  (895 lines total removed)
panel_org_hier_helpers.js    1 line  — merged into panel_org_hier.js
```

---

## Largest files (load by SECTION, not whole file)

| File | Lines | Tokens | Sections |
|---|---|---|---|
| timeline_render.js | 346 | 5.8K | bar-drag·5 · gantt-height·156 · helper-actions·186 · main-render·198 |
| panel_org_hier.js | 259 | 4.2K | org-map·5 · org-detail·76 · org-tree·123 · org-editor·162 · layout+render·219 |
| panel_orgchart.js | 198 | 3.2K | main-render·4 · conn-utils·94 · window-handlers·109 · svg-events·142 · redraw·177 |
| panel_analysis_cards.js | ~130 | 2.0K | team-cards · gap-rows · conn-risks · phase-timeline · bn-cards · rec-cards |
| panel_analysis_helpers.js | ~90 | 1.4K | pure-helpers · section-widgets (_aSection · _aToggleSection · _aMoveSection) |
| panel_analysis_scenario.js | ~105 | 1.6K | drag-state · openScenarioCompare · _scToggleBody · runScenarioCompare · cloneProject |
| panel_analysis.js | ~98 | 1.5K | render-entry · KPI · HTML-assembly |
| panel_analysis_charts.js | ~82 | 1.3K | chart-init (_initAnalysisCharts) |
| panel_resources.js | ~119 | 1.8K | filter-state · main-render · person-row · filter-toggle |
| api_actions.js | 184 | 2.8K | core-dispatchers · projects · phases · work-packages · teams+members · org-chart · org-hierarchy |
| services/team_service.py | 204 | 2.0K | teams·11 · members·55 · connections·160 · helpers·198 |
| models.py | 216 | 2.2K | skills·7 · uid·19 · duration·26 · phase-WP-schema·71 · org-types·72 · phase-tree·84 · Monte-Carlo·110 · org-tree·171 · seed-delegation·209 |

## JS colour constants (utils.js — C object)
Use `C.blue C.teal C.amber C.red C.purple C.muted C.faint` instead of hex literals.
Mirrors CSS :root variables (--blue, --teal, --amber, --red, --muted, --faint).

## CSS utility classes (app.css)
Use in template strings instead of long inline styles:
| Class | Replaces |
|---|---|
| `.trunc` | `white-space:nowrap;overflow:hidden;text-overflow:ellipsis` |
| `.mono` | `font-family:var(--mono)` |
| `.label-sm` | `font-size:11px;color:var(--muted)` |
| `.label-xs` | `font-size:10px;color:var(--faint)` |
| `.fw7` | `font-weight:700` |

---

## Test fixtures (tests/conftest.py)
All shared fixtures live in `conftest.py` — no per-file re-declarations needed.

| Fixture | What it provides |
|---|---|
| `app` | Flask test app wired to a temp SQLite DB (session-scoped) |
| `client` | Test client, resets DB to seed state before each test |
| `proj_id` | Active project id from seed |
| `proj` | Active project dict from seed |
| `phase_id` | First top-level phase id |
| `team_id` | First team id |
| `state_data` | Callable → latest `/api/state` JSON |
| `project_state` | Callable(project_id) → project dict from state |
| `second_team_id` | Creates a second team, returns its id |
| `member_id` | Creates a member in `team_id`, returns its id |
| `wp_id` | Creates a work package in `phase_id`, returns its id |
| `conn_id` | Creates a connection between `team_id` and `second_team_id`, returns its id |

---

## Ignore always
```
static/pwa/icons/*
static/favicon.ico
LICENSE
migrations/
repositories/
db.py
```
