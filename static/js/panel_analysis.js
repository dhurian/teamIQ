// ════════════════════════════════════════════════════════════════════════════
// ANALYSIS  –  simulation, bottlenecks, recommendations, scenario compare
// ════════════════════════════════════════════════════════════════════════════

// ── SECTION: helpers (_phaseTotalWeeks, _ciBar, _priBadge) ───────────────────
function _phaseTotalWeeks(proj) {
  return (proj.phases || []).reduce((a, p) => a + (p.value || p.weeks || 0), 0);
}

function _ciBar(ci95, prob) {
  if (!ci95) return '';
  const lo = Math.round(ci95[0] * 100), hi = Math.round(ci95[1] * 100),
        mid = Math.round(prob * 100);
  return `<div style="display:flex;align-items:center;gap:4px;font-size:10px;color:var(--muted);">
    <span style="min-width:26px;text-align:right;">${lo}%</span>
    <div style="flex:1;height:4px;background:var(--bg4);border-radius:2px;position:relative;">
      <div style="position:absolute;left:${lo}%;width:${hi-lo}%;height:100%;background:#4a9eff44;border-radius:2px;"></div>
      <div style="position:absolute;left:${mid}%;transform:translateX(-50%);width:3px;height:100%;background:#4a9eff;border-radius:1px;"></div>
    </div>
    <span style="min-width:26px;">${hi}%</span>
  </div>`;
}

// ── priority badge ────────────────────────────────────────────────────────────
function _priBadge(p) {
  const map = {critical:'#e05050',high:'#f0a030',medium:'#4a9eff',low:'#1fb885'};
  const col = map[p] || '#8893a8';
  return `<span style="font-size:10px;padding:2px 7px;border-radius:10px;background:${col}22;color:${col};font-weight:700;border:1px solid ${col}44;">${p.toUpperCase()}</span>`;
}

