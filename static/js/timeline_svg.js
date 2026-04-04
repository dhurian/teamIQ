// Timeline SVG/markup builders

const GANTT_ACTION_BTN_STYLE = 'background:none;border:none;cursor:pointer;padding:1px 4px;font-size:11px;line-height:1;border-radius:3px;';

function buildTimelineHeaderGrid(startMs, visibleStart, visibleEnd, dx, headerHeight, svgHeight){
  let headerSvg='';
  let gridLines='';
  const firstWeek=Math.floor(visibleStart/7)*7;
  for(let d=firstWeek; d<=visibleEnd+7; d+=7){
    const x=dx(d);
    const date=new Date(startMs + d*86400000);
    const iso=isoWeekParts(date);
    headerSvg += `<line x1="${x}" y1="0" x2="${x}" y2="${headerHeight}" stroke="var(--border)" stroke-width="0.8"/>
      <text x="${x+3}" y="15" fill="var(--muted)" font-size="10" font-weight="600" font-family="var(--font)">${iso.year} · W${String(iso.week).padStart(2,'0')}</text>
      <text x="${x+3}" y="31" fill="var(--faint)" font-size="9" font-family="var(--mono)">Project W${Math.floor(d/7)+1}</text>
      <text x="${x+3}" y="46" fill="var(--faint)" font-size="9" font-family="var(--font)">${date.toLocaleDateString('en-GB',{day:'2-digit',month:'short'})}</text>`;
    gridLines += `<line x1="${x}" y1="0" x2="${x}" y2="${svgHeight}" stroke="var(--border)" stroke-width="0.5" stroke-dasharray="2,5" opacity="0.55"/>`;
  }
  return {headerSvg, gridLines};
}

function buildTimelineRowsMarkup(rows, ctx){
  const {proj, ROW_H, svgW, dx, startMs, aBtnStyle} = ctx;
  let labelRows='';
  let rowsSvg='';

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

  return {labelRows, rowsSvg};
}

function buildTimelineInspectorHtml(proj){
  if(!ganttSelId) return '';
  return `<div id="ganttInspector" style="position:fixed;left:${ganttInspectorPos.x}px;top:${ganttInspectorPos.y}px;width:400px;max-height:78vh;overflow:auto;z-index:90;background:var(--bg2);border:1px solid var(--border2);border-radius:12px;box-shadow:0 18px 48px rgba(0,0,0,.45);">
      <div onmousedown="startGanttInspectorDrag(event)" style="position:sticky;top:0;z-index:2;display:flex;align-items:center;justify-content:space-between;padding:10px 12px;background:var(--bg3);border-bottom:1px solid var(--border);cursor:move;">
        <span style="font-size:12px;font-weight:700;color:var(--text);">Timeline Inspector</span>
        <button onclick="ganttSelId=null;renderTimeline()" style="background:none;border:none;color:var(--faint);cursor:pointer;font-size:16px;line-height:1;">✕</button>
      </div>
      <div style="padding:12px;">${buildGanttDetailHtml(proj)}</div>
    </div>`;
}
