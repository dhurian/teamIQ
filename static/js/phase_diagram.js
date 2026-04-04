// Phase diagram rendering + interaction

function _phX(ph,i){ return (ph.x!=null&&!isNaN(ph.x))?ph.x:60; }
function _phY(ph,i){ return (ph.y!=null&&!isNaN(ph.y))?ph.y:60+i*150; }

// ── Main render ───────────────────────────────────────────────────────────────
function renderPhases(){
  const proj = ap();
  if(!proj) return;

  const phases = proj.phases || [];
  const totalWeeks = phases.reduce((acc, ph)=>acc + phaseWeeks(ph), 0).toFixed(1);
  const cards = phases.map((ph, pi)=>phaseCard(ph, pi, proj)).join('');

  const phasePanelHeight = Math.max(380, window.innerHeight - 218);
  const leftFlex = phaseCardsMin ? '0 0 30px' : phaseDiagMin ? '1 1 0' : `${phaseSplit} 1 0`;
  const rightFlex = phaseDiagMin ? '0 0 30px' : phaseCardsMin ? '1 1 0' : `${1-phaseSplit} 1 0`;
  const showHandle = !phaseCardsMin && !phaseDiagMin;

  const diagramHeight = Math.max(200, phasePanelHeight - 64);
  const diagramSvg = buildPhaseDiagram(proj, diagramHeight);

  document.getElementById('panelPhases').innerHTML = `
    ${phaseProjectHeaderHtml(proj, totalWeeks)}
    <div class="phase-bar mb15" style="flex-shrink:0;">${phaseSummaryBarHtml(phases)}</div>
    <div style="display:flex;height:${phasePanelHeight}px;border:1px solid var(--border);border-radius:10px;overflow:hidden;flex-shrink:0;background:var(--bg2);">
      ${phaseCardsPaneHtml(cards, leftFlex)}
      ${phaseDragHandleHtml(showHandle)}
      ${phaseDiagramPaneHtml(proj, diagramSvg, rightFlex)}
    </div>`;

  initPhaseDiagramEvents(proj.id);
  initPhaseSplitEvents();
}