// ── SECTION: render entry — shell HTML, parallel API fetch ────────────────────
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

  // Run simulation + bottlenecks + recommendations in parallel
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
  const gaps  = Object.entries(maxReq).map(([sk, req]) => {
    const av = res.team_exp?.[sk] || 0;
    return { sk, req, av, cov: Math.min(1, av / req) };
  }).sort((a, b) => a.cov - b.cov);
  const crit   = bns.filter(b => b.is_critical).length;
  const oPct   = Math.round((res.overall_prob || 0) * 100);
  const sc     = spCol(res.overall_prob || 0);
  const ci95   = res.overall_ci95;

  // ── SECTION: team cards ───────────────────────────────────────────────────────
  const tCards = teams.map(t => {
    const tr  = tRes[t.id] || {}, pct = Math.round((tr.overall_prob || 0) * 100);
    const hcol = spCol(tr.overall_prob || 0);
    const wk  = Object.entries(maxReq).map(([sk, req]) => ({
      sk, req, av: tr.team_exp?.[sk] || 0, cov: Math.min(1, (tr.team_exp?.[sk] || 0) / req)
    })).sort((a, b) => a.cov - b.cov).slice(0, 3);
    return `<div class="card-sm" style="border-left:3px solid ${t.color};">
      <div class="flex-between" style="margin-bottom:8px;">
        <div class="flex-ac"><div style="width:8px;height:8px;border-radius:50%;background:${t.color};"></div><span style="font-weight:700;font-size:13px;">${t.name}</span><span style="font-size:11px;color:var(--faint);">${t.members.length}m</span></div>
        <span style="font-size:18px;font-weight:700;font-family:var(--mono);color:${hcol};">${pct}%</span>
      </div>
      <div style="height:4px;background:var(--bg4);border-radius:2px;overflow:hidden;margin-bottom:8px;"><div style="height:100%;width:${pct}%;background:${hcol};border-radius:2px;"></div></div>
      <div style="font-size:11px;color:var(--faint);margin-bottom:3px;">Weakest skills:</div>
      ${wk.map(g => `<div class="flex-ac" style="margin-top:4px;"><span style="font-size:11px;color:var(--muted);width:100px;flex-shrink:0;">${g.sk}</span>
        <div class="gap-bar-wrap"><div class="gap-fill" style="width:${Math.round(g.cov*100)}%;background:${g.cov>=1?'#1fb885':g.cov>=.7?'#f0a030':'#e05050'};"></div></div>
        <span style="font-size:10px;color:var(--faint);min-width:28px;">${Math.round(g.cov*100)}%</span></div>`).join('')}
    </div>`;
  }).join('');

  // ── SECTION: gap table rows ───────────────────────────────────────────────────
  const gapRows = gaps.map(g => {
    const bc  = g.cov>=1?'#1fb885':g.cov>=.85?'#5dc890':g.cov>=.7?'#f0a030':'#e05050';
    const rb  = g.cov>=.85?'b-ok':g.cov>=.7?'b-med':'b-high';
    const risk= g.cov>=1?'None':g.cov>=.85?'Low':g.cov>=.7?'Medium':'High';
    const ph  = phases.filter(p => p.required?.[g.sk]).map(p => p.name).join(', ');
    const gap = Math.max(0, g.req - g.av);
    const contrib = teams.map(t => {
      const tr2 = tRes[t.id] || {};
      return (tr2.team_exp?.[g.sk] || 0) >= 1
        ? `<span style="color:${t.color};font-size:10px;">●</span>` : null;
    }).filter(Boolean).join(' ');
    return `<tr><td><div style="font-weight:600;">${g.sk}</div><div style="font-size:11px;color:var(--faint);">${ph}</div></td>
      <td class="c" style="font-family:var(--mono);font-weight:700;">${g.req.toFixed(1)}</td>
      <td class="c" style="font-family:var(--mono);font-weight:700;color:${bc};">${g.av.toFixed(1)}</td>
      <td class="c" style="font-family:var(--mono);color:${gap>0?'#e05050':'#1fb885'};">${gap>0?'+'+gap.toFixed(1):'✓'}</td>
      <td><div class="flex-ac"><div class="gap-bar-wrap"><div class="gap-fill" style="width:${Math.round(Math.min(100,g.cov*100))}%;background:${bc};"></div></div><span style="font-size:11px;color:var(--muted);min-width:30px;">${Math.round(g.cov*100)}%</span></div></td>
      <td class="c"><span class="badge ${rb}">${risk}</span></td>
      <td class="c">${contrib||'—'}</td></tr>`;
  }).join('');

  // ── SECTION: interface risk rows ──────────────────────────────────────────────
  const connRisks = connections.map(c => {
    const ft = teams.find(t => t.id === c.from), tt = teams.find(t => t.id === c.to);
    if (!ft || !tt) return '';
    const fr = tRes[c.from] || {}, tr2 = tRes[c.to] || {};
    const risk = Math.min(fr.overall_prob || 0, tr2.overall_prob || 0);
    const overlap = ALL_SKILLS.filter(sk => (fr.team_exp?.[sk]||0) >= 7 && (tr2.team_exp?.[sk]||0) >= 7);
    return `<tr><td><span style="color:${ft.color};font-weight:600;">${ft.name}</span><span style="color:var(--faint);margin:0 5px;">→</span><span style="color:${tt.color};font-weight:600;">${tt.name}</span></td>
      <td class="c"><span style="font-size:11px;padding:2px 8px;border-radius:4px;background:${tCol(c.type)}18;color:${tCol(c.type)};">${c.label||c.type}</span></td>
      <td class="c" style="font-family:var(--mono);font-weight:700;color:${spCol(risk)};">${Math.round(risk*100)}%</td>
      <td style="font-size:11px;color:var(--muted);">${overlap.slice(0,4).join(', ')||'—'}</td></tr>`;
  }).join('');

  // ── SECTION: phase timeline with CI bars ──────────────────────────────────────
  const timeline = phases.map((ph, pi) => {
    const prob = (res.phase_prob || [])[pi] || 0, pct = Math.round(prob * 100), col = PCOLS[pi % 4];
    const phCi = (res.phase_ci95 || [])[pi];
    const phG  = Object.entries(ph.required || {}).map(([sk, req]) => ({
      sk, req, av: res.team_exp?.[sk] || 0, ok: (res.team_exp?.[sk] || 0) >= req
    }));
    const bad  = phG.filter(g => !g.ok);
    const contrib = teams.map(t => {
      const tr2 = tRes[t.id] || {};
      return Object.keys(ph.required || {}).some(sk => (tr2.team_exp?.[sk] || 0) > 3)
        ? `<span style="font-size:10px;padding:1px 7px;border-radius:10px;background:${t.color}18;color:${t.color};margin:2px;display:inline-block;">${t.name}</span>` : null;
    }).filter(Boolean).join('');
    return `<div style="display:grid;grid-template-columns:16px 1fr;gap:12px;margin-bottom:14px;">
      <div style="display:flex;flex-direction:column;align-items:center;"><div class="timeline-dot" style="background:${col};"></div>${pi<phases.length-1?'<div class="timeline-line"></div>':''}</div>
      <div style="padding-bottom:14px;">
        <div class="flex-between" style="margin-bottom:4px;">
          <div><span style="font-weight:700;font-size:14px;">${ph.name}</span><span style="font-size:12px;color:var(--muted);margin-left:8px;">${(ph.value||ph.weeks||0).toFixed(1)}w</span></div>
          <div class="flex-ac"><span style="font-size:12px;color:var(--muted);">Success:</span><span style="font-size:16px;font-weight:700;font-family:var(--mono);color:${spCol(prob)};">${pct}%</span></div>
        </div>
        ${_ciBar(phCi, prob)}
        <div style="margin:5px 0;">${contrib}</div>
        ${bad.length ? `<div style="font-size:12px;color:var(--red);background:rgba(224,80,80,.08);padding:6px 10px;border-radius:6px;border:1px solid rgba(224,80,80,.2);margin-bottom:6px;">Gaps: ${bad.map(g=>`${g.sk} (need ${g.req.toFixed(0)}, ≈${g.av.toFixed(1)})`).join(' · ')}</div>` : `<div style="font-size:12px;color:var(--teal);margin-bottom:6px;">✓ All requirements covered</div>`}
        <div>${phG.map(g=>`<span class="badge ${g.ok?'b-ok':'b-high'}" style="margin:2px;">${g.sk} ${g.ok?'✓':g.av.toFixed(1)+'/'+g.req.toFixed(0)}</span>`).join('')}</div>
      </div></div>`;
  }).join('');

  // ── SECTION: bottleneck cards ─────────────────────────────────────────────────
  const bnCards = bns.slice(0, 8).map(b => {
    const sevCol = b.is_critical ? '#e05050' : b.coverage < 1 ? '#f0a030' : '#1fb885';
    const pct    = Math.round(b.coverage * 100);
    return `<div class="card-sm" style="border-left:3px solid ${sevCol};">
      <div class="flex-between" style="margin-bottom:6px;">
        <span style="font-weight:700;font-size:13px;">${b.skill}</span>
        <span style="font-size:11px;font-family:var(--mono);color:${sevCol};">${pct}% covered</span>
      </div>
      <div style="height:4px;background:var(--bg4);border-radius:2px;overflow:hidden;margin-bottom:8px;">
        <div style="height:100%;width:${pct}%;background:${sevCol};border-radius:2px;"></div>
      </div>
      <div style="font-size:11px;color:var(--muted);">
        Need <strong>${b.required.toFixed(1)}</strong> · Have <strong style="color:${sevCol};">${b.available.toFixed(1)}</strong>
        ${b.gap > 0 ? `· Gap <strong style="color:#e05050;">${b.gap.toFixed(1)}</strong>` : ''}
      </div>
      <div style="font-size:10px;color:var(--faint);margin-top:4px;">Phases: ${b.phases_affected.join(', ')}</div>
    </div>`;
  }).join('');

  // ── SECTION: recommendation cards ─────────────────────────────────────────────
  const recCards = recs.map(r => {
    const colMap = {critical:'#e05050',high:'#f0a030',medium:'#4a9eff',low:'#1fb885'};
    const col    = colMap[r.priority] || '#8893a8';
    return `<div class="card-sm" style="border-left:3px solid ${col};">
      <div class="flex-between" style="margin-bottom:6px;">
        <span style="font-size:15px;">${r.icon}</span>${_priBadge(r.priority)}
      </div>
      <div style="font-weight:700;font-size:13px;margin-bottom:4px;">${r.action}</div>
      <div style="font-size:11px;color:var(--muted);margin-bottom:6px;">${r.detail}</div>
      <div style="font-size:11px;color:var(--teal);"><strong>Impact:</strong> ${r.impact}</div>
    </div>`;
  }).join('');

  // ── SECTION: HTML assembly (inject all cards into DOM) ────────────────────────
  document.getElementById('analysisContent').innerHTML = `
    <div class="grid4">
      <div class="metric"><label>Overall success</label>
        <div class="val" style="color:${sc};">${oPct}%</div>
        <div class="sub">all teams combined</div>
        ${ci95 ? `<div style="font-size:10px;color:var(--faint);margin-top:2px;">95% CI: ${Math.round(ci95[0]*100)}–${Math.round(ci95[1]*100)}%</div>` : ''}
      </div>
      <div class="metric"><label>Teams / People</label><div class="val">${teams.length}<span style="font-size:16px;color:var(--faint);"> / ${allM.length}</span></div><div class="sub">in this project</div></div>
      <div class="metric"><label>Critical gaps</label><div class="val" style="color:${crit>0?'#e05050':'#1fb885'};">${crit}</div><div class="sub">skills &lt; 85% covered</div></div>
      <div class="metric"><label>Interfaces</label><div class="val">${connections.length}</div><div class="sub">team connections</div></div>
    </div>

    <!-- Bottlenecks -->
    ${bns.length ? `<div style="margin-bottom:1.5rem;">
      <h3>🔴 Bottleneck Analysis <span style="font-size:12px;color:var(--muted);font-weight:400;">(${bnData.critical_count} critical)</span></h3>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:10px;">${bnCards}</div>
    </div>` : ''}

    <!-- Recommendations -->
    ${recs.length ? `<div style="margin-bottom:1.5rem;">
      <h3>💡 Recommendations <span style="font-size:12px;color:var(--muted);font-weight:400;">(${recs.length} actions)</span></h3>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:10px;">${recCards}</div>
    </div>` : ''}

    <!-- Per-team success -->
    <div style="margin-bottom:1.5rem;"><h3>Per-team success</h3>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:10px;">${tCards}</div>
    </div>

    <!-- Charts -->
    <div class="grid2 mb15">
      <div class="card"><h3>Skill coverage</h3><div style="position:relative;height:${Math.max(180,gaps.length*36+50)}px;"><canvas id="skillChart"></canvas></div></div>
      <div class="card"><h3>Phase success probabilities <span style="font-size:11px;color:var(--faint);font-weight:400;">with 95% CI</span></h3><div style="position:relative;height:${Math.max(180,phases.length*70+50)}px;"><canvas id="phaseChart"></canvas></div></div>
    </div>

    <!-- Gap table -->
    <div class="card mb15"><h3>Gap analysis</h3>
      <table><thead><tr><th>Skill</th><th class="c">Required</th><th class="c">Available</th><th class="c">Gap</th><th>Coverage</th><th class="c">Risk</th><th class="c">Teams</th></tr></thead>
      <tbody>${gapRows}</tbody></table></div>

    <!-- Interface risk -->
    ${connections.length ? `<div class="card mb15"><h3>Interface risk</h3>
      <table><thead><tr><th>Interface</th><th class="c">Type</th><th class="c">Joint success</th><th>Shared skills</th></tr></thead>
      <tbody>${connRisks}</tbody></table></div>` : ''}

    <!-- Phase timeline -->
    <div class="card"><h3>Phase timeline &amp; readiness</h3>${timeline}</div>

    <!-- Scenario compare modal anchor -->
    <div id="scenarioCompareModal"></div>`;

  // ── SECTION: charts (skill coverage bar + phase prob bar with CI plugin) ──────
  setTimeout(() => {
    dc('skillChart'); dc('phaseChart');

    // Skill chart
    const sc2 = document.getElementById('skillChart');
    if (sc2) charts.skillChart = new Chart(sc2, {
      type: 'bar',
      data: {
        labels: gaps.map(g => g.sk),
        datasets: [
          { label: 'Required', data: gaps.map(g => g.req), backgroundColor: '#ffffff12', borderColor: '#ffffff33', borderWidth: 1, borderRadius: 3 },
          { label: 'Available', data: gaps.map(g => parseFloat(g.av.toFixed(2))),
            backgroundColor: gaps.map(g => g.av>=g.req?'#1fb88566':g.av/g.req>=.7?'#f0a03066':'#e0505066'),
            borderColor: gaps.map(g => g.av>=g.req?'#1fb885':g.av/g.req>=.7?'#f0a030':'#e05050'),
            borderWidth: 1, borderRadius: 3 },
        ],
      },
      options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { x: { min: 0, max: 10, grid: { color: '#ffffff08' }, ticks: { color: '#8893a8', font: { size: 11 } } },
                  y: { grid: { display: false }, ticks: { color: '#8893a8', font: { size: 11 } } } } },
    });

    // Phase chart with CI error bars via custom plugin
    const phasePcts = (res.phase_prob || []).map(p => Math.round(p * 100));
    const phCiLo    = (res.phase_ci95 || []).map(ci => ci ? Math.round(ci[0] * 100) : 0);
    const phCiHi    = (res.phase_ci95 || []).map(ci => ci ? Math.round(ci[1] * 100) : 0);

    const pc2 = document.getElementById('phaseChart');
    if (pc2) charts.phaseChart = new Chart(pc2, {
      type: 'bar',
      data: {
        labels: phases.map(p => p.name),
        datasets: [
          { data: phasePcts,
            backgroundColor: phases.map((_, i) => PCOLS[i % 4] + '66'),
            borderColor: phases.map((_, i) => PCOLS[i % 4]),
            borderWidth: 1, borderRadius: 4 },
        ],
      },
      options: {
        indexAxis: 'y', responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: ctx => {
                const i = ctx.dataIndex;
                return `Success: ${phasePcts[i]}%  (95% CI: ${phCiLo[i]}–${phCiHi[i]}%)`;
              },
            },
          },
        },
        scales: {
          x: { min: 0, max: 100, grid: { color: '#ffffff08' }, ticks: { color: '#8893a8', font: { size: 11 }, callback: v => v + '%' } },
          y: { grid: { display: false }, ticks: { color: '#8893a8', font: { size: 11 } } },
        },
      },
      plugins: [{
        id: 'ci-bars',
        afterDatasetsDraw(chart) {
          const { ctx, scales: { x, y } } = chart;
          ctx.save();
          ctx.strokeStyle = '#ffffff88';
          ctx.lineWidth   = 1.5;
          phasePcts.forEach((_, i) => {
            const lo = phCiLo[i], hi = phCiHi[i];
            if (lo === hi) return;
            const yC  = y.getPixelForValue(i);
            const xLo = x.getPixelForValue(lo), xHi = x.getPixelForValue(hi);
            const h   = 5;
            ctx.beginPath(); ctx.moveTo(xLo, yC - h); ctx.lineTo(xLo, yC + h); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(xHi, yC - h); ctx.lineTo(xHi, yC + h); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(xLo, yC); ctx.lineTo(xHi, yC); ctx.stroke();
          });
          ctx.restore();
        },
      }],
    });
  }, 80);
}

