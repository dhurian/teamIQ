// ════════════════════════════════════════════════════════════════════════════
// PHASES – phase card and work package row builders
// ════════════════════════════════════════════════════════════════════════════

function phaseCard(ph, pi, proj, depth=0){
  const col   = PCOLS[pi%4];
  const isSel = ph.id===selPhaseId;
  const isFirst = pi===0, isLast = pi===(depth===0?proj.phases:proj.phases).length-1;

  const durInput = `<div class="flex-ac" onclick="event.stopPropagation()">
    <input type="number" min="0.1" step="0.5" value="${ph.value??ph.weeks??2}"
      onchange="patchPhase('${proj.id}','${ph.id}',{value:parseFloat(this.value)})"
      style="width:52px;text-align:center;">
    <select onchange="patchPhase('${proj.id}','${ph.id}',{unit:this.value})" style="font-size:11px;padding:4px 6px;">
      ${DURATION_UNITS.map(u=>`<option value="${u}" ${(ph.unit||'weeks')===u?'selected':''}>${u}</option>`).join('')}
    </select>
  </div>`;

  const toggles = ALL_SKILLS.map(sk=>{
    const on=ph.required?.[sk]!==undefined;
    return `<button class="skill-toggle ${on?'on':''}" style="${on?`color:${col};border-color:${col};background:${col}18;`:''}" onclick="togglePhaseSkill('${proj.id}','${ph.id}','${sk}')">${sk}</button>`;
  }).join('');

  const sliders = Object.keys(ph.required||{}).length
    ? `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(195px,1fr));gap:8px;margin-top:10px;">
        ${Object.entries(ph.required||{}).map(([sk,lv])=>`<div class="flex-ac">
          <span style="font-size:11px;color:var(--muted);width:100px;flex-shrink:0;">${sk}</span>
          <input type="range" min="1" max="10" step="0.5" value="${lv}"
            oninput="updatePhaseReq('${proj.id}','${ph.id}','${sk}',this.value);this.nextElementSibling.textContent=parseFloat(this.value).toFixed(1)" style="flex:1;">
          <span style="font-size:12px;font-weight:700;min-width:24px;font-family:var(--mono);">${parseFloat(lv).toFixed(1)}</span>
        </div>`).join('')}</div>`
    : `<div style="font-size:12px;color:var(--faint);margin-top:8px;">No requirements — click skills above</div>`;

  const wps = (ph.workPackages||[]).map(wp=>wpRow(wp,proj,ph)).join('');
  const wpSection = `
    <div class="sep" style="margin:.75rem 0;"></div>
    <div class="flex-between" style="margin-bottom:6px;">
      <h3 style="margin:0;font-size:10px;">Work Packages (${(ph.workPackages||[]).length})</h3>
      <button class="btn btn-sm" onclick="event.stopPropagation();addWP('${proj.id}','${ph.id}')">+ Add</button>
    </div>
    ${wps||'<div style="font-size:11px;color:var(--faint);">No work packages yet</div>'}`;

  const subCards = (ph.children||[]).map((sub,si)=>phaseCard(sub,pi,proj,depth+1)).join('');
  const hasChildren = (ph.children||[]).length > 0;
  const subSection = `
    <div class="sep" style="margin:.75rem 0;"></div>
    <div class="flex-between" style="margin-bottom:6px;">
      <div class="flex-ac">
        ${hasChildren?`<button class="btn btn-sm" onclick="event.stopPropagation();togglePhaseExpanded('${proj.id}','${ph.id}')" style="padding:2px 7px;">${ph.expanded!==false?'▾':'▸'}</button>`:''}
        <h3 style="margin:0;font-size:10px;">Subphases (${(ph.children||[]).length})</h3>
      </div>
      <button class="btn btn-sm" onclick="event.stopPropagation();addSubphase('${proj.id}','${ph.id}')">+ Add</button>
    </div>
    ${ph.expanded!==false&&hasChildren?`<div style="margin-left:12px;border-left:2px solid ${col}44;padding-left:8px;">${subCards}</div>`:''}`;

  const indentStyle = depth>0 ? `margin-left:${depth*8}px;` : '';

  return `<div class="phase-card" id="phcard_${ph.id}"
      style="border-left-color:${col};cursor:pointer;${isSel?`outline:2px solid ${col};`:''} ${indentStyle}"
      onclick="selectPhase('${ph.id}')">
    <div style="display:grid;grid-template-columns:auto 1fr auto auto;gap:10px;align-items:center;margin-bottom:12px;">
      ${depth===0?`<div style="display:flex;flex-direction:column;gap:3px;">
        <button class="btn btn-sm" onclick="event.stopPropagation();movePhase('${proj.id}','${ph.id}',-1)" style="${isFirst?'opacity:.25;cursor:default;':''}">▲</button>
        <button class="btn btn-sm" onclick="event.stopPropagation();movePhase('${proj.id}','${ph.id}',1)" style="${isLast?'opacity:.25;cursor:default;':''}">▼</button>
      </div>`:'<div></div>'}
      <div class="flex-ac">
        <span style="font-size:11px;font-weight:700;color:${col};font-family:var(--mono);"></span>
        <input type="text" value="${ph.name}" onclick="event.stopPropagation()"
          onchange="patchPhase('${proj.id}','${ph.id}',{name:this.value})"
          style="font-size:14px;font-weight:700;flex:1;background:transparent;border:none;border-bottom:1px solid var(--border);color:var(--text);padding:2px 0;outline:none;">
      </div>
      ${durInput}
      <button class="btn btn-danger btn-sm" onclick="event.stopPropagation();delPhase('${proj.id}','${ph.id}')">✕</button>
    </div>
    <div style="font-size:11px;color:var(--faint);margin-bottom:6px;">Toggle required skills:</div>
    <div>${toggles}</div>${sliders}
    ${wpSection}
    ${subSection}
  </div>`;
}

