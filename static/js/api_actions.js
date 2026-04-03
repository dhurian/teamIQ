// ════════════════════════════════════════════════════════════════════════════
// ACTION DISPATCHERS  (call API → reload state → re-render)
// ════════════════════════════════════════════════════════════════════════════

// ── Chart destroy helper ─────────────────────────────────────────────────────
function dc(id){if(charts[id]){charts[id].destroy();delete charts[id];}}

// ── Core dispatchers ─────────────────────────────────────────────────────────
async function act(fn){
  try {
    const result = await fn();
    if(result && result.ok===false){ console.error('API error:', result.error); return; }
    await loadState(); rerender();
  } catch(e){ console.error('act() error:', e); }
}

// Like act() but re-renders the phases panel without scrolling to top
async function actPhases(fn){
  try {
    const result = await fn();
    if(result && result.ok===false){ console.error('API error:', result.error); return; }
    await loadState();
    if(activeTab==='phases'){
      const panel=document.getElementById('panelPhases');
      const scrollEl=panel?.querySelector('div[style*="overflow-y:auto"]');
      const scrollTop=scrollEl?.scrollTop||0;
      renderPhases();
      const el=document.getElementById('panelPhases')?.querySelector('div[style*="overflow-y:auto"]');
      if(el) el.scrollTop=scrollTop;
    } else { rerender(); }
  } catch(e){ console.error('actPhases() error:', e); }
}

// ── Projects ──────────────────────────────────────────────────────────────────
const switchProject = async pid => {
  await POST('/api/active-project',{projectId:pid});
  await loadState(); rerender();
};
const addProject    = ()=>act(()=>POST('/api/projects',{}));
const delProject    = pid=>act(()=>DELETE(`/api/projects/${pid}`));
const patchProject  = (pid,d)=>act(()=>PATCH(`/api/projects/${pid}`,d));

// ── Phases ────────────────────────────────────────────────────────────────────
const addPhase = pid=>actPhases(()=>{
  const proj=S.projects?.find(p=>p.id===pid);
  const flat=proj?.phases||[];
  const allY=flat.map(p=>p.y||60); const lastY=allY.length?Math.max(...allY):60;
  return POST(`/api/projects/${pid}/phases`,{x:60,y:lastY+150});
});
const delPhase   = (pid,phid)=>actPhases(()=>DELETE(`/api/projects/${pid}/phases/${phid}`));
const patchPhase = (pid,phid,d)=>actPhases(()=>PATCH(`/api/projects/${pid}/phases/${phid}`,d));
const movePhase  = (pid,phid,dir)=>actPhases(()=>POST(`/api/projects/${pid}/phases/${phid}/move`,{direction:dir}));

// Finds a phase or subphase anywhere in the tree (client-side helper)
function findPhaseLocal(phases, phid){
  for(const ph of phases){
    if(ph.id===phid) return ph;
    const f=findPhaseLocal(ph.children||[], phid);
    if(f) return f;
  }
  return null;
}

const addSubphase = (pid,phid)=>actPhases(()=>POST(`/api/projects/${pid}/phases/${phid}/children`,{}));
const togglePhaseExpanded = (pid,phid)=>{
  const proj=S.projects?.find(p=>p.id===pid);
  const ph=findPhaseLocal(proj?.phases||[],phid); if(!ph) return;
  ph.expanded=!(ph.expanded!==false);
  actPhases(()=>PATCH(`/api/projects/${pid}/phases/${phid}`,{expanded:ph.expanded}));
};

// ── Work packages ─────────────────────────────────────────────────────────────
const addWP   = (pid,phid)=>actPhases(()=>POST(`/api/projects/${pid}/phases/${phid}/work-packages`,{}));
const patchWP = (pid,wpid,d)=>actPhases(()=>PATCH(`/api/projects/${pid}/work-packages/${wpid}`,d));
const delWP   = (pid,wpid)=>actPhases(()=>DELETE(`/api/projects/${pid}/work-packages/${wpid}`));
const moveWP  = (pid,wpid,dir)=>actPhases(()=>POST(`/api/projects/${pid}/work-packages/${wpid}/move`,{direction:dir}));

const togglePhaseSkill=(pid,phid,sk)=>{
  const proj=S.projects?.find(p=>p.id===pid);
  const ph=findPhaseLocal(proj?.phases||[],phid); if(!ph) return;
  const req={...ph.required||{}};
  if(req[sk]!==undefined) delete req[sk]; else req[sk]=6;
  actPhases(()=>PATCH(`/api/projects/${pid}/phases/${phid}`,{required:req}));
};

const updatePhaseReq=(pid,phid,sk,val)=>{
  const proj=S.projects?.find(p=>p.id===pid);
  const ph=findPhaseLocal(proj?.phases||[],phid); if(!ph) return;
  ph.required={...ph.required,[sk]:parseFloat(val)};
  PATCH(`/api/projects/${pid}/phases/${phid}`,{required:ph.required});
};

