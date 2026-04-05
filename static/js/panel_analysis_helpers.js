// ════════════════════════════════════════════════════════════════════════════
// ANALYSIS — helpers: small pure functions + collapsible/reorderable sections
// ════════════════════════════════════════════════════════════════════════════

// ── SECTION: pure helpers ─────────────────────────────────────────────────────
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
      <div style="position:absolute;left:${lo}%;width:${hi-lo}%;height:100%;background:${C.blue}44;border-radius:2px;"></div>
      <div style="position:absolute;left:${mid}%;transform:translateX(-50%);width:3px;height:100%;background:${C.blue};border-radius:1px;"></div>
    </div>
    <span style="min-width:26px;">${hi}%</span>
  </div>`;
}

function _priBadge(p) {
  const map = {critical:C.red,high:C.amber,medium:C.blue,low:C.teal};
  const col = map[p] || C.muted;
  return `<span style="font-size:10px;padding:2px 7px;border-radius:10px;background:${col}22;color:${col};font-weight:700;border:1px solid ${col}44;">${p.toUpperCase()}</span>`;
}

// ── SECTION: analysis section widgets (collapsible + reorderable) ─────────────
let _aOrder = ['kpi','bottlenecks','chain','recs','teams','charts','gap','interfaces','timeline'];
let _aCollapsed = {};

function _aSection(id, icon, title, body, badge = '') {
  const col = !!_aCollapsed[id];
  const idx = _aOrder.indexOf(id);
  const isFirst = idx === 0, isLast = idx === _aOrder.length - 1;
  const btnS = `background:var(--bg4);border:1px solid var(--border);color:var(--muted);cursor:pointer;border-radius:4px;width:22px;height:22px;font-size:11px;line-height:1;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;transition:all .12s;font-family:var(--font);`;
  const sepS = `border-bottom:1px solid var(--border);padding-bottom:10px;margin-bottom:14px;`;
  return `<div class="card mb15" id="asec_${id}">
    <div style="display:flex;align-items:center;gap:8px;${col ? '' : sepS}">
      <span style="font-size:14px;flex-shrink:0;">${icon}</span>
      <span style="font-size:13px;font-weight:700;flex:1;cursor:pointer;user-select:none;" onclick="_aToggleSection('${id}')">${title}${badge ? ` <span style="font-size:11px;color:var(--muted);font-weight:400;">${badge}</span>` : ''}</span>
      <div style="display:flex;gap:4px;align-items:center;flex-shrink:0;">
        <button style="${btnS}${isFirst ? 'opacity:.3;cursor:default;' : ''}" title="Move up"   onclick="_aMoveSection('${id}',-1)">▲</button>
        <button style="${btnS}${isLast  ? 'opacity:.3;cursor:default;' : ''}" title="Move down" onclick="_aMoveSection('${id}',1)">▼</button>
        <button style="${btnS}min-width:28px;width:28px;font-size:12px;" id="asec_tog_${id}" title="${col?'Expand':'Minimize'}" onclick="_aToggleSection('${id}')">${col ? '▸' : '▾'}</button>
      </div>
    </div>
    <div id="asec_body_${id}"${col ? ' style="display:none"' : ''}>${body}</div>
  </div>`;
}

function _aToggleSection(id) {
  _aCollapsed[id] = !_aCollapsed[id];
  const sec  = document.getElementById(`asec_${id}`);
  const body = document.getElementById(`asec_body_${id}`);
  const tog  = document.getElementById(`asec_tog_${id}`);
  if (!sec || !body) return;
  const col = _aCollapsed[id];
  body.style.display = col ? 'none' : '';
  if (tog) tog.textContent = col ? '▸' : '▾';
  const hdr = sec.firstElementChild;
  if (hdr) {
    hdr.style.borderBottom  = col ? 'none'                    : '1px solid var(--border)';
    hdr.style.paddingBottom = col ? '0'                       : '10px';
    hdr.style.marginBottom  = col ? '0'                       : '14px';
  }
  if (!col && id === 'charts') {
    setTimeout(() => {
      if (charts.skillChart) charts.skillChart.resize();
      if (charts.phaseChart) charts.phaseChart.resize();
    }, 50);
  }
}

function _aMoveSection(id, dir) {
  const idx = _aOrder.indexOf(id);
  const newIdx = idx + dir;
  if (newIdx < 0 || newIdx >= _aOrder.length) return;
  [_aOrder[idx], _aOrder[newIdx]] = [_aOrder[newIdx], _aOrder[idx]];
  const container = document.getElementById('analysisSections');
  if (!container) return;
  _aOrder.forEach(sid => {
    const el = document.getElementById(`asec_${sid}`);
    if (el) container.appendChild(el);
  });
  // Refresh ▲▼ button opacity for new first/last positions
  _aOrder.forEach((sid, i) => {
    const el = document.getElementById(`asec_${sid}`);
    if (!el) return;
    const btns = el.querySelectorAll('[onclick*="_aMoveSection"]');
    if (btns[0]) btns[0].style.opacity = i === 0                  ? '.3' : '1';
    if (btns[1]) btns[1].style.opacity = i === _aOrder.length - 1 ? '.3' : '1';
  });
}
