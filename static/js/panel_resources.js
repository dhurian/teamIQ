// ════════════════════════════════════════════════════════════════════════════
// RESOURCES — cross-project allocation panel
// ════════════════════════════════════════════════════════════════════════════

// ── SECTION: filter state ─────────────────────────────────────────────────────
let _resFilter = 'all'; // 'all' | 'overloaded' | 'full' | 'available'
let _resCached = null;  // { people, summary } — avoids refetch on filter change

// ── SECTION: main render (renderResources) ────────────────────────────────────
async function renderResources() {
  const panel = document.getElementById('panelResources');
  panel.innerHTML = `<div style="padding:3rem;text-align:center;color:var(--muted);"><span class="spinner" style="display:inline-block;margin-right:8px;"></span>Loading allocation data…</div>`;

  const data = await GET('/api/resources');
  _resCached = { people: data.people || [], summary: data.summary || {} };
  _renderResourcesContent(panel);
}

function _renderResourcesContent(panel) {
  const { people, summary } = _resCached;

  // ── KPI row ───────────────────────────────────────────────────────────────
  const kpiHtml = [
    { label:'Total people',   val: summary.total      || 0, col: C.muted },
    { label:'Overloaded',     val: summary.overloaded || 0, col: (summary.overloaded || 0) > 0 ? C.red   : C.teal },
    { label:'Full (≥80%)',    val: summary.full       || 0, col: (summary.full       || 0) > 0 ? C.amber : C.teal },
    { label:'Available',      val: summary.available  || 0, col: C.teal },
  ].map(k => `
    <div class="metric">
      <label>${k.label}</label>
      <div class="val" style="color:${k.col};">${k.val}</div>
    </div>`).join('');

  // ── Filter bar ────────────────────────────────────────────────────────────
  const filterBar = ['all','overloaded','full','available'].map(f => {
    const labels = {all:'All',overloaded:'⚠ Overloaded',full:'Full',available:'Available'};
    return `<button class="btn btn-sm ${_resFilter===f?'btn-active':''}" onclick="_resSetFilter('${f}')">${labels[f]}</button>`;
  }).join('');

  // ── Person rows ───────────────────────────────────────────────────────────
  const visible = _resFilter === 'all' ? people : people.filter(p => p.status === _resFilter);
  const rows = visible.length
    ? visible.map(_resPersonRow).join('')
    : `<div style="padding:3rem;text-align:center;color:var(--faint);font-size:13px;">No people match this filter.</div>`;

  panel.innerHTML = `
    <div class="flex-between mb15">
      <div><h2 style="margin:0 0 4px;">Resource Allocation</h2>
        <div style="font-size:12px;color:var(--muted);">Cross-project workload per person</div></div>
      <button class="btn btn-primary" onclick="renderResources()">↻ Refresh</button>
    </div>
    <div class="grid4 mb15">${kpiHtml}</div>
    <div class="flex-ac mb15" style="gap:6px;">${filterBar}
      <span style="margin-left:auto;font-size:11px;color:var(--faint);">${visible.length} of ${people.length} people</span>
    </div>
    <div id="resRows">${rows}</div>`;
}

// ── SECTION: person row (_resPersonRow) ───────────────────────────────────────
function _resPersonRow(p) {
  const total     = p.total_allocation;
  const statusCol = total > 100 ? C.red : total >= 80 ? C.amber : C.teal;
  const badgeCls  = total > 100 ? 'b-high' : total >= 80 ? 'b-med' : 'b-ok';
  const badgeText = total > 100 ? `${total}% OVER` : total >= 80 ? 'FULL' : 'OK';

  // Stacked bar: each project fills its proportional slice of 100%;
  // anything above 100% is shown as a red hatched overflow indicator
  const cap    = Math.max(total, 100);
  const barSegs = p.projects.map(pr => {
    const w = (pr.allocation / cap * 100).toFixed(1);
    return `<div title="${pr.projectName}: ${pr.allocation}%"
      style="height:100%;width:${w}%;background:${pr.color};flex-shrink:0;transition:width .3s;"></div>`;
  }).join('');

  const overflowHatch = total > 100
    ? `<div style="height:100%;flex:1;background:repeating-linear-gradient(45deg,${C.red}55,${C.red}55 3px,transparent 3px,transparent 8px);"></div>`
    : '';

  // Per-project chips clickable → switch to that project's teams tab
  const chips = p.projects.map(pr =>
    `<span style="display:inline-flex;align-items:center;gap:4px;font-size:11px;padding:2px 8px;border-radius:10px;background:${pr.color}18;color:${pr.color};border:1px solid ${pr.color}33;margin:2px;cursor:pointer;"
      onclick="switchProject('${pr.projectId}');setTab('teams')" title="Go to ${pr.teamName}">
      <span style="width:6px;height:6px;border-radius:50%;background:${pr.color};flex-shrink:0;"></span>
      ${pr.projectName} · ${pr.allocation}%
    </span>`
  ).join('');

  return `<div class="card mb15">
    <div style="display:grid;grid-template-columns:44px 1fr 90px;gap:14px;align-items:center;">
      <div class="avatar" style="width:44px;height:44px;font-size:15px;background:${statusCol}18;color:${statusCol};">${ini(p.name)}</div>
      <div style="min-width:0;">
        <div class="flex-ac" style="margin-bottom:4px;">
          <span style="font-size:14px;font-weight:700;">${p.name}</span>
          <span class="label-xs" style="margin-left:8px;">${p.role}</span>
        </div>
        <div style="height:8px;background:var(--bg4);border-radius:4px;overflow:hidden;display:flex;margin-bottom:8px;">
          ${barSegs}${overflowHatch}
        </div>
        <div style="display:flex;flex-wrap:wrap;">${chips}</div>
      </div>
      <div style="text-align:right;">
        <div style="font-size:24px;font-weight:700;font-family:var(--mono);color:${statusCol};line-height:1;">${total}%</div>
        <span class="badge ${badgeCls}" style="margin-top:5px;display:inline-block;">${badgeText}</span>
      </div>
    </div>
  </div>`;
}

// ── SECTION: filter toggle (_resSetFilter) ────────────────────────────────────
function _resSetFilter(f) {
  _resFilter = f;
  const panel = document.getElementById('panelResources');
  if (_resCached && panel) {
    _renderResourcesContent(panel);
  } else {
    renderResources();
  }
}