// ── SECTION: scenario compare modal + project clone shortcut ──────────────────
function openScenarioCompare() {
  const modal = document.getElementById('scenarioCompareModal');
  if (!modal) return;
  const allProjs = S.projects || [];
  if (allProjs.length < 2) {
    modal.innerHTML = `<div class="card" style="margin-top:1.5rem;color:var(--muted);text-align:center;padding:2rem;">
      You need at least 2 projects to compare scenarios.<br>
      Use <strong>+ New</strong> or <strong>Clone Project</strong> to create a variant.
    </div>`;
    return;
  }

  const checkboxes = allProjs.map(p => `
    <label style="display:flex;align-items:center;gap:8px;margin-bottom:8px;cursor:pointer;">
      <input type="checkbox" value="${p.id}" ${p.id === (ap()||{}).id ? 'checked' : ''} style="accent-color:${p.color||'#4a9eff'};">
      <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${p.color||'#4a9eff'};"></span>
      <span>${p.name}</span>
    </label>`).join('');

  modal.innerHTML = `
    <div class="card" style="margin-top:1.5rem;">
      <div class="flex-between" style="margin-bottom:12px;">
        <h3 style="margin:0;">⚡ Scenario Comparison</h3>
        <button class="btn" onclick="document.getElementById('scenarioCompareModal').innerHTML=''" style="font-size:11px;">✕ Close</button>
      </div>
      <div style="margin-bottom:12px;">
        <div style="font-size:12px;color:var(--muted);margin-bottom:8px;">Select projects to compare:</div>
        <div id="scProjects">${checkboxes}</div>
      </div>
      <button class="btn btn-primary" onclick="runScenarioCompare()" style="margin-bottom:12px;">Run Comparison</button>
      <div id="scResults"></div>
    </div>`;
}

