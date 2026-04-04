// ════════════════════════════════════════════════════════════════════════════
// TIMELINE – bar drag (right-edge / left-edge / whole-bar), gantt resize, render
// ════════════════════════════════════════════════════════════════════════════

// ── Bar drag events (right-edge · left-edge · whole-bar) ──────────────────
function initGanttBarResizeEvents(){
  if(ganttBarResizeSetup) return;
  ganttBarResizeSetup = true;

  // ── mousedown: decide which drag mode ──────────────────────────────────
  document.addEventListener('mousedown', e=>{
    const DAY_W = Math.max(3, Math.round(14*ganttZoom));

    // Right-edge resize (existing) ─────────────────────────────────────────
    const rh = e.target.closest?.('.g-resize');
    if(rh && !rh.classList.contains('g-resize-left')){
      e.preventDefault(); e.stopPropagation();
      ganttBarResizeDrag = {
        id:rh.dataset.id, type:rh.dataset.type, pid:rh.dataset.pid,
        startDays:parseFloat(rh.dataset.days), startX:e.clientX, DAY_W,
        currentDays:parseFloat(rh.dataset.days)
      };
      return;
    }

    // Left-edge resize → moves start date, keeps end fixed ────────────────
    const lh = e.target.closest?.('.g-resize-left');
    if(lh){
      e.preventDefault(); e.stopPropagation();
      const g = lh.closest('[data-gbar]');
      const bar = g?.querySelector('rect.g-main');
      ganttBarStartDrag = {
        id:lh.dataset.id, type:lh.dataset.type, pid:lh.dataset.pid,
        origStart:parseFloat(lh.dataset.start), origEnd:parseFloat(lh.dataset.end),
        startX:e.clientX, DAY_W,
        origX1: bar ? parseFloat(bar.getAttribute('x')) : 0,
        origW:  bar ? parseFloat(bar.getAttribute('width')) : 0,
        currentStart:parseFloat(lh.dataset.start)
      };
      return;
    }

    // Whole-bar move → shifts start date, preserves duration ──────────────
    const mb = e.target.closest?.('.g-move');
    if(mb){
      e.preventDefault(); e.stopPropagation();
      const bar = mb.closest('[data-gbar]')?.querySelector('rect.g-main') || mb;
      ganttBarMoveDrag = {
        id:mb.dataset.id, type:mb.dataset.type, pid:mb.dataset.pid,
        origStart:parseFloat(mb.dataset.start), origEnd:parseFloat(mb.dataset.end),
        startX:e.clientX, DAY_W,
        origX1: parseFloat(bar.getAttribute('x')),
        origW:  parseFloat(bar.getAttribute('width')),
        currentStart:parseFloat(mb.dataset.start),
        moved:false
      };
    }
  });

  // ── mousemove: live visual feedback ────────────────────────────────────
  window.addEventListener('mousemove', e=>{

    // Right-edge ────────────────────────────────────────────────────────────
    if(ganttBarResizeDrag){
      const {startX,startDays,DAY_W} = ganttBarResizeDrag;
      ganttBarResizeDrag.currentDays = Math.max(1, startDays + (e.clientX-startX)/DAY_W);
      const g = document.querySelector(`[data-gbar="${ganttBarResizeDrag.id}"]`); if(!g) return;
      const bar = g.querySelector('rect.g-main'); if(!bar) return;
      const newW = Math.max(4, Math.round(ganttBarResizeDrag.currentDays*DAY_W));
      bar.setAttribute('width', newW);
      const rh = g.querySelector('.g-resize');
      if(rh) rh.setAttribute('x', parseFloat(bar.getAttribute('x')) + Math.max(0, newW-8));
      return;
    }

    // Left-edge ─────────────────────────────────────────────────────────────
    if(ganttBarStartDrag){
      const {startX,origX1,origW,origStart,origEnd,DAY_W} = ganttBarStartDrag;
      const pxDelta = e.clientX - startX;
      // clamp: start can't pass end − 1 day
      const maxPxDelta = (origEnd - origStart - 1) * DAY_W;
      const clampedDelta = Math.min(pxDelta, maxPxDelta);
      const newX1 = origX1 + clampedDelta;
      const newW  = Math.max(4, origW - clampedDelta);
      ganttBarStartDrag.currentStart = origStart + clampedDelta / DAY_W;

      const g = document.querySelector(`[data-gbar="${ganttBarStartDrag.id}"]`); if(!g) return;
      const bar = g.querySelector('rect.g-main'); if(!bar) return;
      bar.setAttribute('x', newX1);
      bar.setAttribute('width', newW);
      const lh = g.querySelector('.g-resize-left');
      if(lh) lh.setAttribute('x', newX1);
      const txt = g.querySelector('text');
      if(txt) txt.setAttribute('x', newX1 + 6);
      return;
    }

    // Whole-bar move ────────────────────────────────────────────────────────
    if(ganttBarMoveDrag){
      const {startX,origX1,origW,origStart,DAY_W} = ganttBarMoveDrag;
      const pxDelta = e.clientX - startX;
      if(Math.abs(pxDelta) > 3) ganttBarMoveDrag.moved = true;
      const newX1 = origX1 + pxDelta;
      ganttBarMoveDrag.currentStart = origStart + pxDelta / DAY_W;

      const g = document.querySelector(`[data-gbar="${ganttBarMoveDrag.id}"]`); if(!g) return;
      const bar = g.querySelector('rect.g-main'); if(!bar) return;
      bar.setAttribute('x', newX1);
      const lh = g.querySelector('.g-resize-left');
      const rh = g.querySelector('.g-resize');
      if(lh) lh.setAttribute('x', newX1);
      if(rh) rh.setAttribute('x', newX1 + Math.max(0, origW - 8));
      const txt = g.querySelector('text');
      if(txt) txt.setAttribute('x', newX1 + 6);
    }
  });

  // ── mouseup: commit to API ──────────────────────────────────────────────
  window.addEventListener('mouseup', async ()=>{

    // Right-edge ────────────────────────────────────────────────────────────
    if(ganttBarResizeDrag){
      const {id,type,pid,currentDays} = ganttBarResizeDrag; ganttBarResizeDrag=null;
      const {value,unit} = daysToValueUnit(currentDays);
      if(type==='wp') await PATCH(`/api/projects/${pid}/work-packages/${id}`,{value,unit});
      else            await PATCH(`/api/projects/${pid}/phases/${id}`,{value,unit});
      await loadState(); renderTimeline();
      return;
    }

    // Left-edge ─────────────────────────────────────────────────────────────
    if(ganttBarStartDrag){
      const {id,type,pid,origEnd,currentStart} = ganttBarStartDrag; ganttBarStartDrag=null;
      const newDate = dateInputFromProjectDay(ganttStartMs, Math.round(currentStart));
      const newDuration = Math.max(1, origEnd - currentStart);
      const {value,unit} = daysToValueUnit(newDuration);
      const patch = {startDateOverride:newDate, value, unit};
      if(type==='wp') await PATCH(`/api/projects/${pid}/work-packages/${id}`, patch);
      else            await PATCH(`/api/projects/${pid}/phases/${id}`, patch);
      await loadState(); renderTimeline();
      return;
    }

    // Whole-bar move ────────────────────────────────────────────────────────
    if(ganttBarMoveDrag){
      const {id,type,pid,currentStart,moved} = ganttBarMoveDrag; ganttBarMoveDrag=null;
      if(!moved) return;   // treat micro-drag as a click — don't save
      const newDate = dateInputFromProjectDay(ganttStartMs, Math.round(currentStart));
      if(type==='wp') await PATCH(`/api/projects/${pid}/work-packages/${id}`,{startDateOverride:newDate});
      else            await PATCH(`/api/projects/${pid}/phases/${id}`,{startDateOverride:newDate});
      await loadState(); renderTimeline();
    }
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
  // Click on the SVG canvas (not on a bar) deselects current row
  window.addEventListener('click', e=>{
    if(!ganttSelId) return;
    const scroll=document.getElementById('ganttScroll');
    if(!scroll) return;
    if(scroll.contains(e.target) && !e.target.closest('[data-gbar]')){
      ganttSelId=null; renderTimeline();
    }
  });
  // ESC closes the inspector
  window.addEventListener('keydown', e=>{
    if(e.key==='Escape' && ganttSelId){ ganttSelId=null; renderTimeline(); }
  });
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
  ganttStartMs = startMs;   // share with drag handlers

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

    // Per-type bar geometry
    const bY  = row.type==='wp' ? barY+7  : barY;
    const bH  = row.type==='wp' ? barH-10 : barH;
    const bRx = row.type==='wp' ? 2 : 4;
    const fillOpacity = isSel?'50': row.type==='wp'?'38':'28';

    // Show edge handles only when bar is wide enough
    const showHandles = barW > 16;

    if(stripe) rowsSvg += `<rect x="0" y="${y}" width="${svgW}" height="${ROW_H}" fill="rgba(255,255,255,0.018)"/>`;

    rowsSvg += `<g transform="translate(0,${y})" data-gbar="${row.id}">
      <!-- main bar – whole-bar drag -->
      <rect class="g-main g-move"
        x="${x1}" y="${bY}" width="${barW}" height="${bH}" rx="${bRx}"
        data-id="${row.id}" data-type="${row.type}" data-pid="${proj.id}"
        data-start="${start}" data-end="${end}"
        fill="${mainColor}${fillOpacity}" stroke="${mainColor}" stroke-width="${isSel?2:1.2}"
        style="cursor:grab;"/>
      ${barW>52?`<text x="${x1+6}" y="${midY+4}" fill="${mainColor}" font-size="${row.type==='wp'?10:11}" font-weight="600" font-family="var(--font)" style="pointer-events:none;">${taskLabel(row).length>Math.max(8,Math.floor(barW/7))?taskLabel(row).slice(0,Math.max(8,Math.floor(barW/7))-1)+'…':taskLabel(row)}</text>`:''}
      ${showHandles?`
      <!-- left-edge handle – moves start date -->
      <rect class="g-resize-left"
        data-id="${row.id}" data-type="${row.type}" data-pid="${proj.id}"
        data-start="${start}" data-end="${end}"
        x="${x1}" y="${bY}" width="8" height="${bH}" rx="${bRx}"
        fill="${mainColor}88" style="cursor:w-resize;"/>
      <!-- right-edge handle – changes duration -->
      <rect class="g-resize"
        data-id="${row.id}" data-type="${row.type}" data-pid="${proj.id}" data-days="${end-start}"
        x="${x1+Math.max(0,barW-8)}" y="${bY}" width="8" height="${bH}" rx="2"
        fill="${mainColor}88" style="cursor:e-resize;"/>`:''}
    </g>`;

    const hasKids=(row.type!=='wp') && (((row.ph.children||[]).length>0) || ((row.ph.workPackages||[]).length>0));
    const toggle=hasKids ? (ganttCollapsed.has(row.ph.id)?'▸':'▾') : '';
    const indent=row.depth*16;
    const startTxt=fmtDateLabel(startMs + start*86400000);
    const endTxt=fmtDateLabel(startMs + end*86400000);
    const moveHtml=row.type==='wp'
      ? `<button onclick="event.stopPropagation();moveWP('${proj.id}','${row.wp.id}',-1)" title="Move up" style="${aBtnStyle}color:var(--muted)">▲</button><button onclick="event.stopPropagation();moveWP('${proj.id}','${row.wp.id}',1)" title="Move down" style="${aBtnStyle}color:var(--muted)">▼</button>`
      : `<button onclick="event.stopPropagation();movePhase('${proj.id}','${row.ph.id}',-1)" title="Move up" style="${aBtnStyle}color:var(--muted)">▲</button><button onclick="event.stopPropagation();movePhase('${proj.id}','${row.ph.id}',1)" title="Move down" style="${aBtnStyle}color:var(--muted)">▼</button>`;
    labelRows += `<div style="height:${ROW_H}px;display:flex;align-items:center;padding-left:${indent+6}px;border-bottom:1px solid var(--border);gap:6px;cursor:pointer;background:${isSel?mainColor+'14':stripe?'rgba(255,255,255,0.018)':'transparent'};border-left:${isSel?`2px solid ${mainColor}`:'2px solid transparent'};" onclick="openGanttDetail('${row.id}','${row.type}', event)" onmouseenter="this.querySelector('.gla').style.display='flex'" onmouseleave="this.querySelector('.gla').style.display='none'">
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
      <span style="font-size:11px;color:var(--faint);margin-left:auto;">Drag bar to move · drag edges to resize · click row label to inspect.</span>
    </div>
    ${inspectorHtml}`;

  initGanttResizeEvents();
  initGanttBarResizeEvents();
  initGanttInspectorEvents();
}