function wpRow(wp, proj, ph){
  const sc = WP_COLS[wp.status]||'#888';
  const allMembers = proj.teams.flatMap(t=>t.members);
  const orgLookup={}; flatPersons(S.globalOrg||{}).forEach(p=>{orgLookup[p.id]=p;});
  const resolveName=m=>m.orgId?orgLookup[m.orgId]?.name||'?':m.name||'?';

  const assignedNames = wp.assignedMembers.map(mid=>{
    const m = allMembers.find(m=>m.id===mid);
    return m?resolveName(m):null;
  }).filter(Boolean).join(', ')||'—';

  return `<div style="background:var(--bg3);border:1px solid var(--border);border-radius:7px;padding:10px;margin-bottom:8px;border-left:3px solid ${sc};">
    <div class="flex-between" style="margin-bottom:6px;">
      <input type="text" value="${wp.name}" onclick="event.stopPropagation()"
        onchange="patchWP('${proj.id}','${wp.id}',{name:this.value})"
        style="font-size:13px;font-weight:600;background:transparent;border:none;border-bottom:1px solid var(--border);color:var(--text);padding:1px 0;outline:none;flex:1;margin-right:8px;">
      <div class="flex-ac">
        <select onclick="event.stopPropagation()" onchange="patchWP('${proj.id}','${wp.id}',{status:this.value})" style="font-size:11px;padding:2px 5px;">
          ${WP_STATUSES.map(s=>`<option value="${s}" ${wp.status===s?'selected':''}>${WP_LABELS[s]||s}</option>`).join('')}
        </select>
        <button class="btn btn-danger btn-sm" onclick="event.stopPropagation();delWP('${proj.id}','${wp.id}')">✕</button>
      </div>
    </div>
    <div style="font-size:11px;color:var(--muted);margin-bottom:4px;">
      <textarea onclick="event.stopPropagation()" rows="2"
        onchange="patchWP('${proj.id}','${wp.id}',{description:this.value})"
        style="width:100%;background:var(--bg4);border:1px solid var(--border);color:var(--muted);border-radius:4px;padding:4px 6px;font-size:11px;resize:vertical;outline:none;"
        placeholder="Description…">${wp.description||''}</textarea>
    </div>
    <div style="font-size:11px;color:var(--faint);margin-bottom:4px;">
      <span style="color:var(--muted);font-weight:600;">Deliverables:</span>
      <input type="text" value="${wp.deliverables.join(', ')}" onclick="event.stopPropagation()"
        onchange="patchWP('${proj.id}','${wp.id}',{deliverables:this.value.split(',').map(s=>s.trim()).filter(Boolean)})"
        placeholder="comma-separated…"
        style="background:transparent;border:none;border-bottom:1px solid var(--border);color:var(--muted);padding:1px 4px;outline:none;width:100%;font-size:11px;margin-top:2px;">
    </div>
    <div style="font-size:11px;color:var(--faint);">
      <span style="color:var(--muted);font-weight:600;">Assigned:</span>
      <select multiple onclick="event.stopPropagation()" onchange="patchWP('${proj.id}','${wp.id}',{assignedMembers:[...this.selectedOptions].map(o=>o.value)})"
        style="background:var(--bg4);border:1px solid var(--border);color:var(--text);border-radius:4px;font-size:11px;padding:2px;width:100%;margin-top:2px;max-height:60px;">
        ${allMembers.map(m=>`<option value="${m.id}" ${wp.assignedMembers.includes(m.id)?'selected':''}>${resolveName(m)}</option>`).join('')}
      </select>
    </div>
  </div>`;
}