// ── Phase card (recursive) ────────────────────────────────────────────────────
function phaseCard(ph, pi, proj, depth=0){
  const col   = PCOLS[pi%4];
  const isSel = ph.id===selPhaseId;
  const isFirst = pi===0, isLast = pi===(depth===0?proj.phases:proj.phases).length-1;

  // Duration input
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

  // Work packages
  const wps = (ph.workPackages||[]).map(wp=>wpRow(wp,proj,ph)).join('');
  const wpSection = `
    <div class="sep" style="margin:.75rem 0;"></div>
    <div class="flex-between" style="margin-bottom:6px;">
      <h3 style="margin:0;font-size:10px;">Work Packages (${(ph.workPackages||[]).length})</h3>
      <button class="btn btn-sm" onclick="event.stopPropagation();addWP('${proj.id}','${ph.id}')">+ Add</button>
    </div>
    ${wps||'<div style="font-size:11px;color:var(--faint);">No work packages yet</div>'}`;

  // Subphases
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

// ── Work package row ──────────────────────────────────────────────────────────
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

// ── Diagram ───────────────────────────────────────────────────────────────────
function buildPhaseDiagram(proj, svgH=520){
  const {phases, phaseEdges=[]} = proj;
  phases.forEach((ph,i)=>{ ph.x=_phX(ph,i); ph.y=_phY(ph,i); });
  const phMap = Object.fromEntries(phases.map(p=>[p.id,p]));

  let edgesSvg='';
  phaseEdges.forEach(e=>{
    const f=phMap[e.from], t=phMap[e.to]; if(!f||!t) return;
    const x1=f.x+PH_W/2, y1=f.y+PH_H, x2=t.x+PH_W/2, y2=t.y, my=(y1+y2)/2;
    const col=PCOLS[phases.findIndex(p=>p.id===e.from)%4]||'#4a9eff';
    edgesSvg+=`<g class="ph-edge"><path d="M${x1},${y1} C${x1},${my} ${x2},${my} ${x2},${y2}"
      stroke="${col}" stroke-width="2" fill="none" marker-end="url(#pharr)"
      style="cursor:pointer;" onclick="delPhaseEdge('${proj.id}','${e.id}')"/>
      <title>Click to remove connection</title></g>`;
  });

  let nodesSvg='';
  phases.forEach((ph,pi)=>{
    const col=PCOLS[pi%4];
    const isSel=ph.id===selPhaseId, isSrc=pdConnFrom===ph.id;
    const reqKeys=Object.keys(ph.required||{}).slice(0,3);
    const reqStr=reqKeys.join(', ')+(Object.keys(ph.required||{}).length>3?'…':'');
    const subCount=(ph.children||[]).length;
    const wpCount=(ph.workPackages||[]).length;
    const dur=durationLabel(ph);
    nodesSvg+=`<g class="ph-node" data-phid="${ph.id}" data-pid="${proj.id}"
        transform="translate(${ph.x},${ph.y})"
        style="cursor:${pdMode==='connecting'?'crosshair':'move'};"
        onclick="phNodeClick('${proj.id}','${ph.id}')">
      <rect width="${PH_W}" height="${PH_H}" rx="8"
        fill="${isSel||isSrc?col+'22':'#1e2535'}"
        stroke="${isSel?col:isSrc?col:col+'66'}" stroke-width="${isSel||isSrc?2.5:1.5}"
        ${isSrc?`filter="drop-shadow(0 0 8px ${col}88)"`:''}/>
      <rect width="${PH_W}" height="5" rx="8" fill="${col}"/>
      <rect width="${PH_W}" y="2" height="3" fill="${col}"/>
      <text x="12" y="24" fill="${col}" font-size="11" font-weight="700" font-family="Segoe UI,system-ui">${ph.name.length>22?ph.name.slice(0,21)+'…':ph.name}</text>
      <text x="12" y="40" fill="#8893a8" font-size="10" font-family="Segoe UI,system-ui">${dur}${reqStr?' · '+reqStr:''}</text>
      ${subCount?`<rect x="12" y="50" width="${28+subCount*4}" height="14" rx="3" fill="#4a9eff22"/>
        <text x="16" y="61" fill="#4a9eff" font-size="9" font-family="Segoe UI,system-ui">⊟ ${subCount} sub</text>`:''}
      ${wpCount?`<rect x="${subCount?48+subCount*4:12}" y="50" width="${24+wpCount*4}" height="14" rx="3" fill="#1fb88522"/>
        <text x="${subCount?52+subCount*4:16}" y="61" fill="#1fb885" font-size="9" font-family="Segoe UI,system-ui">📦 ${wpCount}</text>`:''}
      <text x="${PH_W-10}" y="${PH_H-10}" text-anchor="end" fill="${col}66" font-size="18" font-weight="700" font-family="Consolas,monospace">${pi+1}</text>
      ${isSel?`<g onclick="event.stopPropagation();delPhase('${proj.id}','${ph.id}')" transform="translate(${PH_W-18},6)" style="cursor:pointer;">
        <circle r="8" fill="#e0505044" stroke="#e0505088"/>
        <text x="0" y="4" text-anchor="middle" fill="#e05050" font-size="10">✕</text></g>`:''}
    </g>`;
  });

  const ghostSvg=`<line id="phGhost" stroke="#4a9eff" stroke-width="2" stroke-dasharray="6,3" display="none" x1="0" y1="0" x2="0" y2="0"/>`;

  return`<svg id="phDiagSvg" width="100%" height="${svgH}"
       style="display:block;background:var(--bg3);cursor:${pdMode==='connecting'?'crosshair':'grab'}">
    <defs><marker id="pharr" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
      <polygon points="0 0,8 3,0 6" fill="#4a9eff88"/></marker></defs>
    <g id="phDiagG" transform="translate(${pdPan.x},${pdPan.y}) scale(${pdZoom})">
      <g id="phEdgesG">${edgesSvg}</g>
      <g id="phNodesG">${nodesSvg}</g>
      ${ghostSvg}
    </g>
  </svg>`;
}

function phUpdateTransform(){
  const g=document.getElementById('phDiagG');
  if(g) g.setAttribute('transform',`translate(${pdPan.x},${pdPan.y}) scale(${pdZoom})`);
}

function initPhaseDiagramEvents(pid){
  const svg=document.getElementById('phDiagSvg'); if(!svg) return;

  svg.querySelectorAll('.ph-node').forEach(el=>{
    el.addEventListener('mousedown',e=>{
      if(pdMode==='connecting') return;
      const phid=el.dataset.phid;
      const ph=ap()?.phases?.find(p=>p.id===phid); if(!ph) return;
      const rect=svg.getBoundingClientRect();
      const phx=_phX(ph,0), phy=_phY(ph,0);
      pdDrag={pid,phid,sx:(e.clientX-rect.left)/pdZoom-pdPan.x/pdZoom-phx,
                        sy:(e.clientY-rect.top)/pdZoom-pdPan.y/pdZoom-phy};
      e.preventDefault(); e.stopPropagation();
    });
  });

  svg.addEventListener('mousedown',e=>{
    if(e.target.closest('.ph-node')) return;
    pdPanning={sx:e.clientX-pdPan.x, sy:e.clientY-pdPan.y};
    svg.style.cursor='grabbing';
  });

  svg.addEventListener('mousemove',e=>{
    const rect=svg.getBoundingClientRect();
    const mx=(e.clientX-rect.left-pdPan.x)/pdZoom;
    const my=(e.clientY-rect.top-pdPan.y)/pdZoom;

    if(pdDrag){
      const proj=S.projects?.find(p=>p.id===pdDrag.pid);
      const ph=proj?.phases?.find(p=>p.id===pdDrag.phid); if(!ph) return;
      ph.x = mx - pdDrag.sx;
      ph.y = my - pdDrag.sy;
      _redrawPhaseDiagram(proj);
      const {pid:_pid,phid:_phid}=pdDrag;
      const _x=ph.x, _y=ph.y;
      clearTimeout(pdDrag._t);
      pdDrag._t=setTimeout(()=>PATCH(`/api/projects/${_pid}/phases/${_phid}`,{x:_x,y:_y}),400);
      return;
    }
    if(pdPanning){
      pdPan.x=e.clientX-pdPanning.sx; pdPan.y=e.clientY-pdPanning.sy;
      phUpdateTransform(); return;
    }
    if(pdMode==='connecting'&&pdConnFrom){
      const ph=ap()?.phases?.find(p=>p.id===pdConnFrom); if(!ph) return;
      const ghost=document.getElementById('phGhost'); if(!ghost) return;
      ghost.setAttribute('x1',_phX(ph,0)+PH_W/2);
      ghost.setAttribute('y1',_phY(ph,0)+PH_H/2);
      ghost.setAttribute('x2',mx); ghost.setAttribute('y2',my);
      ghost.setAttribute('display','block');
    }
  });

  svg.addEventListener('mouseup',()=>{
    pdDrag=null; pdPanning=null;
    if(pdMode!=='connecting') svg.style.cursor='grab';
  });
  svg.addEventListener('mouseleave',()=>{pdDrag=null; pdPanning=null;});
  svg.addEventListener('wheel',e=>{
    e.preventDefault();
    pdZoom=Math.max(.3,Math.min(2,pdZoom+(e.deltaY>0?-.1:.1)));
    phUpdateTransform();
  },{passive:false});
}

function _redrawPhaseDiagram(proj){
  const{phases,phaseEdges=[]}=proj;
  const phMap=Object.fromEntries(phases.map(p=>[p.id,p]));
  const nodesG=document.getElementById('phNodesG'); if(!nodesG) return;
  nodesG.querySelectorAll('.ph-node').forEach(el=>{
    const ph=phMap[el.dataset.phid]; if(!ph) return;
    el.setAttribute('transform',`translate(${_phX(ph,0)},${_phY(ph,0)})`);
  });
  const edgesG=document.getElementById('phEdgesG'); if(!edgesG) return;
  edgesG.innerHTML='';
  phaseEdges.forEach(e=>{
    const f=phMap[e.from],t=phMap[e.to]; if(!f||!t) return;
    const x1=_phX(f,0)+PH_W/2, y1=_phY(f,0)+PH_H, x2=_phX(t,0)+PH_W/2, y2=_phY(t,0), my=(y1+y2)/2;
    const col=PCOLS[phases.findIndex(p=>p.id===e.from)%4]||'#4a9eff';
    const path=document.createElementNS('http://www.w3.org/2000/svg','path');
    path.setAttribute('d',`M${x1},${y1} C${x1},${my} ${x2},${my} ${x2},${y2}`);
    path.setAttribute('stroke',col); path.setAttribute('stroke-width','2');
    path.setAttribute('fill','none'); path.setAttribute('marker-end','url(#pharr)');
    path.style.cursor='pointer';
    path.addEventListener('click',()=>delPhaseEdge(proj.id,e.id));
    edgesG.appendChild(path);
  });
}

