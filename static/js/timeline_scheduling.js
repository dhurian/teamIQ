// ════════════════════════════════════════════════════════════════════════════
// TIMELINE – task registry, predecessor graph, Gantt row scheduling
// ════════════════════════════════════════════════════════════════════════════

// ── Task registry ─────────────────────────────────────────────────────────────
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

// ── Predecessor management ────────────────────────────────────────────────────
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

// ── Gantt row scheduling ──────────────────────────────────────────────────────
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
      // When an explicit start override is set it wins over predecessor constraints.
      let startDay=startOverride!=null ? startOverride : minStart;
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
