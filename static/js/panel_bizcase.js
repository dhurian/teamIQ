// ════════════════════════════════════════════════════════════════════════════
// BUSINESS CASE
// ════════════════════════════════════════════════════════════════════════════

// ── SECTION: ROI math (pure JS, no server call) ───────────────────────────────
function _roiCalc(costK, benefitYrK, horizonYrs, discountRate) {
  if (costK <= 0 && benefitYrK <= 0) return { npv: 0, roiPct: 0, paybackYrs: null, series: [] };
  let npv = -costK;
  const series = [];
  let cumulative = -costK;
  let paybackYrs = null;
  for (let t = 1; t <= horizonYrs; t++) {
    const pv = benefitYrK / Math.pow(1 + discountRate, t);
    npv += pv;
    cumulative += benefitYrK;
    if (paybackYrs === null && cumulative >= 0) paybackYrs = t;
    series.push({ year: t, cost: t === 1 ? costK : 0, benefit: benefitYrK, net: benefitYrK - (t===1?costK:0), cumulative });
  }
  const roiPct = costK > 0 ? Math.round((npv / costK) * 100) : 0;
  return { npv: Math.round(npv), roiPct, paybackYrs, series };
}

function _roiVerdict(roiPct, successProb) {
  const riskAdj = roiPct * (successProb ?? 1);
  if (riskAdj >= 80)  return { icon: '🟢', text: 'Proceed', col: C.teal,  detail: 'Strong risk-adjusted return' };
  if (riskAdj >= 20)  return { icon: '🟡', text: 'Manage Risk', col: C.amber, detail: 'Acceptable return — address key risks' };
  return               { icon: '🔴', text: 'Reconsider', col: C.red,   detail: 'Low risk-adjusted return' };
}

