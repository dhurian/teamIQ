// Phase diagram rendering + interaction

function _phX(ph,i){ return (ph.x!=null&&!isNaN(ph.x))?ph.x:60; }
function _phY(ph,i){ return (ph.y!=null&&!isNaN(ph.y))?ph.y:60+i*150; }

// ── Main render ───────────────────────────────────────────────────────────────

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