// ── Teams ─────────────────────────────────────────────────────────────────────
const addTeam      = pid=>act(()=>POST(`/api/projects/${pid}/teams`,{}));
const delTeam      = (pid,tid)=>act(()=>DELETE(`/api/projects/${pid}/teams/${tid}`));
const patchTeam    = (pid,tid,d)=>act(()=>PATCH(`/api/projects/${pid}/teams/${tid}`,d));
const selectTeam   = (pid,tid)=>act(()=>PATCH(`/api/projects/${pid}`,{selTeamId:tid,selMemberId:null}));
const selectMember = (pid,mid)=>act(()=>PATCH(`/api/projects/${pid}`,{selMemberId:mid}));

const addStandaloneMember = (pid,tid)=>act(()=>POST(`/api/projects/${pid}/teams/${tid}/members`,{}));
const delMember    = (pid,mid)=>act(()=>DELETE(`/api/projects/${pid}/members/${mid}`));
const patchMember  = (pid,mid,d)=>act(()=>PATCH(`/api/projects/${pid}/members/${mid}`,d));
const moveMember   = (pid,mid,tid)=>act(()=>POST(`/api/projects/${pid}/members/${mid}/move`,{teamId:tid}));
const unlinkMember = (pid,mid)=>act(()=>POST(`/api/projects/${pid}/members/${mid}/unlink`,{}));

const patchMemberSkill=(pid,mid,sk,type,val)=>{
  PATCH(`/api/projects/${pid}/members/${mid}`,{skill:{name:sk,type,value:parseFloat(val)}});
};

// ── Team connections ──────────────────────────────────────────────────────────
const addConnection   = (pid,d)=>act(()=>POST(`/api/projects/${pid}/connections`,d));
const delConnection   = (pid,cid)=>act(()=>DELETE(`/api/projects/${pid}/connections/${cid}`));

const addConnectionForm=pid=>{
  const from=document.getElementById('connFrom').value;
  const to=document.getElementById('connTo').value;
  const type=document.getElementById('connType').value;
  const label=document.getElementById('connLabel').value;
  addConnection(pid,{from,to,type,label});
};

// ── Org chart: multi-connect mode ─────────────────────────────────────────────
const toggleProjConnMode=async pid=>{
  const proj=ap();if(!proj)return;
  const mode=proj.orgMode==='connecting'?'none':'connecting';
  orgConnFrom=null;
  await PATCH(`/api/projects/${pid}`,{orgMode:mode});
  await loadState();renderOrgChart();
};

// Keyboard ESC exits connect mode
document.addEventListener('keydown',e=>{
  if(e.key==='Escape'&&ap()?.orgMode==='connecting'){
    orgConnFrom=null;
    PATCH(`/api/projects/${ap().id}`,{orgMode:'none'}).then(()=>loadState().then(renderOrgChart));
  }
});

const projNodeClick=async(pid,tid)=>{
  const proj=ap();if(!proj||proj.orgMode!=='connecting')return;
  if(!orgConnFrom){orgConnFrom=tid;renderOrgChart();return;}
  if(orgConnFrom===tid){orgConnFrom=null;renderOrgChart();return;}
  // Create connection — stay in connect mode, just reset source
  const label=prompt('Connection label (optional):','')||'';
  const typeIn=prompt('Type: integration | dependency | handoff | reporting','integration')||'integration';
  const valid=['integration','dependency','handoff','reporting'];
  await POST(`/api/projects/${pid}/connections`,{from:orgConnFrom,to:tid,label,type:valid.includes(typeIn)?typeIn:'integration'});
  orgConnFrom=null;
  await loadState();renderOrgChart();
};

const autoLayoutTeams=async pid=>{
  const proj=S.projects?.find(p=>p.id===pid);if(!proj)return;
  const cols=Math.ceil(Math.sqrt(proj.teams.length));
  for(const[i,t]of proj.teams.entries()){
    t.x=30+(i%cols)*(NODE_W+80);t.y=40+Math.floor(i/cols)*(NODE_H+90);
    await PATCH(`/api/projects/${pid}/teams/${t.id}`,{x:t.x,y:t.y});
  }
  await loadState();renderOrgChart();
};

// ── Org hierarchy actions ─────────────────────────────────────────────────────
const addOrgChild   = async pid=>{
  await POST(`/api/org/nodes`,{parentId:pid});
  await loadState();renderOrgHier();
};
const deleteOrgNode = async nid=>{
  if(!confirm('Delete this node and all its children?'))return;
  await DELETE(`/api/org/nodes/${nid}`);
  orgMapSelId=null;await loadState();renderOrgHier();renderSidebar();
};
const patchOrgNode  = async(nid,d)=>{
  await PATCH(`/api/org/nodes/${nid}`,d);
  await loadState();
};
const patchOrgSkill = async(nid,sk,type,val)=>{
  await PATCH(`/api/org/nodes/${nid}`,{skill:{name:sk,type,value:parseFloat(val)}});
  S.globalOrg=await GET('/api/org');
};
const orgMapSelect  = id=>{orgMapSelId=(orgMapSelId===id?null:id);renderOrgHier();};
const toggleOrgNode = async nid=>{
  await POST(`/api/org/toggle/${nid}`);
  await loadState();renderOrgHier();
};