// ── SECTION: render ───────────────────────────────────────────────────────────
function renderBizCase() {
  const proj = ap(); if (!proj) return;
  const bc = proj.businessCase || {};
  const allWPs = [];
  function collectWPs(phases) { phases.forEach(ph => { (ph.workPackages||[]).forEach(wp => allWPs.push({...wp, phaseName: ph.name})); collectWPs(ph.children||[]); }); }
  collectWPs(proj.phases||[]);
  const linkedWPIds = new Set(bc.linkedWPs||[]);

  document.getElementById('panelBizcase').innerHTML = `
    <div class="flex-between mb15">
      <div><h2 style="margin:0 0 4px;">Business Case</h2>
        <div style="font-size:12px;color:var(--muted);">Project: <span style="color:${proj.color};font-weight:600;">${proj.name}</span></div></div>
      <button class="btn btn-primary" onclick="saveBizCase('${proj.id}')">💾 Save</button>
    </div>
    <div style="display:grid;grid-template-columns:1fr 340px;gap:16px;align-items:start;">
      <div>
        <div class="card mb15">
          <div style="margin-bottom:14px;">
            <label style="font-size:11px;color:var(--faint);text-transform:uppercase;letter-spacing:.06em;display:block;margin-bottom:5px;">Title</label>
            <input type="text" id="bc_title" value="${bc.title||''}" placeholder="Business case title…"
              style="width:100%;font-size:16px;font-weight:700;background:transparent;border:none;border-bottom:2px solid var(--border);color:var(--text);padding:4px 0;outline:none;">
          </div>
          ${bcField('bc_problem','Problem / Opportunity',bc.problem||'','Describe the problem this project solves or the opportunity it captures…',4)}
          ${bcField('bc_solution','Proposed Solution',bc.solution||'','Describe the approach or solution…',4)}
        </div>
        <div class="grid2 mb15">
          <div class="card">${bcField('bc_benefits','Benefits',bc.benefits||'','Expected outcomes and value delivered…',5)}</div>
          <div class="card">${bcField('bc_costs','Costs',bc.costs||'','Estimated investment, resources, budget…',5)}</div>
        </div>
        <div class="grid2 mb15">
          <div class="card">${bcField('bc_risks','Risks',bc.risks||'','Key risks and mitigation approaches…',5)}</div>
          <div class="card">${bcField('bc_timeline','Timeline',bc.timeline||'','High-level milestones and key dates…',5)}</div>
        </div>

        <!-- FTE Costs -->
        <div class="card mb15" id="bcFteCard">
          <div class="flex-between" style="margin-bottom:10px;">
            <h3 style="margin:0;">👥 FTE Costs</h3>
            <div class="flex-ac" style="gap:6px;">
              <button class="btn btn-sm" onclick="_bcImportMembers('${proj.id}')">⬇ From Team</button>
              <button class="btn btn-primary btn-sm" onclick="_bcAddFte('${proj.id}')">+ Add FTE</button>
            </div>
          </div>
          <div id="bcFteRows">${_bcRenderFteRows(bc.fte_rows||[], proj)}</div>
          <div id="bcFteTotals" style="margin-top:8px;"></div>
        </div>

        <!-- Service Costs -->
        <div class="card mb15" id="bcSvcCard">
          <div class="flex-between" style="margin-bottom:10px;">
            <h3 style="margin:0;">☁ Service & Vendor Costs</h3>
            <button class="btn btn-primary btn-sm" onclick="_bcAddSvc('${proj.id}')">+ Add Service</button>
          </div>
          <div id="bcSvcRows">${_bcRenderSvcRows(bc.svc_rows||[])}</div>
          <div id="bcSvcTotals" style="margin-top:8px;"></div>
        </div>

        <!-- ROI Calculator -->
        <div class="card mb15" id="bcRoiCard">
          <div class="flex-between" style="margin-bottom:12px;">
            <h3 style="margin:0;">💰 ROI Calculator</h3>
            <label style="font-size:11px;color:var(--muted);display:flex;align-items:center;gap:6px;cursor:pointer;">
              <input type="checkbox" id="bc_risk_adj" ${bc._riskAdj?'checked':''}
                style="accent-color:var(--teal);" onchange="_bcUpdateRoi()">
              Risk-adjusted
            </label>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:10px;margin-bottom:14px;">
            <div>
              <label style="font-size:11px;color:var(--faint);display:block;margin-bottom:4px;">Total Cost ($K)</label>
              <input type="number" id="bc_cost_k" min="0" value="${bc.cost_k||0}"
                style="width:100%;background:var(--bg3);border:1px solid var(--border);color:var(--text);border-radius:6px;padding:6px 8px;font-size:13px;font-family:var(--mono);"
                oninput="_bcUpdateRoi()">
            </div>
            <div>
              <label style="font-size:11px;color:var(--faint);display:block;margin-bottom:4px;">Annual Benefit ($K)</label>
              <input type="number" id="bc_benefit_yr_k" min="0" value="${bc.benefit_yr_k||0}"
                style="width:100%;background:var(--bg3);border:1px solid var(--border);color:var(--text);border-radius:6px;padding:6px 8px;font-size:13px;font-family:var(--mono);"
                oninput="_bcUpdateRoi()">
            </div>
            <div>
              <label style="font-size:11px;color:var(--faint);display:block;margin-bottom:4px;">Horizon (years)</label>
              <input type="number" id="bc_horizon_yrs" min="1" max="20" value="${bc.horizon_yrs||5}"
                style="width:100%;background:var(--bg3);border:1px solid var(--border);color:var(--text);border-radius:6px;padding:6px 8px;font-size:13px;font-family:var(--mono);"
                oninput="_bcUpdateRoi()">
            </div>
            <div>
              <label style="font-size:11px;color:var(--faint);display:block;margin-bottom:4px;">Discount Rate (%)</label>
              <input type="number" id="bc_discount_rate" min="0" max="50" step="0.5" value="${Math.round((bc.discount_rate||0.08)*100)}"
                style="width:100%;background:var(--bg3);border:1px solid var(--border);color:var(--text);border-radius:6px;padding:6px 8px;font-size:13px;font-family:var(--mono);"
                oninput="_bcUpdateRoi()">
            </div>
          </div>
          <div id="bcRoiResult"></div>
          <div style="margin-top:14px;"><canvas id="bcRoiChart" height="120"></canvas></div>
        </div>
      </div>
      <div>
        <div class="card">
          <h3>Link to Work Packages</h3>
          <div style="font-size:11px;color:var(--faint);margin-bottom:10px;">Select the work packages this business case justifies</div>
          ${allWPs.length===0
            ? '<div style="font-size:12px;color:var(--faint);">No work packages defined yet — add them in the Phases tab</div>'
            : allWPs.map(wp=>`<div class="flex-ac" style="padding:6px 0;border-bottom:1px solid var(--border);">
                <input type="checkbox" id="bcwp_${wp.id}" ${linkedWPIds.has(wp.id)?'checked':''}
                  onchange="toggleBCLink('${proj.id}','${wp.id}',this.checked)"
                  style="accent-color:var(--teal);width:14px;height:14px;cursor:pointer;flex-shrink:0;">
                <label for="bcwp_${wp.id}" style="cursor:pointer;margin-left:8px;">
                  <div style="font-size:12px;font-weight:600;">${wp.name}</div>
                  <div class="label-xs">${wp.phaseName}</div>
                </label>
              </div>`).join('')}
        </div>
      </div>
    </div>`;

  _bcUpdateRoi();
}

