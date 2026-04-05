// ════════════════════════════════════════════════════════════════════════════
// IMPORT PICKER
// ════════════════════════════════════════════════════════════════════════════

// ── SECTION: state ────────────────────────────────────────────────────────────
let importChecked    = new Set();  // selected orgIds (persons only)
let importAllocations = {};        // orgId → allocation % (default 100)

// ── SECTION: open / close ─────────────────────────────────────────────────────
function openImportPicker(){ importChecked=new Set(); importAllocations={}; renderImportPicker(); document.getElementById('importOverlay').style.display='flex'; }
function closeImportPicker(){ document.getElementById('importOverlay').style.display='none'; }

// ── SECTION: render picker ────────────────────────────────────────────────────
function renderImportPicker(){
  const proj=ap();if(!proj)return;
  const usedOrgIds=new Set(proj.teams.flatMap(t=>t.members.filter(m=>m.orgId).map(m=>m.orgId)));

  // Pre-compute cross-project allocation per orgId from all projects in S
  const crossAlloc={};
  (S.projects||[]).forEach(p=>{
    p.teams.forEach(t=>{
      t.members.forEach(m=>{
        if(m.orgId){
          crossAlloc[m.orgId]=(crossAlloc[m.orgId]||0)+(m.allocation??100);
        }
      });
    });
  });

  function allocBadge(orgId){
    const tot=crossAlloc[orgId]||0;
    if(!tot) return '';
    const col=tot>100?C.red:tot>=80?C.amber:C.teal;
    return `<span style="font-size:10px;font-weight:700;color:${col};margin-left:6px;">${tot}%</span>`;
  }

  function pickRow(node,depth){
    const col=ORG_TYPE_COLOR[node.type]||'#888';
    const persons=flatPersonsUnder(node);
    const allUsed=persons.length>0&&persons.every(p=>usedOrgIds.has(p.id));
    const checked=importChecked.has(node.id);
    const isP=node.type==='person';
    const sub=isP?node.role:persons.length+' people';
    const indent=depth>0?`padding-left:${depth*18}px`:'';
    const allocInput=isP&&checked?
      `<input type="number" min="0" max="200" value="${importAllocations[node.id]??100}"
        style="width:50px;font-size:11px;padding:1px 4px;border-radius:4px;border:1px solid var(--border);background:var(--bg3);color:var(--text);margin-left:4px;text-align:center;"
        title="Allocation % to this project"
        onclick="event.stopPropagation()"
        onchange="importAllocations['${node.id}']=Math.min(200,Math.max(0,parseInt(this.value)||100))">%`:'';
    return`<div class="pick-row" style="${indent}">
      <input type="checkbox" ${checked?'checked':''} ${allUsed&&!checked?'disabled title="All assigned"':''}
        onchange="togglePick('${node.id}',this.checked);renderImportPicker()">
      <div style="width:16px;height:16px;border-radius:3px;background:${col}18;color:${col};display:flex;align-items:center;justify-content:center;font-size:10px;flex-shrink:0;">${ORG_TYPE_ICON[node.type]||'●'}</div>
      <div style="flex:1;min-width:0;">
        <div style="font-size:13px;font-weight:${isP?500:600};display:flex;align-items:center;">
          ${node.name}${isP?allocBadge(node.id):''}
        </div>
        ${sub?`<div style="font-size:11px;color:var(--faint);">${sub}</div>`:''}
      </div>
      ${allocInput}
    </div>${(!isP&&node.children?.length)?node.children.map(c=>pickRow(c,depth+1)).join(''):''}`;
  }

  const body=(S.globalOrg?.children||[]).map(n=>pickRow(n,0)).join('');
  const selCount=[...importChecked].reduce((a,id)=>{const n=findNode(S.globalOrg,id);return a+flatPersonsUnder(n||{}).length;},0)
    + [...importChecked].filter(id=>findNode(S.globalOrg,id)?.type==='person').length
    - [...importChecked].filter(id=>{const n=findNode(S.globalOrg,id);return n?.type==='person'&&flatPersonsUnder(n).length===0;}).length;
  // Simpler count: just persons directly selected
  const personCount=[...importChecked].filter(id=>findNode(S.globalOrg,id)?.type==='person').length;

  document.getElementById('importOverlay').innerHTML=`
    <div class="import-panel">
      <div class="import-header">
        <div><div style="font-size:15px;font-weight:700;">Import from Organization</div>
          <div style="font-size:12px;color:var(--muted);margin-top:2px;">Adding to: <span style="color:${proj.color};font-weight:600;">${proj.teams.find(t=>t.id===proj.selTeamId)?.name||'team'}</span></div></div>
        <button class="btn btn-danger btn-sm" onclick="closeImportPicker()">✕</button>
      </div>
      <div style="padding:8px 16px;background:var(--bg2);border-bottom:1px solid var(--border);font-size:11px;color:var(--faint);">
        Coloured % = current cross-project allocation. Set allocation to this project per person.
      </div>
      <div class="import-body">${body}</div>
      <div class="import-footer">
        <div style="font-size:13px;color:var(--muted);">${personCount} people selected</div>
        <div class="flex-ac">
          <select id="importTargetTeam">${proj.teams.map(t=>`<option value="${t.id}" ${t.id===proj.selTeamId?'selected':''}>${t.name}</option>`).join('')}</select>
          <button class="btn" onclick="closeImportPicker()">Cancel</button>
          <button class="btn btn-primary" onclick="confirmImport()">Import ${personCount>0?personCount+' people':'selected'}</button>
        </div>
      </div>
    </div>`;
}

// ── SECTION: toggle + confirm ─────────────────────────────────────────────────
function togglePick(id,checked){
  const node=findNode(S.globalOrg,id);if(!node)return;
  const persons=flatPersonsUnder(node);
  if(node.type==='person'){
    checked?importChecked.add(id):importChecked.delete(id);
    if(checked && importAllocations[id]===undefined) importAllocations[id]=100;
  } else {
    persons.forEach(p=>{
      checked?importChecked.add(p.id):importChecked.delete(p.id);
      if(checked && importAllocations[p.id]===undefined) importAllocations[p.id]=100;
    });
    checked?importChecked.add(id):importChecked.delete(id);
  }
}

async function confirmImport(){
  const proj=ap();if(!proj)return;
  const targetId=document.getElementById('importTargetTeam').value;
  // Collect per-person allocation inputs before overlay is replaced
  document.querySelectorAll('.import-body input[type="number"]').forEach(inp=>{
    const row=inp.closest('.pick-row');if(!row)return;
    const cb=row.querySelector('input[type="checkbox"]');if(!cb||!cb.checked)return;
    const m=inp.getAttribute('onchange')?.match(/importAllocations\['([^']+)'\]/);
    if(m) importAllocations[m[1]]=Math.min(200,Math.max(0,parseInt(inp.value)||100));
  });
  // Build payload: [{orgId, allocation}]
  const orgIds=[...importChecked]
    .filter(id=>findNode(S.globalOrg,id)?.type==='person')
    .map(id=>({orgId:id, allocation:importAllocations[id]??100}));
  await POST(`/api/projects/${proj.id}/import-org`,{teamId:targetId,orgIds});
  closeImportPicker();
  await loadState();
  renderTeams();
}
