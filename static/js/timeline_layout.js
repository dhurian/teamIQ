// Timeline layout/scheduling/render orchestration

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

// ── Inspector drag & floating panel ──────────────────────────────────────────

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

  const {headerSvg, gridLines} = buildTimelineHeaderGrid(startMs, visibleStart, visibleEnd, dx, HEADER_H, svgH);

  const todayDay=Math.round((Date.now()-startMs)/86400000);
  const todayMarker=(todayDay>=visibleStart&&todayDay<=visibleEnd)
    ? `<line x1="${dx(todayDay)}" y1="0" x2="${dx(todayDay)}" y2="${svgH}" stroke="#e05050" stroke-width="1.5" opacity="0.8"/><polygon points="${dx(todayDay)-4},0 ${dx(todayDay)+4},0 ${dx(todayDay)},6" fill="#e05050" opacity="0.8"/>`
    : '';

  const {labelRows, rowsSvg} = buildTimelineRowsMarkup(rows, {
    proj,
    ROW_H,
    svgW,
    dx,
    startMs,
    aBtnStyle: GANTT_ACTION_BTN_STYLE,
  });

  const endMs=startMs+totalDays*86400000;
  const inspectorHtml=buildTimelineInspectorHtml(proj);

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
