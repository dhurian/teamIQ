// Phase actions and graph operations

function selectPhase(phid){
  selPhaseId=(selPhaseId===phid?null:phid);
  renderPhases();
}

function phNodeClick(pid,phid){
  if(pdMode!=='connecting'){selectPhase(phid);return;}
  if(!pdConnFrom){
    pdConnFrom=phid;
    const g=document.getElementById('phGhost'); if(g) g.setAttribute('display','none');
    renderPhases(); return;
  }
  if(pdConnFrom===phid){pdConnFrom=null;renderPhases();return;}
  const fromId=pdConnFrom; pdConnFrom=null;
  const ghost=document.getElementById('phGhost'); if(ghost) ghost.setAttribute('display','none');
  POST(`/api/projects/${pid}/phase-edges`,{from:fromId,to:phid})
    .then(()=>loadState().then(()=>renderPhases()));
}

async function delPhaseEdge(pid,eid){
  await DELETE(`/api/projects/${pid}/phase-edges/${eid}`);
  await loadState(); renderPhases();
}

function togglePhDiagConnMode(pid){
  pdMode=pdMode==='connecting'?'none':'connecting';
  if(pdMode==='none') pdConnFrom=null;
  renderPhases();
}

async function phDiagAutoLayout(pid){
  const proj=S.projects?.find(p=>p.id===pid); if(!proj) return;
  const{phases,phaseEdges=[]}=proj;
  const inDeg=Object.fromEntries(phases.map(p=>[p.id,0]));
  phaseEdges.forEach(e=>{if(inDeg[e.to]!==undefined)inDeg[e.to]++;});
  const level={};
  const queue=phases.filter(p=>inDeg[p.id]===0).map(p=>p.id);
  queue.forEach(id=>level[id]=0);
  while(queue.length){
    const cur=queue.shift();
    phaseEdges.filter(e=>e.from===cur).forEach(e=>{
      level[e.to]=Math.max(level[e.to]||0,(level[cur]||0)+1);
      if(--inDeg[e.to]===0) queue.push(e.to);
    });
  }
  const byLevel={};
  phases.forEach(p=>{const lv=level[p.id]??0;(byLevel[lv]||(byLevel[lv]=[])).push(p.id);});
  for(const[lv,ids]of Object.entries(byLevel)){
    ids.forEach((id,col)=>{
      const ph=proj.phases.find(p=>p.id===id); if(!ph) return;
      ph.x=60+col*240; ph.y=50+parseInt(lv)*150;
    });
  }
  await Promise.all(proj.phases.map(ph=>
    PATCH(`/api/projects/${pid}/phases/${ph.id}`,{x:ph.x,y:ph.y})));
  await loadState(); renderPhases();
}
