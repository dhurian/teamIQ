// Timeline interaction event handlers

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
