"""Smoke checks for frontend shell assets and script wiring."""


def test_index_renders_and_includes_css(client):
    r = client.get('/')
    assert r.status_code == 200
    html = r.get_data(as_text=True)
    assert '/static/css/app.css' in html


def test_index_includes_panel_helper_scripts(client):
    r = client.get('/')
    html = r.get_data(as_text=True)
    assert '/static/js/panel_org_hier_helpers.js' in html
    assert '/static/js/panel_phases_helpers.js' in html
    assert '/static/js/phase_card.js' in html
    assert '/static/js/phase_actions.js' in html
    assert '/static/js/phase_diagram.js' in html
    assert '/static/js/panel_timeline_helpers.js' in html
    assert '/static/js/timeline_svg.js' in html
    assert '/static/js/timeline_events.js' in html
    assert '/static/js/timeline_layout.js' in html


def test_helper_scripts_load(client):
    for path in (
        '/static/js/panel_org_hier_helpers.js',
        '/static/js/panel_phases_helpers.js',
        '/static/js/phase_card.js',
        '/static/js/phase_actions.js',
        '/static/js/phase_diagram.js',
        '/static/js/panel_timeline_helpers.js',
        '/static/js/timeline_svg.js',
        '/static/js/timeline_events.js',
        '/static/js/timeline_layout.js',
    ):
        r = client.get(path)
        assert r.status_code == 200
        assert 'function' in r.get_data(as_text=True)
