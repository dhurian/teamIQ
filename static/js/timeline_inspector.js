// ════════════════════════════════════════════════════════════════════════════
// TIMELINE – inspector HTML builders + drag behaviour
// ════════════════════════════════════════════════════════════════════════════

// ── Inspector HTML builders ───────────────────────────────────────────────────
function buildTaskDependencyOptions(proj, currentId){
  const {tasks}=buildTaskRegistry(proj);
  return tasks.filter(t=>t.id!==currentId).map(t=>`<option value="${t.id}">${t.type==='wp'?'📦':'▦'} ${taskLabel(t)}</option>`).join('');
}

function buildPhaseInspector(proj, ph){
  const pid=proj.id;
  const isTop=(proj.phases||[]).some(p=>p.id===ph.id);
  const label=isTop?'Phase':'Subphase';
  const predSet=new Set(getTaskPredecessors(proj, ph.id));
  return `
    <div style="display:flex;gap:8px;align-items:center;justify-content:space-between;margin-bottom:10px;">
      <span style="font-size:11px;color:var(--faint);text-transform:uppercase;letter-spacing:.06em;">${label}</span>
      <div class="flex-ac">
        <button class="btn btn-sm" onclick="addSubphase('${pid}','${ph.id}')">+ Subphase</button>
        <button class="btn btn-sm" onclick="addWP('${pid}','${ph.id}')">+ WP</button>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr auto;gap:8px;align-items:center;margin-bottom:8px;">
      <input type="text" value="${ph.name}" onchange="patchPhase('${pid}','${ph.id}',{name:this.value})" style="font-size:14px;font-weight:700;background:transparent;border:none;border-bottom:1px solid var(--border);color:var(--text);padding:2px 0;outline:none;">
      <button class="btn btn-danger btn-sm" onclick="delPhase('${pid}','${ph.id}')">✕</button>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px;">
      <div><div style="font-size:10px;color:var(--faint);margin-bottom:4px;">Start date</div><input type="date" value="${ph.startDateOverride||''}" onchange="patchPhase('${pid}','${ph.id}',{startDateOverride:this.value||null})" style="width:100%;"></div>
      <div><div style="font-size:10px;color:var(--faint);margin-bottom:4px;">Manual end override</div><input type="date" value="${ph.endDateOverride||''}" onchange="patchPhase('${pid}','${ph.id}',{endDateOverride:this.value||null})" style="width:100%;"></div>
    </div>
    <div style="display:grid;grid-template-columns:90px 1fr;gap:8px;align-items:center;margin-bottom:10px;">
      <div class="label-xs">Duration</div>
      <div class="flex-ac">
        <input type="number" min="0.1" step="0.5" value="${ph.value??ph.weeks??2}" onchange="patchPhase('${pid}','${ph.id}',{value:parseFloat(this.value)})" style="width:72px;">
        <select onchange="patchPhase('${pid}','${ph.id}',{unit:this.value})">${DURATION_UNITS.map(u=>`<option value="${u}" ${(ph.unit||'weeks')===u?'selected':''}>${u}</option>`).join('')}</select>
      </div>
    </div>
    <div style="margin-bottom:10px;">
      <div style="font-size:10px;color:var(--faint);margin-bottom:2px;">Predecessors <span style="color:var(--faint);font-size:9px;">(Ctrl+click for multiple)</span></div>
      <select id="predSel_${ph.id}" multiple style="width:100%;min-height:92px;">${buildTaskDependencyOptions(proj, ph.id).replace(/<option value="([^"]+)"/g,(m,id)=>`<option value="${id}" ${predSet.has(id)?'selected':''}`)}</select>
      <div style="display:flex;gap:6px;margin-top:4px;">
        <button class="btn btn-sm btn-primary" style="flex:1;" onclick="setTaskPredecessors('${pid}','${ph.id}',[...document.getElementById('predSel_${ph.id}').selectedOptions].map(o=>o.value))">Set predecessors</button>
        <button class="btn btn-sm" onclick="document.getElementById('predSel_${ph.id}').selectedIndex=-1;setTaskPredecessors('${pid}','${ph.id}',[])">Clear</button>
      </div>
    </div>
    <div style="font-size:11px;color:var(--faint);margin-bottom:6px;">Toggle required skills</div>
    <div>${ALL_SKILLS.map(sk=>{ const on=ph.required?.[sk]!==undefined; const col=C.blue; return `<button class="skill-toggle ${on?'on':''}" style="${on?`color:${col};border-color:${col};background:${col}18;`:''}" onclick="togglePhaseSkill('${pid}','${ph.id}','${sk}')">${sk}</button>`; }).join('')}</div>
    ${Object.keys(ph.required||{}).length ? `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:8px;margin-top:10px;">${Object.entries(ph.required||{}).map(([sk,lv])=>`<div class="flex-ac"><span style="font-size:11px;color:var(--muted);width:94px;flex-shrink:0;">${sk}</span><input type="range" min="1" max="10" step="0.5" value="${lv}" oninput="updatePhaseReq('${pid}','${ph.id}','${sk}',this.value);this.nextElementSibling.textContent=parseFloat(this.value).toFixed(1)" style="flex:1;"><span style="font-size:12px;font-weight:700;min-width:24px;font-family:var(--mono);">${parseFloat(lv).toFixed(1)}</span></div>`).join('')}</div>` : `<div style="font-size:11px;color:var(--faint);margin-top:8px;">No requirements</div>`}
  `;
}

function buildWpInspector(proj, wp){
  const pid=proj.id;
  const predSet=new Set(getTaskPredecessors(proj, wp.id));
  return `
    <div style="display:flex;gap:8px;align-items:center;justify-content:space-between;margin-bottom:10px;">
      <span style="font-size:11px;color:var(--faint);text-transform:uppercase;letter-spacing:.06em;">Work Package</span>
      <button class="btn btn-danger btn-sm" onclick="delWP('${pid}','${wp.id}')">✕</button>
    </div>
    <div style="margin-bottom:10px;"><input type="text" value="${wp.name}" onchange="patchWP('${pid}','${wp.id}',{name:this.value})" style="width:100%;font-size:14px;font-weight:700;background:transparent;border:none;border-bottom:1px solid var(--border);color:var(--text);padding:2px 0;outline:none;"></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px;">
      <div><div style="font-size:10px;color:var(--faint);margin-bottom:4px;">Start date</div><input type="date" value="${wp.startDateOverride||''}" onchange="patchWP('${pid}','${wp.id}',{startDateOverride:this.value||null})" style="width:100%;"></div>
      <div><div style="font-size:10px;color:var(--faint);margin-bottom:4px;">Manual end override</div><input type="date" value="${wp.endDateOverride||''}" onchange="patchWP('${pid}','${wp.id}',{endDateOverride:this.value||null})" style="width:100%;"></div>
    </div>
    <div style="display:grid;grid-template-columns:90px 1fr;gap:8px;align-items:center;margin-bottom:10px;">
      <div class="label-xs">Duration</div>
      <div class="flex-ac"><input type="number" min="0.1" step="0.5" value="${wp.value??1}" onchange="patchWP('${pid}','${wp.id}',{value:parseFloat(this.value)})" style="width:72px;"><select onchange="patchWP('${pid}','${wp.id}',{unit:this.value})">${DURATION_UNITS.map(u=>`<option value="${u}" ${(wp.unit||'weeks')===u?'selected':''}>${u}</option>`).join('')}</select></div>
    </div>
    <div style="margin-bottom:10px;"><div style="font-size:10px;color:var(--faint);margin-bottom:4px;">Status</div><select onchange="patchWP('${pid}','${wp.id}',{status:this.value})" style="width:100%;">${WP_STATUSES.map(s=>`<option value="${s}" ${wp.status===s?'selected':''}>${WP_LABELS[s]||s}</option>`).join('')}</select></div>
    <div style="margin-bottom:10px;">
      <div style="font-size:10px;color:var(--faint);margin-bottom:2px;">Predecessors <span style="color:var(--faint);font-size:9px;">(Ctrl+click for multiple)</span></div>
      <select id="predSel_${wp.id}" multiple style="width:100%;min-height:92px;">${buildTaskDependencyOptions(proj, wp.id).replace(/<option value="([^"]+)"/g,(m,id)=>`<option value="${id}" ${predSet.has(id)?'selected':''}`)}</select>
      <div style="display:flex;gap:6px;margin-top:4px;">
        <button class="btn btn-sm btn-primary" style="flex:1;" onclick="setTaskPredecessors('${pid}','${wp.id}',[...document.getElementById('predSel_${wp.id}').selectedOptions].map(o=>o.value))">Set predecessors</button>
        <button class="btn btn-sm" onclick="document.getElementById('predSel_${wp.id}').selectedIndex=-1;setTaskPredecessors('${pid}','${wp.id}',[])">Clear</button>
      </div>
    </div>
    <div style="margin-bottom:10px;"><div style="font-size:10px;color:var(--faint);margin-bottom:4px;">Description</div><textarea onchange="patchWP('${pid}','${wp.id}',{description:this.value})" style="width:100%;min-height:72px;resize:vertical;">${wp.description||''}</textarea></div>
    <div><div style="font-size:10px;color:var(--faint);margin-bottom:4px;">Deliverables</div><input type="text" value="${(wp.deliverables||[]).join(', ')}" onchange="patchWP('${pid}','${wp.id}',{deliverables:this.value.split(',').map(s=>s.trim()).filter(Boolean)})" style="width:100%;"></div>
  `;
}

function buildGanttDetailHtml(proj){
  if(!ganttSelId) return '';
  let wp=null, ph=null;
  (function scan(phases){ for(const p of phases){ if(p.id===ganttSelId) ph=p; (p.workPackages||[]).forEach(w=>{ if(w.id===ganttSelId) wp=w; }); scan(p.children||[]); } })(proj.phases||[]);
  return wp ? buildWpInspector(proj, wp) : (ph ? buildPhaseInspector(proj, ph) : '<div style="padding:1rem;color:var(--faint);">Not found</div>');
}

// ── Inspector drag & floating panel ──────────────────────────────────────────
function openGanttDetail(id,type,evt){
  if(evt && evt.stopPropagation) evt.stopPropagation();
  ganttSelId = ganttSelId===id ? null : id;
  ganttSelType = type;
  if(evt && ganttSelId){
    ganttInspectorPos = {x: clamp(evt.clientX + 16, 20, window.innerWidth - 420), y: clamp(evt.clientY + 12, 20, window.innerHeight - 420)};
  }
  renderTimeline();
}

function initGanttInspectorEvents(){
  if(ganttInspectorSetup) return;
  ganttInspectorSetup = true;
  window.addEventListener('mousemove',e=>{
    if(!ganttInspectorDrag) return;
    ganttInspectorPos.x = clamp(e.clientX - ganttInspectorDrag.dx, 12, window.innerWidth - 430);
    ganttInspectorPos.y = clamp(e.clientY - ganttInspectorDrag.dy, 12, window.innerHeight - 220);
    const box=document.getElementById('ganttInspector');
    if(box){ box.style.left=ganttInspectorPos.x+'px'; box.style.top=ganttInspectorPos.y+'px'; }
  });
  window.addEventListener('mouseup',()=>{ ganttInspectorDrag=null; });
}

function startGanttInspectorDrag(e){
  const box=document.getElementById('ganttInspector'); if(!box) return;
  ganttInspectorDrag = {dx:e.clientX - box.offsetLeft, dy:e.clientY - box.offsetTop};
  e.preventDefault();
}
