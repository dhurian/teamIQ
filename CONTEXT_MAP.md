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
services/analysis_service.py        detect_bottlenecks()
static/js/panel_analysis.js         SECTION: bottleneck cards  (lines ~156–174)
```

## ⑥ Analysis — recommendation cards or priority logic
```
services/analysis_service.py        generate_recommendations()
static/js/panel_analysis.js         SECTION: recommendation cards  (lines ~176–188)
```

## ⑦ Analysis — scenario compare
```
blueprints/simulation.py            POST /api/scenarios/compare
static/js/panel_analysis.js         SECTION: scenario compare  (lines ~325–403)
services/project_service.py         SECTION: clone  (only for clone changes)
```

## ⑧ Analysis — charts (skill coverage, phase probabilities, CI)
```
static/js/panel_analysis.js         SECTION: charts  (lines ~242–322)
models.py                            SECTION: Monte Carlo  (only if changing CI calc)
```

## ⑨ Analysis — KPI metrics / gap calculations
```
static/js/panel_analysis.js         SECTION: KPI + gap calcs  (lines ~61–73)
services/analysis_service.py        only if changing bottleneck scoring
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
blueprints/phases.py  OR  blueprints/work_packages.py   (PATCH allowed fields)
static/js/phase_card.js              display in card
static/js/timeline_render.js         SECTION: SVG row generation  (only if shown in gantt)
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
static/js/panel_org_hier_helpers.js   buildOrgMap, buildOrgDetail, buildOrgEditor
static/js/panel_org_hier.js           renderOrgHier, computeLayout — only if layout changes
```

## ⑮ Org hierarchy — node or skill data
```
services/org_service.py             CRUD logic
blueprints/org.py                   HTTP routes
static/js/panel_org_hier_helpers.js SECTION: org editor  (orgSkillRow, buildOrgEditor)
```

## ⑯ Team / member changes
```
services/team_service.py            business logic
blueprints/teams.py                 HTTP routes
static/js/panel_teams.js            display
static/js/api_actions.js            SECTION: teams + members  (dispatchers)
```

## ⑰ Project CRUD (create, update, delete, clone, import/export)
```
services/project_service.py         full file (~168 lines)
blueprints/projects.py              routes
static/js/api_actions.js            SECTION: projects  (dispatchers)
```

## ⑱ New API endpoint (new blueprint)
```
app.py                              register blueprint
blueprints/<name>.py                thin HTTP wrapper (create new)
services/<name>_service.py          business logic (create new)
```

## ⑲ Styling only
```
static/css/app.css                  full file (~119 lines)
```

## ⑳ Sidebar / navigation / tab routing
```
static/js/sidebar.js                full file (~50 lines)
```

## ㉑ Business case
```
static/js/panel_bizcase.js          full file (~91 lines)
```

## ㉒ Requirements
```
static/js/panel_reqs.js             full file (~57 lines)
services/requirement_service.py     business logic
blueprints/requirements.py          routes
```

---

## Dead files — do NOT load (not in index.html)
```
static/js/panel_timeline.js        superseded by timeline_render.js + timeline_scheduling.js
static/js/timeline_layout.js       superseded by timeline_scheduling.js
static/js/timeline_svg.js          superseded by timeline_render.js
static/js/timeline_events.js       superseded by timeline_render.js
```

---

## Largest files (load by SECTION, not whole file)

| File | Lines | Tokens | Sections |
|---|---|---|---|
| timeline_render.js | 346 | 5.8K | bar-drag · gantt-height · helper-actions · main-render |
| panel_analysis.js | 403 | 6.3K | helpers · render-entry · KPI-calcs · team-cards · gap-table · interface-risk · phase-timeline · bottleneck-cards · recommendation-cards · HTML-assembly · charts · scenario-compare |
| panel_org_hier_helpers.js | 213 | 3.7K | org-map · org-detail · org-tree · org-editor |
| phase_diagram.js | 212 | 2.5K | SVG-nodes · edges · drag-pan · conn-mode · auto-layout |
| services/team_service.py | 204 | 2.0K | team-CRUD · member-CRUD · org-import · connections |
| models.py | 215 | 2.2K | skills-taxonomy · duration-helpers · phase-WP-schema · org-types · phase-tree · Monte-Carlo · org-tree-helpers |

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
