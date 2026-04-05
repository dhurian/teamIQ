// ════════════════════════════════════════════════════════════════════════════
// ANALYSIS — card / row HTML builders
// Each function returns an HTML string; no DOM side-effects.
// ════════════════════════════════════════════════════════════════════════════

// ── SECTION: team cards ───────────────────────────────────────────────────────
function _buildTeamCards(teams, maxReq, tRes) {
  return teams.map(t => {
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
        <div class="gap-bar-wrap"><div class="gap-fill" style="width:${Math.round(g.cov*100)}%;background:${g.cov>=1?C.teal:g.cov>=.7?C.amber:C.red};"></div></div>
        <span style="font-size:10px;color:var(--faint);min-width:28px;">${Math.round(g.cov*100)}%</span></div>`).join('')}
    </div>`;
  }).join('');
}

// ── SECTION: gap table rows ───────────────────────────────────────────────────
function _buildGapRows(gaps, phases, teams, tRes) {
  return gaps.map(g => {
    const bc   = g.cov>=1?C.teal:g.cov>=.85?'#5dc890':g.cov>=.7?C.amber:C.red;
    const rb   = g.cov>=.85?'b-ok':g.cov>=.7?'b-med':'b-high';
    const risk = g.cov>=1?'None':g.cov>=.85?'Low':g.cov>=.7?'Medium':'High';
    const ph   = phases.filter(p => p.required?.[g.sk]).map(p => p.name).join(', ');
    const gap  = Math.max(0, g.req - g.av);
    const contrib = teams.map(t => {
      const tr2 = tRes[t.id] || {};
      return (tr2.team_exp?.[g.sk] || 0) >= 1
        ? `<span style="color:${t.color};font-size:10px;">●</span>` : null;
    }).filter(Boolean).join(' ');
    return `<tr><td><div style="font-weight:600;">${g.sk}</div><div style="font-size:11px;color:var(--faint);">${ph}</div></td>
      <td class="c" style="font-family:var(--mono);font-weight:700;">${g.req.toFixed(1)}</td>
      <td class="c" style="font-family:var(--mono);font-weight:700;color:${bc};">${g.av.toFixed(1)}</td>
      <td class="c" style="font-family:var(--mono);color:${gap>0?C.red:C.teal};">${gap>0?'+'+gap.toFixed(1):'✓'}</td>
      <td><div class="flex-ac"><div class="gap-bar-wrap"><div class="gap-fill" style="width:${Math.round(Math.min(100,g.cov*100))}%;background:${bc};"></div></div><span style="font-size:11px;color:var(--muted);min-width:30px;">${Math.round(g.cov*100)}%</span></div></td>
      <td class="c"><span class="badge ${rb}">${risk}</span></td>
      <td class="c">${contrib||'—'}</td></tr>`;
  }).join('');
}

// ── SECTION: interface risk rows ──────────────────────────────────────────────
function _buildConnRisks(connections, teams, tRes) {
  return connections.map(c => {
    const ft = teams.find(t => t.id === c.from), tt = teams.find(t => t.id === c.to);
    if (!ft || !tt) return '';
    const fr = tRes[c.from] || {}, tr2 = tRes[c.to] || {};
    const risk    = Math.min(fr.overall_prob || 0, tr2.overall_prob || 0);
    const overlap = ALL_SKILLS.filter(sk => (fr.team_exp?.[sk]||0) >= 7 && (tr2.team_exp?.[sk]||0) >= 7);
    return `<tr><td><span style="color:${ft.color};font-weight:600;">${ft.name}</span><span style="color:var(--faint);margin:0 5px;">→</span><span style="color:${tt.color};font-weight:600;">${tt.name}</span></td>
      <td class="c"><span style="font-size:11px;padding:2px 8px;border-radius:4px;background:${tCol(c.type)}18;color:${tCol(c.type)};">${c.label||c.type}</span></td>
      <td class="c" style="font-family:var(--mono);font-weight:700;color:${spCol(risk)};">${Math.round(risk*100)}%</td>
      <td class="label-sm">${overlap.slice(0,4).join(', ')||'—'}</td></tr>`;
  }).join('');
}

