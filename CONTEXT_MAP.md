# TeamIQ Context Map (token-efficient)

Use this file to load the minimum set of files for each change.

## Backend endpoint changes
1. `app.py` (route registration)
2. One `blueprints/*.py` file for the endpoint
3. Matching `services/*_service.py` file
4. One focused test file in `tests/`

## Frontend panel changes
1. One `static/js/panel_*.js` file
2. `static/js/state.js` only if UI state is touched
3. `static/js/api_actions.js` only if API requests are touched
4. `templates/index.html` only if script load order or shell markup changes

## Styling changes
1. `static/css/app.css`
2. `templates/index.html` (only for stylesheet include)

## Data model / simulation changes
1. `models.py`
2. Endpoint/service files that call model helpers
3. `tests/test_models.py` and one relevant API test

## Current hotspots (largest files)
- `static/js/panel_phases.js`
- `static/js/panel_timeline.js`
- `models.py`
- `templates/index.html`

## Optional assistant ignore candidates
- `static/pwa/icons/*`
- `static/favicon.ico`
- `LICENSE`
