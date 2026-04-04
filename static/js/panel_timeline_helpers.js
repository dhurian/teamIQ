// ════════════════════════════════════════════════════════════════════════════
// TIMELINE HELPERS (shared utility + inspector templates)
// ════════════════════════════════════════════════════════════════════════════
const TO_DAYS = {days:1, weeks:7, months:30.44, years:365.25};

// ── Duration helpers (timeline-specific) ─────────────────────────────────────
function phaseDays(ph){
  return parseFloat(ph.value ?? ph.weeks ?? 2) * ((ph.unit && TO_DAYS[ph.unit]) || 7);
}
function wpDays(wp){
  return parseFloat(wp.value ?? 1) * ((wp.unit && TO_DAYS[wp.unit]) || 7);
}
function clamp(n,min,max){ return Math.max(min, Math.min(max, n)); }

function daysToValueUnit(days){
  days=Math.max(1,Math.round(days*2)/2);
  if(days<=14)return{value:days,unit:'days'};
  const w=Math.round(days/7*2)/2;
  if(w<=12)return{value:w,unit:'weeks'};
  const m=Math.round(days/30.44*2)/2;
  if(m<=24)return{value:m,unit:'months'};
  return{value:Math.round(days/365.25*2)/2,unit:'years'};
}

function isoWeekParts(date){
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return {year:d.getUTCFullYear(), week:weekNo};
}
function fmtDateLabel(ms){
  return new Date(ms).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'});
}
function dateInputFromProjectDay(startMs, day){
  return new Date(startMs + Math.round(day)*86400000).toISOString().slice(0,10);
}
function projectDayFromDate(startMs, val){
  if(!val) return null;
  return Math.round((new Date(val).getTime() - startMs) / 86400000);
}
function taskLabel(task){ return task.type==='wp' ? (task.wp?.name||'Work Package') : (task.ph?.name||'Phase'); }
function taskDuration(task){ return task.type==='wp' ? wpDays(task.wp||{}) : phaseDays(task.ph||{}); }
function taskStartOverride(task){ return task.type==='wp' ? task.wp?.startDateOverride : task.ph?.startDateOverride; }
function taskEndOverride(task){ return task.type==='wp' ? task.wp?.endDateOverride : task.ph?.endDateOverride; }

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
      <div style="font-size:10px;color:var(--faint);">Duration</div>
      <div class="flex-ac">
        <input type="number" min="0.1" step="0.5" value="${ph.value??ph.weeks??2}" onchange="patchPhase('${pid}','${ph.id}',{value:parseFloat(this.value)})" style="width:72px;">
        <select onchange="patchPhase('${pid}','${ph.id}',{unit:this.value})">${DURATION_UNITS.map(u=>`<option value="${u}" ${(ph.unit||'weeks')===u?'selected':''}>${u}</option>`).join('')}</select>
      </div>
    </div>
    <div style="margin-bottom:10px;">
      <div style="font-size:10px;color:var(--faint);margin-bottom:4px;">Predecessors</div>
      <select multiple onchange="setTaskPredecessors('${pid}','${ph.id}',[...this.selectedOptions].map(o=>o.value))" style="width:100%;min-height:92px;">${buildTaskDependencyOptions(proj, ph.id).replace(/<option value="([^"]+)"/g,(m,id)=>`<option value="${id}" ${predSet.has(id)?'selected':''}`)}</select>
    </div>
    <div style="font-size:11px;color:var(--faint);margin-bottom:6px;">Toggle required skills</div>
    <div>${ALL_SKILLS.map(sk=>{ const on=ph.required?.[sk]!==undefined; const col='#4a9eff'; return `<button class="skill-toggle ${on?'on':''}" style="${on?`color:${col};border-color:${col};background:${col}18;`:''}" onclick="togglePhaseSkill('${pid}','${ph.id}','${sk}')">${sk}</button>`; }).join('')}</div>
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
      <div style="font-size:10px;color:var(--faint);">Duration</div>
      <div class="flex-ac"><input type="number" min="0.1" step="0.5" value="${wp.value??1}" onchange="patchWP('${pid}','${wp.id}',{value:parseFloat(this.value)})" style="width:72px;"><select onchange="patchWP('${pid}','${wp.id}',{unit:this.value})">${DURATION_UNITS.map(u=>`<option value="${u}" ${(wp.unit||'weeks')===u?'selected':''}>${u}</option>`).join('')}</select></div>
    </div>
    <div style="margin-bottom:10px;"><div style="font-size:10px;color:var(--faint);margin-bottom:4px;">Status</div><select onchange="patchWP('${pid}','${wp.id}',{status:this.value})" style="width:100%;">${WP_STATUSES.map(s=>`<option value="${s}" ${wp.status===s?'selected':''}>${WP_LABELS[s]||s}</option>`).join('')}</select></div>
    <div style="margin-bottom:10px;"><div style="font-size:10px;color:var(--faint);margin-bottom:4px;">Predecessors</div><select multiple onchange="setTaskPredecessors('${pid}','${wp.id}',[...this.selectedOptions].map(o=>o.value))" style="width:100%;min-height:92px;">${buildTaskDependencyOptions(proj, wp.id).replace(/<option value="([^"]+)"/g,(m,id)=>`<option value="${id}" ${predSet.has(id)?'selected':''}`)}</select></div>
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

