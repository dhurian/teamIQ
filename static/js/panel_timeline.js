// ════════════════════════════════════════════════════════════════════════════
// TIMELINE / GANTT VIEW
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

// ── Task registry & scheduling ────────────────────────────────────────────────
function buildTaskRegistry(proj){
  const tasks=[]; const map={};
  function pushTask(task){ tasks.push(task); map[task.id]=task; }
  function walkPhase(ph, depth, parentId, rootId){
    const task={id:ph.id, type: depth===0?'phase':'subphase', ph, depth, parentId, rootId:rootId||ph.id, childrenIds:[], wpIds:[]};
    pushTask(task);
    (ph.children||[]).forEach(ch=>{ task.childrenIds.push(ch.id); walkPhase(ch, depth+1, ph.id, rootId||ph.id); });
    (ph.workPackages||[]).forEach(wp=>{
      task.wpIds.push(wp.id);
      pushTask({id:wp.id, type:'wp', wp, ph, depth:depth+1, parentId:ph.id, rootId:rootId||ph.id, childrenIds:[], wpIds:[]});
    });
  }
  (proj.phases||[]).forEach(ph=>walkPhase(ph,0,null,ph.id));
  return {tasks,map};
}

function getTaskPredecessors(proj, taskId){
  const edges=(proj.taskEdges||[]).filter(e=>e.to===taskId).map(e=>e.from);
  const phaseEdges=(proj.phaseEdges||[]).filter(e=>e.to===taskId).map(e=>e.from);
  return [...new Set([...edges, ...phaseEdges])];
}

function setTaskPredecessors(pid, taskId, predIds){
  const proj=ap(); if(!proj) return;
  const keep=(proj.taskEdges||[]).filter(e=>e.to!==taskId);
  const add=(predIds||[]).filter(Boolean).filter(id=>id!==taskId).map(id=>({id:'te_'+Math.random().toString(36).slice(2,10), from:id, to:taskId}));
  patchProject(pid,{taskEdges:[...keep,...add]});
}

function buildGanttRows(proj){
  const {tasks,map}=buildTaskRegistry(proj);
  const topIds=(proj.phases||[]).map(ph=>ph.id);
  const preds={};
  tasks.forEach(t=>preds[t.id]=new Set(getTaskPredecessors(proj, t.id)));

  // default sequential ordering within same list
  function addSequential(list){
    for(let i=1;i<list.length;i++) preds[list[i]].add(list[i-1]);
  }
  addSequential(topIds);
  (proj.phases||[]).forEach(function walk(ph){
    addSequential((ph.children||[]).map(c=>c.id));
    addSequential((ph.workPackages||[]).map(w=>w.id));
    (ph.children||[]).forEach(walk);
  });

  const startDateStr=proj.startDate||new Date().toISOString().slice(0,10);
  const startMs=new Date(startDateStr).getTime();
  const byId={};
  const ordered=tasks.map(t=>t.id);
  for(let pass=0; pass<ordered.length+3; pass++){
    let changed=false;
    ordered.forEach(id=>{
      const t=map[id]; if(!t) return;
      const predEnd=[...preds[id]].map(pid=>byId[pid]?.endDay).filter(v=>v!=null);
      const minStart=predEnd.length?Math.max(...predEnd):0;
      const startOverride=projectDayFromDate(startMs, taskStartOverride(t));
      let startDay=Math.max(minStart, startOverride!=null?startOverride:0);
      const dur=taskDuration(t);
      const endOverride=projectDayFromDate(startMs, taskEndOverride(t));
      let endDay=endOverride!=null?Math.max(startDay, endOverride):startDay+dur;
      const prev=byId[id];
      if(!prev || prev.startDay!==startDay || prev.endDay!==endDay){
        byId[id]={startDay,endDay}; changed=true;
      }
    });
    if(!changed) break;
  }

  const rows=[];
  function walkRender(ph, depth){
    const task=map[ph.id]; if(!task) return;
    const rootIdx=Math.max(0, (proj.phases||[]).findIndex(p=>p.id===task.rootId));
    const col=PCOLS[rootIdx%PCOLS.length];
    rows.push({id:ph.id, ph, depth, type:depth===0?'phase':'subphase', col, ...byId[ph.id]});
    if(!ganttCollapsed.has(ph.id)){
      (ph.children||[]).forEach(ch=>walkRender(ch, depth+1));
      (ph.workPackages||[]).forEach(wp=>{
        rows.push({id:wp.id, ph, wp, depth:depth+1, type:'wp', col, ...byId[wp.id]});
      });
    }
  }
  (proj.phases||[]).forEach(ph=>walkRender(ph,0));
  const totalDays=Math.max(1, ...Object.values(byId).map(v=>v.endDay), ganttViewStartDay + ganttViewDays);
  return {rows,totalDays,startMs,map};
}

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

