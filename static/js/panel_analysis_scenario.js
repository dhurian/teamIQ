// ════════════════════════════════════════════════════════════════════════════
// ANALYSIS — floating scenario-compare window + cloneProject shortcut
// ════════════════════════════════════════════════════════════════════════════

// ── SECTION: drag state (bound once at script load) ───────────────────────────
let _scDrag = null;

document.addEventListener('mousemove', e => {
  if (!_scDrag) return;
  const win = document.getElementById('scFloatWin'); if (!win) { _scDrag = null; return; }
  win.style.left  = Math.max(0, Math.min(window.innerWidth  - win.offsetWidth,  e.clientX - _scDrag.x)) + 'px';
  win.style.top   = Math.max(0, Math.min(window.innerHeight - 60,               e.clientY - _scDrag.y)) + 'px';
  win.style.right = 'auto';
});
document.addEventListener('mouseup', () => { _scDrag = null; });

// ── SECTION: open / toggle floating window ────────────────────────────────────
function openScenarioCompare() {
  const existing = document.getElementById('scFloatWin');
  if (existing) { existing.style.display = existing.style.display === 'none' ? '' : 'none'; return; }

  const allProjs  = S.projects || [];
  const notEnough = allProjs.length < 2;

  const checkboxes = allProjs.map(p => `
    <label style="display:flex;align-items:center;gap:8px;margin-bottom:8px;cursor:pointer;">
      <input type="checkbox" value="${p.id}" ${p.id === (ap()||{}).id ? 'checked' : ''} style="accent-color:${p.color||C.blue};">
      <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${p.color||C.blue};flex-shrink:0;"></span>
      <span style="font-size:13px;">${p.name}</span>
    </label>`).join('');

  const win = document.createElement('div');
  win.id = 'scFloatWin';
  win.style.cssText = `position:fixed;top:72px;right:24px;width:500px;max-height:80vh;display:flex;flex-direction:column;background:var(--bg2);border:1px solid var(--border2);border-radius:12px;box-shadow:0 24px 64px rgba(0,0,0,.55);z-index:250;`;

  const btnS = `background:none;border:1px solid var(--border);color:var(--faint);cursor:pointer;border-radius:4px;width:22px;height:22px;font-size:12px;line-height:1;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:all .1s;`;
  win.innerHTML = `
    <div id="scFloatDrag" style="display:flex;align-items:center;gap:10px;padding:10px 14px;background:var(--bg3);border-bottom:1px solid var(--border);border-radius:12px 12px 0 0;cursor:move;flex-shrink:0;user-select:none;"
         onmousedown="if(event.target.tagName!=='BUTTON'){_scDrag={x:event.clientX-document.getElementById('scFloatWin').offsetLeft,y:event.clientY-document.getElementById('scFloatWin').offsetTop};}">
      <span style="font-size:14px;">⚡</span>
      <span style="font-size:13px;font-weight:700;flex:1;">Scenario Comparison</span>
      <button style="${btnS}" title="Minimize" onclick="_scToggleBody()">−</button>
      <button style="${btnS}" title="Close" onclick="document.getElementById('scFloatWin').remove()">✕</button>
    </div>
    <div id="scFloatBody" style="flex:1;overflow-y:auto;padding:14px;min-height:0;">
      ${notEnough
        ? `<div style="color:var(--muted);text-align:center;padding:2rem 1rem;">Need at least 2 projects to compare.<br><br>Use <strong>+ New</strong> or <strong>⎘ Clone</strong> to create a variant.</div>`
        : `<div style="font-size:12px;color:var(--muted);margin-bottom:10px;">Select projects to compare:</div>
           <div id="scProjects" style="margin-bottom:14px;">${checkboxes}</div>
           <button class="btn btn-primary" style="width:100%;margin-bottom:14px;" onclick="runScenarioCompare()">▶ Run Comparison</button>
           <div id="scResults"></div>`
      }
    </div>`;

  document.body.appendChild(win);
}

// ── SECTION: minimize / restore window body ───────────────────────────────────
function _scToggleBody() {
  const win  = document.getElementById('scFloatWin');
  const body = document.getElementById('scFloatBody');
  const btn  = win?.querySelector('#scFloatDrag button');
  if (!win || !body || !btn) return;
  const collapsed = body.style.display === 'none';
  body.style.display = collapsed ? '' : 'none';
  btn.textContent = collapsed ? '−' : '□';
}

// ── SECTION: run comparison and render results ────────────────────────────────
async function runScenarioCompare() {
  const checked = [...document.querySelectorAll('#scProjects input:checked')].map(el => el.value);
  if (checked.length < 1) return;
  const res = document.getElementById('scResults'); if (!res) return;
  res.innerHTML = `<div style="text-align:center;color:var(--muted);padding:1rem;"><span class="spinner" style="display:inline-block;margin-right:6px;"></span>Comparing…</div>`;

  const data     = await POST('/api/scenarios/compare', { projectIds: checked, runs: 1000 });
  const projects = data.projects || [];

  if (!projects.length) { res.innerHTML = `<div style="color:var(--muted);padding:.5rem;">No results.</div>`; return; }

  const rows = projects.map(p => {
    const pct = Math.round((p.combined.overall_prob || 0) * 100);
    const ci  = p.combined.overall_ci95;
    const col = spCol(p.combined.overall_prob || 0);
    const ph  = (p.combined.phase_prob || []).map((pp, i) =>
      `<span class="badge" style="background:${PCOLS[i%4]}22;color:${PCOLS[i%4]};margin:2px;">${p.phases[i]||'?'} ${Math.round(pp*100)}%</span>`
    ).join('');
    return `<tr>
      <td><span style="color:${p.color};font-weight:700;">●</span> ${p.name}</td>
      <td class="c" style="font-family:var(--mono);font-weight:700;font-size:18px;color:${col};">${pct}%</td>
      <td class="c" style="font-size:11px;color:var(--faint);">${ci ? `${Math.round(ci[0]*100)}–${Math.round(ci[1]*100)}%` : '—'}</td>
      <td style="font-size:11px;">${ph}</td></tr>`;
  }).join('');

  res.innerHTML = `
    <table>
      <thead><tr><th>Project</th><th class="c">Success</th><th class="c">95% CI</th><th>Phase breakdown</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
}

// ── SECTION: clone project shortcut ──────────────────────────────────────────
async function cloneProject(pid) {
  const data = await POST(`/api/projects/${pid}/clone`, {});
  if (!data.ok) return;
  await loadState();
  renderSidebar();
  setTab('analysis');
}
