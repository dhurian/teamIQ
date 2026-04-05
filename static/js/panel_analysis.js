// ════════════════════════════════════════════════════════════════════════════
// ANALYSIS — renderAnalysis entry: fetch, KPI calcs, section assembly
// Depends on: panel_analysis_helpers.js · panel_analysis_cards.js
//             panel_analysis_charts.js  · panel_analysis_scenario.js
// ════════════════════════════════════════════════════════════════════════════

// ── SECTION: render entry — shell HTML + parallel API fetch ───────────────────
async function renderAnalysis() {
  const proj = ap(); if (!proj) return;
  const { teams, connections, phases } = proj;
  const allM = teams.flatMap(t => t.members);
  const tw   = _phaseTotalWeeks(proj);

  document.getElementById('panelAnalysis').innerHTML = `
    <div class="flex-between mb15">
      <div><h2 style="margin:0 0 4px;">${proj.name} — Analysis</h2>
        <div style="font-size:12px;color:var(--muted);">${teams.length} teams · ${allM.length} members · ${phases.length} phases · ${tw.toFixed(1)}w</div></div>
      <div style="display:flex;gap:8px;">
        <button class="btn" onclick="openScenarioCompare()" style="font-size:12px;">⚡ Compare Scenarios</button>
        <button class="btn btn-primary" onclick="renderAnalysis()">↻ Re-run</button>
      </div>
    </div>
    <div id="analysisContent"><div style="padding:3rem;text-align:center;color:var(--muted);"><span class="spinner" style="display:inline-block;margin-right:8px;"></span>Running Monte Carlo simulation…</div></div>`;

  const [data, bnData, recData] = await Promise.all([
    POST('/api/simulate', { projectId: proj.id, runs: 2000 }),
    fetch(`/api/bottlenecks?projectId=${proj.id}&runs=2000`).then(r => r.json()),
    POST('/api/recommendations', { projectId: proj.id, runs: 2000 }),
  ]);

  const res  = data.combined;
  const tRes = data.teams;
  const bns  = bnData.bottlenecks || [];
  const recs = recData.recommendations || [];

  // ── SECTION: KPI + gap calculations ──────────────────────────────────────────
  const maxReq = {};
  phases.forEach(ph => Object.entries(ph.required || {}).forEach(([sk, lv]) => {
    if (!maxReq[sk] || maxReq[sk] < lv) maxReq[sk] = lv;
  }));
  const gaps = Object.entries(maxReq).map(([sk, req]) => {
    const av = res.team_exp?.[sk] || 0;
    return { sk, req, av, cov: Math.min(1, av / req) };
  }).sort((a, b) => a.cov - b.cov);

  const crit = bns.filter(b => b.is_critical).length;
  const oPct = Math.round((res.overall_prob || 0) * 100);
  const sc   = spCol(res.overall_prob || 0);
  const ci95 = res.overall_ci95;

  // ── SECTION: HTML assembly — build section map, render in _aOrder ─────────────
  const sec = {};

  sec.kpi = _aSection('kpi', '📊', 'KPI Summary', `
    <div class="grid4" style="margin-bottom:0;">
      <div class="metric"><label>Overall success</label>
        <div class="val" style="color:${sc};">${oPct}%</div>
        <div class="sub">all teams combined</div>
        ${ci95 ? `<div class="label-xs" style="margin-top:2px;">95% CI: ${Math.round(ci95[0]*100)}–${Math.round(ci95[1]*100)}%</div>` : ''}
      </div>
      <div class="metric"><label>Teams / People</label><div class="val">${teams.length}<span style="font-size:16px;color:var(--faint);"> / ${allM.length}</span></div><div class="sub">in this project</div></div>
      <div class="metric"><label>Critical gaps</label><div class="val" style="color:${crit>0?C.red:C.teal};">${crit}</div><div class="sub">skills &lt; 85% covered</div></div>
      <div class="metric"><label>Interfaces</label><div class="val">${connections.length}</div><div class="sub">team connections</div></div>
    </div>`);

  if (bns.length) sec.bottlenecks = _aSection('bottlenecks', '🔴', 'Bottleneck Analysis',
    `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:10px;">${_buildBnCards(bns)}</div>`,
    `(${bnData.critical_count} critical)`);

  if (recs.length) sec.recs = _aSection('recs', '💡', 'Recommendations',
    `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:10px;">${_buildRecCards(recs)}</div>`,
    `(${recs.length} actions)`);

  sec.teams = _aSection('teams', '👥', 'Per-team Success',
    `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:10px;">${_buildTeamCards(teams, maxReq, tRes)}</div>`);

  sec.charts = _aSection('charts', '📈', 'Charts', `
    <div class="grid2">
      <div><h3>Skill coverage</h3><div style="position:relative;height:${Math.max(180,gaps.length*36+50)}px;"><canvas id="skillChart"></canvas></div></div>
      <div><h3>Phase success <span style="font-size:11px;color:var(--faint);font-weight:400;">with 95% CI</span></h3><div style="position:relative;height:${Math.max(180,phases.length*70+50)}px;"><canvas id="phaseChart"></canvas></div></div>
    </div>`);

  if (gaps.length) sec.gap = _aSection('gap', '📋', 'Gap Analysis', `
    <table><thead><tr><th>Skill</th><th class="c">Required</th><th class="c">Available</th><th class="c">Gap</th><th>Coverage</th><th class="c">Risk</th><th class="c">Teams</th></tr></thead>
    <tbody>${_buildGapRows(gaps, phases, teams, tRes)}</tbody></table>`);

  if (connections.length) sec.interfaces = _aSection('interfaces', '🔗', 'Interface Risk', `
    <table><thead><tr><th>Interface</th><th class="c">Type</th><th class="c">Joint success</th><th>Shared skills</th></tr></thead>
    <tbody>${_buildConnRisks(connections, teams, tRes)}</tbody></table>`);

  if (phases.length) sec.timeline = _aSection('timeline', '🗓', 'Phase Timeline & Readiness',
    _buildTimeline(phases, res, tRes, teams));

  document.getElementById('analysisContent').innerHTML =
    `<div id="analysisSections">${_aOrder.map(id => sec[id] || '').join('')}</div>`;

  _initAnalysisCharts(gaps, phases, res);
}