// ── Inspector drag & floating panel ──────────────────────────────────────────
function openGanttDetail(id,type,evt){
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

// ── Bar resize drag ───────────────────────────────────────────────────────────
function initGanttBarResizeEvents(){
  if(ganttBarResizeSetup) return;
  ganttBarResizeSetup = true;
  document.addEventListener('mousedown',e=>{
    const h=e.target.closest?.('.g-resize'); if(!h) return;
    e.preventDefault(); e.stopPropagation();
    const DAY_W=Math.max(3,Math.round(14*ganttZoom));
    ganttBarResizeDrag={id:h.dataset.id,type:h.dataset.type,pid:h.dataset.pid,startDays:parseFloat(h.dataset.days),startX:e.clientX,DAY_W,currentDays:parseFloat(h.dataset.days)};
  });
  window.addEventListener('mousemove',e=>{
    if(!ganttBarResizeDrag) return;
    const {startX,startDays,DAY_W} = ganttBarResizeDrag;
    ganttBarResizeDrag.currentDays = Math.max(1, startDays + (e.clientX-startX)/DAY_W);
    const g=document.querySelector(`[data-gbar="${ganttBarResizeDrag.id}"]`); if(!g) return;
    const bar=g.querySelector('rect.g-main'); if(!bar) return;
    const newW=Math.max(4,Math.round(ganttBarResizeDrag.currentDays*DAY_W));
    bar.setAttribute('width',newW);
    const handle=g.querySelector('.g-resize'); if(handle) handle.setAttribute('x',parseFloat(bar.getAttribute('x')) + Math.max(0,newW-7));
  });
  window.addEventListener('mouseup',async()=>{
    if(!ganttBarResizeDrag) return;
    const {id,type,pid,currentDays}=ganttBarResizeDrag; ganttBarResizeDrag=null;
    const {value,unit}=daysToValueUnit(currentDays);
    if(type==='wp') await PATCH(`/api/projects/${pid}/work-packages/${id}`,{value,unit});
    else await PATCH(`/api/projects/${pid}/phases/${id}`,{value,unit});
    await loadState(); renderTimeline();
  });
}

// ── Gantt height drag ─────────────────────────────────────────────────────────
function startGanttResize(e){ e.preventDefault(); window.__ganttResizeDrag={startY:e.clientY,startH:ganttHeight}; }
function initGanttResizeEvents(){
  if(ganttResizeSetup) return;
  ganttResizeSetup=true;
  window.addEventListener('mousemove',e=>{
    if(!window.__ganttResizeDrag) return;
    const {startY,startH}=window.__ganttResizeDrag;
    ganttHeight=Math.max(180,Math.min(window.innerHeight-160,startH+(e.clientY-startY)));
    const gs=document.getElementById('ganttScroll');
    const ll=document.querySelector('#panelTimeline [data-gantt-labels]');
    if(gs) gs.style.height=ganttHeight+'px';
    if(ll) ll.style.height=ganttHeight+'px';
  });
  window.addEventListener('mouseup',()=>{ window.__ganttResizeDrag=null; });
}

// ── Gantt helper actions ──────────────────────────────────────────────────────
function toggleGanttRow(phid){
  if(ganttCollapsed.has(phid))ganttCollapsed.delete(phid);else ganttCollapsed.add(phid);
  renderTimeline();
}

async function setGanttStartDate(pid,date){
  await PATCH(`/api/projects/${pid}`,{startDate:date});
  await loadState();
  renderTimeline();
}

// ── Main render ───────────────────────────────────────────────────────────────
function renderTimeline(){
  const proj=ap(); if(!proj) return;
  proj.taskEdges = proj.taskEdges || [];
  const {rows,totalDays,startMs} = buildGanttRows(proj);
  const ROW_H=38, LABEL_W=290, DAY_W=Math.max(3,Math.round(14*ganttZoom));
  const HEADER_H=56;
  const visibleStart=ganttViewStartDay;
  const visibleEnd=Math.max(visibleStart + ganttViewDays, totalDays + 42);
  const svgW=Math.max(900, (visibleEnd-visibleStart) * DAY_W + 40);
  const svgH=rows.length*ROW_H;
  const dx=d=>Math.round((d-visibleStart)*DAY_W);
  const projectStartLabel=fmtDateLabel(startMs);

  let headerSvg='', gridLines='';
  const firstWeek=Math.floor(visibleStart/7)*7;
  for(let d=firstWeek; d<=visibleEnd+7; d+=7){
    const x=dx(d);
    const date=new Date(startMs + d*86400000);
    const iso=isoWeekParts(date);
    headerSvg += `<line x1="${x}" y1="0" x2="${x}" y2="${HEADER_H}" stroke="var(--border)" stroke-width="0.8"/>
      <text x="${x+3}" y="15" fill="var(--muted)" font-size="10" font-weight="600" font-family="var(--font)">${iso.year} · W${String(iso.week).padStart(2,'0')}</text>
      <text x="${x+3}" y="31" fill="var(--faint)" font-size="9" font-family="var(--mono)">Project W${Math.floor(d/7)+1}</text>
      <text x="${x+3}" y="46" fill="var(--faint)" font-size="9" font-family="var(--font)">${date.toLocaleDateString('en-GB',{day:'2-digit',month:'short'})}</text>`;
    gridLines += `<line x1="${x}" y1="0" x2="${x}" y2="${svgH}" stroke="var(--border)" stroke-width="0.5" stroke-dasharray="2,5" opacity="0.55"/>`;
  }

  const todayDay=Math.round((Date.now()-startMs)/86400000);
  const todayMarker=(todayDay>=visibleStart&&todayDay<=visibleEnd)?`<line x1="${dx(todayDay)}" y1="0" x2="${dx(todayDay)}" y2="${svgH}" stroke="#e05050" stroke-width="1.5" opacity="0.8"/><polygon points="${dx(todayDay)-4},0 ${dx(todayDay)+4},0 ${dx(todayDay)},6" fill="#e05050" opacity="0.8"/>`:'';

  const aBtnStyle=`background:none;border:none;cursor:pointer;padding:1px 4px;font-size:11px;line-height:1;border-radius:3px;`;
  let labelRows='', rowsSvg='';
  rows.forEach((row,i)=>{
    const y=i*ROW_H, midY=ROW_H/2, barY=6, barH=ROW_H-12;
    const start=row.startDay ?? 0, end=row.endDay ?? start+1;
    const x1=dx(start), barW=Math.max(4, dx(end)-x1);
    const stripe=i%2===1;
    const mainColor=row.type==='wp' ? (WP_COLS[row.wp.status]||'#4a556a') : row.col;
    const isSel=ganttSelId===row.id;
    if(stripe) rowsSvg += `<rect x="0" y="${y}" width="${svgW}" height="${ROW_H}" fill="rgba(255,255,255,0.018)"/>`;
    rowsSvg += `<g transform="translate(0,${y})" data-gbar="${row.id}">
      <rect class="g-main" x="${x1}" y="${row.type==='wp'?barY+7:barY}" width="${barW}" height="${row.type==='wp'?barH-10:barH}" rx="${row.type==='wp'?2:4}" fill="${mainColor}${isSel?'50':row.type==='wp'?'38':'28'}" stroke="${mainColor}" stroke-width="${isSel?2:1.2}"/>
      ${barW>52?`<text x="${x1+6}" y="${midY+4}" fill="${mainColor}" font-size="${row.type==='wp'?10:11}" font-weight="600" font-family="var(--font)">${taskLabel(row).length>Math.max(8,Math.floor(barW/7))?taskLabel(row).slice(0,Math.max(8,Math.floor(barW/7))-1)+'…':taskLabel(row)}</text>`:''}
      <rect class="g-resize" data-id="${row.id}" data-type="${row.type}" data-pid="${proj.id}" data-days="${end-start}" x="${x1+Math.max(0,barW-8)}" y="${row.type==='wp'?barY+7:barY}" width="8" height="${row.type==='wp'?barH-10:barH}" rx="2" fill="${mainColor}66" style="cursor:ew-resize;"/>
    </g>`;

    const hasKids=(row.type!=='wp') && (((row.ph.children||[]).length>0) || ((row.ph.workPackages||[]).length>0));
    const toggle=hasKids ? (ganttCollapsed.has(row.ph.id)?'▸':'▾') : '';
    const indent=row.depth*16;
    const startTxt=fmtDateLabel(startMs + start*86400000);
    const endTxt=fmtDateLabel(startMs + end*86400000);
    const moveHtml=row.type==='wp'
      ? `<button onclick="event.stopPropagation();moveWP('${proj.id}','${row.wp.id}',-1)" title="Move up" style="${aBtnStyle}color:var(--muted)">▲</button><button onclick="event.stopPropagation();moveWP('${proj.id}','${row.wp.id}',1)" title="Move down" style="${aBtnStyle}color:var(--muted)">▼</button>`
      : `<button onclick="event.stopPropagation();movePhase('${proj.id}','${row.ph.id}',-1)" title="Move up" style="${aBtnStyle}color:var(--muted)">▲</button><button onclick="event.stopPropagation();movePhase('${proj.id}','${row.ph.id}',1)" title="Move down" style="${aBtnStyle}color:var(--muted)">▼</button>`;
    labelRows += `<div style="height:${ROW_H}px;display:flex;align-items:center;padding-left:${indent+6}px;border-bottom:1px solid var(--border);gap:6px;cursor:pointer;background:${isSel?mainColor+'14':stripe?'rgba(255,255,255,0.018)':'transparent'};border-left:${isSel?`2px solid ${mainColor}`:'2px solid transparent'};" ondblclick="openGanttDetail('${row.id}','${row.type}', event)" onmouseenter="this.querySelector('.gla').style.display='flex'" onmouseleave="this.querySelector('.gla').style.display='none'">
      <span style="font-size:10px;color:var(--muted);width:12px;flex-shrink:0;" onclick="event.stopPropagation();${row.type!=='wp'?`toggleGanttRow('${row.ph.id}')`:''}">${toggle}</span>
      <div style="width:${row.type==='wp'?6:8}px;height:${row.type==='wp'?6:8}px;border-radius:${row.type==='wp'?'50%':'2px'};background:${mainColor};flex-shrink:0;"></div>
      <div style="min-width:0;flex:1;">
        <div style="font-size:${row.type==='phase'?12:11}px;color:${row.type==='phase'?'var(--text)':'var(--muted)'};font-weight:${row.type==='phase'?700:500};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${taskLabel(row)}</div>
        <div style="font-size:9px;color:var(--faint);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${startTxt} → ${endTxt}</div>
      </div>
      <div class="gla" style="display:none;align-items:center;gap:1px;flex-shrink:0;">${moveHtml}${row.type!=='wp'?`<button onclick="event.stopPropagation();addSubphase('${proj.id}','${row.ph.id}')" title="Add subphase" style="${aBtnStyle}color:var(--teal)">⊕</button><button onclick="event.stopPropagation();addWP('${proj.id}','${row.ph.id}')" title="Add work package" style="${aBtnStyle}color:var(--muted)">📦</button><button onclick="event.stopPropagation();delPhase('${proj.id}','${row.ph.id}')" title="Delete" style="${aBtnStyle}color:var(--red)">✕</button>`:`<button onclick="event.stopPropagation();delWP('${proj.id}','${row.wp.id}')" title="Delete" style="${aBtnStyle}color:var(--red)">✕</button>`}</div>
    </div>`;
  });

  const endMs=startMs+totalDays*86400000;
  const inspectorHtml=ganttSelId ? `<div id="ganttInspector" style="position:fixed;left:${ganttInspectorPos.x}px;top:${ganttInspectorPos.y}px;width:400px;max-height:78vh;overflow:auto;z-index:90;background:var(--bg2);border:1px solid var(--border2);border-radius:12px;box-shadow:0 18px 48px rgba(0,0,0,.45);">
      <div onmousedown="startGanttInspectorDrag(event)" style="position:sticky;top:0;z-index:2;display:flex;align-items:center;justify-content:space-between;padding:10px 12px;background:var(--bg3);border-bottom:1px solid var(--border);cursor:move;">
        <span style="font-size:12px;font-weight:700;color:var(--text);">Timeline Inspector</span>
        <button onclick="ganttSelId=null;renderTimeline()" style="background:none;border:none;color:var(--faint);cursor:pointer;font-size:16px;line-height:1;">✕</button>
      </div>
      <div style="padding:12px;">${buildGanttDetailHtml(proj)}</div>
    </div>` : '';

  document.getElementById('panelTimeline').innerHTML=`
    <div class="flex-between mb15">
      <div>
        <h2 style="margin:0 0 4px;">Timeline</h2>
        <div style="font-size:12px;color:var(--muted);">Project: <span style="color:${proj.color};font-weight:600;">${proj.name}</span> · ${projectStartLabel} → ${fmtDateLabel(endMs)} · dependency-aware schedule</div>
      </div>
      <div class="flex-ac">
        <button class="btn btn-primary btn-sm" onclick="addPhase('${proj.id}')">+ Phase</button>
        <label style="font-size:11px;color:var(--muted);margin-left:6px;margin-right:4px;">Start</label>
        <input type="date" value="${proj.startDate||new Date().toISOString().slice(0,10)}" onchange="setGanttStartDate('${proj.id}',this.value)" style="font-size:12px;margin-right:6px;">
        <button class="btn btn-sm" onclick="ganttViewStartDay-=28;renderTimeline()">← 4w</button>
        <button class="btn btn-sm" onclick="ganttViewStartDay+=28;renderTimeline()">4w →</button>
        <button class="btn btn-sm" onclick="ganttViewStartDay=-14;renderTimeline()">Today</button>
        <button class="btn btn-sm" onclick="ganttZoom=Math.min(4,ganttZoom*1.25);renderTimeline()">+</button>
        <button class="btn btn-sm" onclick="ganttZoom=Math.max(0.2,ganttZoom/1.25);renderTimeline()">−</button>
      </div>
    </div>
    <div style="display:flex;border:1px solid var(--border);border-radius:10px 10px 0 0;overflow:hidden;background:var(--bg2);">
      <div style="width:${LABEL_W}px;flex-shrink:0;border-right:1px solid var(--border2);background:var(--bg2);">
        <div style="height:${HEADER_H}px;display:flex;align-items:flex-end;padding:0 8px 7px;border-bottom:1px solid var(--border2);background:var(--bg3);">
          <span style="font-size:10px;font-weight:600;color:var(--faint);text-transform:uppercase;letter-spacing:.06em;">Phase / Task · Start / End</span>
        </div>
        <div data-gantt-labels style="height:${ganttHeight}px;overflow:hidden;">${labelRows}</div>
      </div>
      <div style="flex:1;overflow:auto;height:${ganttHeight+HEADER_H}px;" id="ganttScroll">
        <svg width="${svgW}" height="${svgH+HEADER_H}" style="display:block;">
          <g><rect width="${svgW}" height="${HEADER_H}" fill="var(--bg3)"/><line x1="0" y1="${HEADER_H-1}" x2="${svgW}" y2="${HEADER_H-1}" stroke="var(--border2)" stroke-width="1"/>${headerSvg}</g>
          <g transform="translate(0,${HEADER_H})">${gridLines}${rowsSvg}${todayMarker}</g>
        </svg>
      </div>
    </div>
    <div onmousedown="startGanttResize(event)" style="height:6px;border:1px solid var(--border);border-top:none;border-radius:0 0 10px 10px;background:var(--bg3);cursor:ns-resize;display:flex;align-items:center;justify-content:center;transition:background .12s;margin-bottom:10px;" onmouseenter="this.style.background='var(--bg4)'" onmouseleave="this.style.background='var(--bg3)'"><div style="width:40px;height:2px;border-radius:1px;background:var(--border2);pointer-events:none;"></div></div>
    <div style="display:flex;gap:14px;flex-wrap:wrap;align-items:center;">
      <span style="font-size:10px;color:var(--faint);font-weight:600;text-transform:uppercase;letter-spacing:.05em;">Legend</span>
      <div style="display:flex;align-items:center;gap:5px;"><div style="width:10px;height:10px;border-radius:2px;background:#4a9eff;"></div><span style="font-size:11px;color:var(--muted);">Phase/Subphase</span></div>
      ${Object.entries(WP_COLS).map(([s,c])=>`<div style="display:flex;align-items:center;gap:5px;"><div style="width:9px;height:9px;border-radius:50%;background:${c};"></div><span style="font-size:11px;color:var(--muted);">WP: ${WP_LABELS[s]}</span></div>`).join('')}
      <div style="display:flex;align-items:center;gap:5px;"><div style="width:18px;height:2px;background:#e05050;opacity:0.75;"></div><span style="font-size:11px;color:var(--muted);">Today</span></div>
      <span style="font-size:11px;color:var(--faint);margin-left:auto;">Double-click a row for a draggable floating editor. Dependencies apply start-after-finish scheduling.</span>
    </div>
    ${inspectorHtml}`;

  initGanttResizeEvents();
  initGanttBarResizeEvents();
  initGanttInspectorEvents();
}