async function runScenarioCompare() {
  const checked = [...document.querySelectorAll('#scProjects input:checked')].map(el => el.value);
  if (checked.length < 1) return;
  document.getElementById('scResults').innerHTML =
    `<div style="text-align:center;color:var(--muted);padding:1rem;"><span class="spinner" style="display:inline-block;margin-right:6px;"></span>Comparing…</div>`;

  const data = await POST('/api/scenarios/compare', { projectIds: checked, runs: 1000 });
  const projects = data.projects || [];

  if (!projects.length) {
    document.getElementById('scResults').innerHTML = `<div style="color:var(--muted);padding:.5rem;">No results.</div>`;
    return;
  }

  const rows = projects.map(p => {
    const pct  = Math.round((p.combined.overall_prob || 0) * 100);
    const ci   = p.combined.overall_ci95;
    const col  = spCol(p.combined.overall_prob || 0);
    const ph   = (p.combined.phase_prob || []).map((pp, i) =>
      `<span class="badge" style="background:${PCOLS[i%4]}22;color:${PCOLS[i%4]};margin:2px;">${p.phases[i]||'?'} ${Math.round(pp*100)}%</span>`
    ).join('');
    return `<tr>
      <td><span style="color:${p.color};font-weight:700;">●</span> ${p.name}</td>
      <td class="c" style="font-family:var(--mono);font-weight:700;font-size:18px;color:${col};">${pct}%</td>
      <td class="c" style="font-size:11px;color:var(--faint);">${ci ? `${Math.round(ci[0]*100)}–${Math.round(ci[1]*100)}%` : '—'}</td>
      <td style="font-size:11px;">${ph}</td>
    </tr>`;
  }).join('');

  document.getElementById('scResults').innerHTML = `
    <table>
      <thead><tr><th>Project</th><th class="c">Success</th><th class="c">95% CI</th><th>Phase breakdown</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
}

// ── Clone project shortcut (callable from sidebar / overview) ─────────────────
async function cloneProject(pid) {
  const data = await POST(`/api/projects/${pid}/clone`, {});
  if (!data.ok) return;
  await loadState();
  renderSidebar();
  setTab('analysis');
}