// ── SECTION: ROI live update (_bcUpdateRoi) ───────────────────────────────────
let _bcRoiChart = null;

function _bcUpdateRoi() {
  const costK       = parseFloat(document.getElementById('bc_cost_k')?.value) || 0;
  const benefitYrK  = parseFloat(document.getElementById('bc_benefit_yr_k')?.value) || 0;
  const horizonYrs  = parseInt(document.getElementById('bc_horizon_yrs')?.value) || 5;
  const discountPct = parseFloat(document.getElementById('bc_discount_rate')?.value) || 8;
  const riskAdj     = document.getElementById('bc_risk_adj')?.checked || false;

  const dr   = discountPct / 100;
  const roi  = _roiCalc(costK, benefitYrK, horizonYrs, dr);

  // Optionally scale by simulation success prob (cached from last renderAnalysis or fetched once)
  const prob = riskAdj ? (ap()?.lastSimProb ?? 1) : 1;
  const adjNpv    = Math.round(roi.npv * prob);
  const adjRoiPct = Math.round(roi.roiPct * prob);
  const verdict   = _roiVerdict(adjRoiPct, 1); // already adjusted

  const resEl = document.getElementById('bcRoiResult');
  if (!resEl) return;

  if (costK === 0 && benefitYrK === 0) {
    resEl.innerHTML = `<div style="text-align:center;padding:12px;color:var(--faint);font-size:12px;">Enter cost and benefit figures above to compute ROI</div>`;
    if (_bcRoiChart) { _bcRoiChart.destroy(); _bcRoiChart = null; }
    return;
  }

  resEl.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:10px;margin-bottom:10px;">
      <div class="metric"><label>NPV${riskAdj?' (adj)':''}</label>
        <div class="val" style="font-size:20px;color:${adjNpv>=0?C.teal:C.red};">$${adjNpv}K</div></div>
      <div class="metric"><label>ROI${riskAdj?' (adj)':''}</label>
        <div class="val" style="font-size:20px;color:${adjRoiPct>=0?C.teal:C.red};">${adjRoiPct}%</div></div>
      <div class="metric"><label>Payback</label>
        <div class="val" style="font-size:20px;color:var(--text);">${roi.paybackYrs?roi.paybackYrs+'y':'> '+horizonYrs+'y'}</div></div>
      <div class="metric" style="background:${verdict.col}11;border:1px solid ${verdict.col}33;border-radius:8px;padding:8px 10px;">
        <label>Verdict</label>
        <div style="font-size:15px;font-weight:700;color:${verdict.col};margin-top:2px;">${verdict.icon} ${verdict.text}</div>
        <div style="font-size:10px;color:var(--faint);margin-top:2px;">${verdict.detail}</div>
      </div>
    </div>`;

  // Chart
  const ctx = document.getElementById('bcRoiChart');
  if (!ctx) return;
  if (_bcRoiChart) { _bcRoiChart.destroy(); _bcRoiChart = null; }
  _bcRoiChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: roi.series.map(s => `Y${s.year}`),
      datasets: [
        { label: 'Annual Benefit ($K)', data: roi.series.map(s => s.benefit * prob), backgroundColor: C.teal + '88', borderColor: C.teal, borderWidth: 1 },
        { label: 'Cost ($K)', data: roi.series.map(s => s.cost * prob), backgroundColor: C.red + '88', borderColor: C.red, borderWidth: 1 },
        { label: 'Cumulative Net ($K)', data: roi.series.map(s => s.cumulative * prob), type: 'line', borderColor: C.amber, borderWidth: 2, pointRadius: 3, tension: 0.3, fill: false, yAxisID: 'y' },
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { labels: { color: '#8893a8', font: { size: 10 } } } },
      scales: {
        x: { ticks: { color: '#8893a8', font: { size: 10 } }, grid: { color: '#1e2535' } },
        y: { ticks: { color: '#8893a8', font: { size: 10 } }, grid: { color: '#1e2535' } },
      }
    }
  });
}

// ── SECTION: save + helpers ───────────────────────────────────────────────────
function bcField(id, label, value, placeholder, rows) {
  return `<div style="margin-bottom:14px;">
    <label style="font-size:11px;color:var(--faint);text-transform:uppercase;letter-spacing:.06em;display:block;margin-bottom:5px;">${label}</label>
    <textarea id="${id}" rows="${rows}" placeholder="${placeholder}"
      style="width:100%;background:var(--bg3);border:1px solid var(--border);color:var(--text);border-radius:6px;padding:8px 10px;font-size:13px;line-height:1.6;resize:vertical;outline:none;font-family:var(--font);"
      onfocus="this.style.borderColor='var(--teal)'" onblur="this.style.borderColor='var(--border)'">${value}</textarea>
  </div>`;
}

function saveBizCase(pid) {
  const proj = ap(); if (!proj) return;
  const bc = {
    title:          document.getElementById('bc_title')?.value || '',
    problem:        document.getElementById('bc_problem')?.value || '',
    solution:       document.getElementById('bc_solution')?.value || '',
    benefits:       document.getElementById('bc_benefits')?.value || '',
    costs:          document.getElementById('bc_costs')?.value || '',
    risks:          document.getElementById('bc_risks')?.value || '',
    timeline:       document.getElementById('bc_timeline')?.value || '',
    cost_k:         _bcTotalCostK(),
    benefit_yr_k:   parseFloat(document.getElementById('bc_benefit_yr_k')?.value) || 0,
    horizon_yrs:    parseInt(document.getElementById('bc_horizon_yrs')?.value) || 5,
    discount_rate:  (parseFloat(document.getElementById('bc_discount_rate')?.value) || 8) / 100,
    _riskAdj:       document.getElementById('bc_risk_adj')?.checked || false,
    fte_rows:       proj.businessCase?.fte_rows || [],
    svc_rows:       proj.businessCase?.svc_rows || [],
    cost_period:    proj.businessCase?.cost_period || 'quarterly',
    linkedWPs:      proj.businessCase?.linkedWPs || [],
  };
  act(() => PATCH(`/api/projects/${pid}`, { businessCase: bc }));
}

function toggleBCLink(pid, wpid, checked) {
  const proj = ap(); if (!proj) return;
  const bc = proj.businessCase || {};
  const linked = new Set(bc.linkedWPs || []);
  if (checked) linked.add(wpid); else linked.delete(wpid);
  bc.linkedWPs = [...linked];
  proj.businessCase = bc;
  PATCH(`/api/projects/${pid}`, { businessCase: bc });
}

// ── SECTION: FTE + Service cost helpers ──────────────────────────────────────

const _bcPeriodMultiplier = { monthly: 12, quarterly: 4, yearly: 1, one_off: 0 };

function _bcFteAnnual(r) {
  // annual cost = rate × hrs/period × (alloc%/100) × periods × (12 / periods_per_year)
  const ppy = _bcPeriodMultiplier[r.period_type] || 4;
  return (r.hourly_rate||0) * (r.hours_per_period||0) * ((r.allocation_pct||100)/100) * (r.periods||1) * (ppy > 0 ? 12/ppy : 1) / 1000;
}

function _bcSvcAnnual(r) {
  if (r.period_type === 'one_off') return (r.amount_per_period||0) / 1000;
  const ppy = _bcPeriodMultiplier[r.period_type] || 4;
  return (r.amount_per_period||0) * (r.periods||1) * (12/ppy) / 1000;
}

function _bcTotalCostK() {
  const proj = ap(); if (!proj) return 0;
  const bc = proj.businessCase || {};
  const fte = (bc.fte_rows||[]).reduce((s,r) => s + _bcFteAnnual(r), 0);
  const svc = (bc.svc_rows||[]).reduce((s,r) => s + _bcSvcAnnual(r), 0);
  return Math.round((fte + svc) * 10) / 10 || (bc.cost_k || 0);
}

const _bcInpStyle = `background:var(--bg4);border:1px solid var(--border);color:var(--text);border-radius:4px;padding:3px 5px;font-size:11px;font-family:var(--mono);width:100%;`;
const _bcPeriodOpts = ['monthly','quarterly','yearly'].map(p=>`<option value="${p}">${p.charAt(0).toUpperCase()+p.slice(1)}</option>`).join('');

function _bcRenderFteRows(rows, proj) {
  if (!rows.length) return `<div style="font-size:12px;color:var(--faint);padding:6px 0;">No FTE rows — click "+ Add FTE" or "⬇ From Team"</div>`;
  const hdr = `<div style="display:grid;grid-template-columns:2fr 1fr 1fr 1fr 1fr 1fr 1fr 32px;gap:6px;font-size:10px;font-weight:700;color:var(--faint);text-transform:uppercase;letter-spacing:.05em;padding:0 0 4px;border-bottom:1px solid var(--border);margin-bottom:6px;">
    <span>Role / Name</span><span>Rate ($/h)</span><span>Hrs/Period</span><span>Alloc %</span><span>Periods</span><span>Period</span><span style="text-align:right;">Annual $K</span><span></span></div>`;
  return hdr + rows.map((r,i) => {
    const ann = _bcFteAnnual(r).toFixed(1);
    const annCol = parseFloat(ann) > 0 ? C.teal : C.muted;
    const pid = proj?.id || '';
    const opts = ['monthly','quarterly','yearly'].map(p=>`<option value="${p}" ${r.period_type===p?'selected':''}>${p.charAt(0).toUpperCase()+p.slice(1)}</option>`).join('');
    return `<div style="display:grid;grid-template-columns:2fr 1fr 1fr 1fr 1fr 1fr 1fr 32px;gap:6px;align-items:center;margin-bottom:4px;" data-fte-idx="${i}">
      <input value="${r.label||''}" placeholder="Role / Name" style="${_bcInpStyle}" onchange="_bcFteField(${i},'label',this.value)">
      <input type="number" min="0" value="${r.hourly_rate||0}" style="${_bcInpStyle}" oninput="_bcFteField(${i},'hourly_rate',+this.value)">
      <input type="number" min="0" value="${r.hours_per_period||0}" style="${_bcInpStyle}" oninput="_bcFteField(${i},'hours_per_period',+this.value)">
      <input type="number" min="0" max="200" value="${r.allocation_pct||100}" style="${_bcInpStyle}" oninput="_bcFteField(${i},'allocation_pct',+this.value)">
      <input type="number" min="1" value="${r.periods||4}" style="${_bcInpStyle}" oninput="_bcFteField(${i},'periods',+this.value)">
      <select style="${_bcInpStyle}" onchange="_bcFteField(${i},'period_type',this.value)">${opts}</select>
      <span style="font-size:12px;font-weight:700;color:${annCol};text-align:right;font-family:var(--mono);" id="fte_ann_${i}">$${ann}K</span>
      <button class="btn btn-danger btn-sm" style="padding:2px 6px;font-size:10px;" onclick="_bcDelFte(${i})">✕</button>
    </div>`;
  }).join('');
}

function _bcRenderSvcRows(rows) {
  if (!rows.length) return `<div style="font-size:12px;color:var(--faint);padding:6px 0;">No service rows — click "+ Add Service"</div>`;
  const hdr = `<div style="display:grid;grid-template-columns:2fr 1fr 1fr 1fr 1fr 32px;gap:6px;font-size:10px;font-weight:700;color:var(--faint);text-transform:uppercase;letter-spacing:.05em;padding:0 0 4px;border-bottom:1px solid var(--border);margin-bottom:6px;">
    <span>Service / Vendor</span><span>Cost/Period ($)</span><span>Period</span><span>Periods</span><span style="text-align:right;">Annual $K</span><span></span></div>`;
  const allOpts = ['monthly','quarterly','yearly','one_off'].map(p=>`<option value="${p}">${p==='one_off'?'One-off':p.charAt(0).toUpperCase()+p.slice(1)}</option>`).join('');
  return hdr + rows.map((r,i) => {
    const ann = _bcSvcAnnual(r).toFixed(1);
    const opts = ['monthly','quarterly','yearly','one_off'].map(p=>`<option value="${p}" ${r.period_type===p?'selected':''}>${p==='one_off'?'One-off':p.charAt(0).toUpperCase()+p.slice(1)}</option>`).join('');
    return `<div style="display:grid;grid-template-columns:2fr 1fr 1fr 1fr 1fr 32px;gap:6px;align-items:center;margin-bottom:4px;" data-svc-idx="${i}">
      <input value="${r.label||''}" placeholder="Service name" style="${_bcInpStyle}" onchange="_bcSvcField(${i},'label',this.value)">
      <input type="number" min="0" value="${r.amount_per_period||0}" style="${_bcInpStyle}" oninput="_bcSvcField(${i},'amount_per_period',+this.value)">
      <select style="${_bcInpStyle}" onchange="_bcSvcField(${i},'period_type',this.value)">${opts}</select>
      <input type="number" min="1" value="${r.periods||1}" style="${_bcInpStyle}" ${r.period_type==='one_off'?'disabled':''} oninput="_bcSvcField(${i},'periods',+this.value)">
      <span style="font-size:12px;font-weight:700;color:${C.teal};text-align:right;font-family:var(--mono);" id="svc_ann_${i}">$${ann}K</span>
      <button class="btn btn-danger btn-sm" style="padding:2px 6px;font-size:10px;" onclick="_bcDelSvc(${i})">✕</button>
    </div>`;
  }).join('');
}

// Mutate rows in-memory and re-render only the changed row's annual cost
function _bcFteField(i, field, val) {
  const proj = ap(); if (!proj) return;
  const rows = proj.businessCase.fte_rows;
  rows[i][field] = val;
  const ann = _bcFteAnnual(rows[i]).toFixed(1);
  const el = document.getElementById(`fte_ann_${i}`);
  if (el) { el.textContent = `$${ann}K`; el.style.color = parseFloat(ann) > 0 ? C.teal : C.muted; }
  _bcRefreshTotals();
}

function _bcSvcField(i, field, val) {
  const proj = ap(); if (!proj) return;
  const rows = proj.businessCase.svc_rows;
  rows[i][field] = val;
  // disable periods input for one_off
  const row = document.querySelector(`[data-svc-idx="${i}"]`);
  if (row) { const pi = row.querySelectorAll('input')[2]; if (pi) pi.disabled = val === 'one_off'; }
  const ann = _bcSvcAnnual(rows[i]).toFixed(1);
  const el = document.getElementById(`svc_ann_${i}`);
  if (el) el.textContent = `$${ann}K`;
  _bcRefreshTotals();
}

function _bcRefreshTotals() {
  const proj = ap(); if (!proj) return;
  const bc = proj.businessCase;
  const fteTot = (bc.fte_rows||[]).reduce((s,r) => s + _bcFteAnnual(r), 0);
  const svcTot = (bc.svc_rows||[]).reduce((s,r) => s + _bcSvcAnnual(r), 0);
  const tot = fteTot + svcTot;
  const fmt = v => `<span style="font-weight:700;font-family:var(--mono);color:${C.teal};">$${v.toFixed(1)}K/yr</span>`;
  document.getElementById('bcFteTotals').innerHTML = `<div style="font-size:11px;color:var(--muted);text-align:right;">FTE subtotal: ${fmt(fteTot)}</div>`;
  document.getElementById('bcSvcTotals').innerHTML = `<div style="font-size:11px;color:var(--muted);text-align:right;">Services subtotal: ${fmt(svcTot)}</div>`;
  // Drive cost_k input + ROI
  const costEl = document.getElementById('bc_cost_k');
  if (costEl && tot > 0) { costEl.value = tot.toFixed(1); costEl.readOnly = true; costEl.style.opacity = '.6'; }
  else if (costEl) { costEl.readOnly = false; costEl.style.opacity = '1'; }
  _bcUpdateRoi();
}

function _bcAddFte(pid) {
  const proj = ap(); if (!proj) return;
  const bc = proj.businessCase;
  bc.fte_rows = bc.fte_rows || [];
  bc.fte_rows.push({ id:'fte_'+Date.now(), label:'', memberId:null, hourly_rate:0, hours_per_period:8, allocation_pct:100, periods:4, period_type:'quarterly' });
  document.getElementById('bcFteRows').innerHTML = _bcRenderFteRows(bc.fte_rows, proj);
  _bcRefreshTotals();
}

function _bcDelFte(i) {
  const proj = ap(); if (!proj) return;
  proj.businessCase.fte_rows.splice(i, 1);
  document.getElementById('bcFteRows').innerHTML = _bcRenderFteRows(proj.businessCase.fte_rows, proj);
  _bcRefreshTotals();
}

function _bcAddSvc() {
  const proj = ap(); if (!proj) return;
  const bc = proj.businessCase;
  bc.svc_rows = bc.svc_rows || [];
  bc.svc_rows.push({ id:'svc_'+Date.now(), label:'', amount_per_period:0, period_type:'monthly', periods:12 });
  document.getElementById('bcSvcRows').innerHTML = _bcRenderSvcRows(bc.svc_rows);
  _bcRefreshTotals();
}

function _bcDelSvc(i) {
  const proj = ap(); if (!proj) return;
  proj.businessCase.svc_rows.splice(i, 1);
  document.getElementById('bcSvcRows').innerHTML = _bcRenderSvcRows(proj.businessCase.svc_rows);
  _bcRefreshTotals();
}

function _bcImportMembers(pid) {
  const proj = ap(); if (!proj) return;
  const bc = proj.businessCase;
  bc.fte_rows = bc.fte_rows || [];
  const existing = new Set(bc.fte_rows.map(r => r.memberId).filter(Boolean));
  const allM = proj.teams.flatMap(t => t.members);
  const orgLookup = {};
  flatPersons(S.globalOrg||{}).forEach(p => { orgLookup[p.id] = p; });
  let added = 0;
  allM.forEach(m => {
    if (m.orgId && existing.has(m.orgId)) return;
    if (!m.orgId && existing.has(m.id)) return;
    const name = m.orgId ? orgLookup[m.orgId]?.name || 'Linked' : m.name || 'Member';
    bc.fte_rows.push({ id:'fte_'+Date.now()+'_'+added, label:name, memberId: m.orgId||m.id, hourly_rate:0, hours_per_period:8, allocation_pct: m.allocation||100, periods:4, period_type:'quarterly' });
    added++;
  });
  document.getElementById('bcFteRows').innerHTML = _bcRenderFteRows(bc.fte_rows, proj);
  _bcRefreshTotals();
}
