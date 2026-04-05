"""Smoke checks for frontend shell assets and script wiring."""

# ── SECTION: shell tests ──────────────────────────────────────────────────────

# Scripts that must be present in index.html and return 200 with JS content.
_EXPECTED_SCRIPTS = [
    '/static/js/state.js',
    '/static/js/utils.js',
    '/static/js/sidebar.js',
    '/static/js/panel_overview.js',
    '/static/js/panel_org_hier.js',
    '/static/js/panel_teams.js',
    '/static/js/panel_phases_helpers.js',
    '/static/js/phase_card.js',
    '/static/js/phase_actions.js',
    '/static/js/phase_diagram.js',
    '/static/js/panel_phases.js',
    '/static/js/timeline_utils.js',
    '/static/js/timeline_scheduling.js',
    '/static/js/timeline_inspector.js',
    '/static/js/timeline_render.js',
    '/static/js/panel_orgchart.js',
    '/static/js/panel_bizcase.js',
    '/static/js/panel_reqs.js',
    '/static/js/panel_analysis_helpers.js',
    '/static/js/panel_analysis_cards.js',
    '/static/js/panel_analysis_charts.js',
    '/static/js/panel_analysis_scenario.js',
    '/static/js/panel_analysis.js',
    '/static/js/panel_resources.js',
    '/static/js/import_picker.js',
    '/static/js/api_actions.js',
    '/static/js/import_export.js',
    '/static/js/boot.js',
]


def test_index_renders_and_includes_css(client):
    r = client.get('/')
    assert r.status_code == 200
    html = r.get_data(as_text=True)
    assert '/static/css/app.css' in html


def test_index_includes_expected_scripts(client):
    r = client.get('/')
    html = r.get_data(as_text=True)
    for path in _EXPECTED_SCRIPTS:
        assert path in html, f"Missing script tag: {path}"


def test_scripts_load_with_200(client):
    for path in _EXPECTED_SCRIPTS:
        r = client.get(path)
        assert r.status_code == 200, f"Script returned {r.status_code}: {path}"