// ── SECTION: phase timeline rows ──────────────────────────────────────────────
function _buildTimeline(phases, res, tRes, teams) {
  return phases.map((ph, pi) => {
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
        ${bad.length
          ? `<div style="font-size:12px;color:var(--red);background:rgba(224,80,80,.08);padding:6px 10px;border-radius:6px;border:1px solid rgba(224,80,80,.2);margin-bottom:6px;">Gaps: ${bad.map(g=>`${g.sk} (need ${g.req.toFixed(0)}, ≈${g.av.toFixed(1)})`).join(' · ')}</div>`
          : `<div style="font-size:12px;color:var(--teal);margin-bottom:6px;">✓ All requirements covered</div>`}
        <div>${phG.map(g=>`<span class="badge ${g.ok?'b-ok':'b-high'}" style="margin:2px;">${g.sk} ${g.ok?'✓':g.av.toFixed(1)+'/'+g.req.toFixed(0)}</span>`).join('')}</div>
      </div></div>`;
  }).join('');
}

// ── SECTION: bottleneck cards ─────────────────────────────────────────────────
function _buildBnCards(bns) {
  return bns.slice(0, 8).map(b => {
    const sevCol = b.is_critical ? C.red : b.coverage < 1 ? C.amber : C.teal;
    const pct    = Math.round(b.coverage * 100);
    return `<div class="card-sm" style="border-left:3px solid ${sevCol};">
      <div class="flex-between" style="margin-bottom:6px;">
        <span style="font-weight:700;font-size:13px;">${b.skill}</span>
        <span style="font-size:11px;font-family:var(--mono);color:${sevCol};">${pct}% covered</span>
      </div>
      <div style="height:4px;background:var(--bg4);border-radius:2px;overflow:hidden;margin-bottom:8px;">
        <div style="height:100%;width:${pct}%;background:${sevCol};border-radius:2px;"></div>
      </div>
      <div class="label-sm">
        Need <strong>${b.required.toFixed(1)}</strong> · Have <strong style="color:${sevCol};">${b.available.toFixed(1)}</strong>
        ${b.gap > 0 ? `· Gap <strong style="color:${C.red};">${b.gap.toFixed(1)}</strong>` : ''}
      </div>
      <div style="font-size:10px;color:var(--faint);margin-top:4px;">Phases: ${b.phases_affected.join(', ')}</div>
    </div>`;
  }).join('');
}

// ── SECTION: recommendation cards ─────────────────────────────────────────────
function _buildRecCards(recs) {
  return recs.map(r => {
    const colMap = {critical:C.red,high:C.amber,medium:C.blue,low:C.teal};
    const col    = colMap[r.priority] || C.muted;
    return `<div class="card-sm" style="border-left:3px solid ${col};">
      <div class="flex-between" style="margin-bottom:6px;">
        <span style="font-size:15px;">${r.icon}</span>${_priBadge(r.priority)}
      </div>
      <div style="font-weight:700;font-size:13px;margin-bottom:4px;">${r.action}</div>
      <div style="font-size:11px;color:var(--muted);margin-bottom:6px;">${r.detail}</div>
      <div style="font-size:11px;color:var(--teal);"><strong>Impact:</strong> ${r.impact}</div>
    </div>`;
  }).join('');
}

// ── SECTION: critical chain ───────────────────────────────────────────────────
function _buildCriticalChain(chain, totalWeeks, hasCycle) {
  if (!chain || chain.length === 0) {
    return `<div style="padding:2rem;text-align:center;color:var(--faint);font-size:13px;">
      No phase dependencies defined yet — add connections in the Phases diagram view.
    </div>`;
  }

  if (hasCycle) {
    return `<div style="padding:1rem;background:${C.red}11;border:1px solid ${C.red}33;border-radius:8px;color:${C.red};font-size:13px;">
      ⚠ Circular dependency detected in phase edges — fix the cycle to see the critical chain.
    </div>`;
  }

  const rows = chain.map((ph, i) => {
    const isLast = i === chain.length - 1;
    const blockCol = ph.blocks_count > 2 ? C.red : ph.blocks_count > 0 ? C.amber : C.teal;
    const blockTxt = ph.blocks_count > 0
      ? `<span style="font-size:11px;color:${blockCol};font-weight:700;">blocks ${ph.blocks_count} phase${ph.blocks_count!==1?'s':''}</span>`
      : `<span style="font-size:11px;color:${C.teal};">leaf</span>`;
    const tooltip = ph.blocked_phases.length
      ? `title="If delayed: ${ph.blocked_phases.join(', ')}"`
      : '';
    return `
      <div style="display:flex;align-items:stretch;gap:0;">
        <div style="display:flex;flex-direction:column;align-items:center;width:28px;flex-shrink:0;">
          <div style="width:12px;height:12px;border-radius:50%;background:${blockCol};border:2px solid var(--bg1);flex-shrink:0;margin-top:4px;"></div>
          ${!isLast?`<div style="flex:1;width:2px;background:var(--border);margin:2px 0;"></div>`:''}
        </div>
        <div class="card-sm" style="flex:1;margin-bottom:${isLast?0:6}px;border-left:3px solid ${blockCol};" ${tooltip}>
          <div class="flex-between" style="margin-bottom:4px;">
            <span style="font-weight:700;font-size:13px;">${ph.phaseName}</span>
            ${blockTxt}
          </div>
          <div style="display:flex;gap:12px;">
            <span style="font-size:11px;color:var(--muted);">⏱ ${ph.duration_weeks}w</span>
            ${ph.blocked_phases.length?`<span style="font-size:11px;color:var(--faint);">→ ${ph.blocked_phases.slice(0,2).join(', ')}${ph.blocked_phases.length>2?'…':''}</span>`:''}
          </div>
        </div>
      </div>`;
  }).join('');

  return `
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;padding:8px 12px;background:var(--bg3);border-radius:8px;">
      <span style="font-size:11px;color:var(--muted);font-weight:700;text-transform:uppercase;letter-spacing:.06em;">Critical path</span>
      <span style="font-size:22px;font-weight:700;font-family:var(--mono);color:${C.amber};">${totalWeeks}w</span>
      <span style="font-size:11px;color:var(--faint);">${chain.length} phases in sequence</span>
      <span style="margin-left:auto;font-size:11px;color:var(--red);">⚠ Any delay on these phases delays the entire project</span>
    </div>
    <div style="padding:4px 0;">${rows}</div>`;
}
