// ════════════════════════════════════════════════════════════════════════════
// IMPORT PICKER
// ════════════════════════════════════════════════════════════════════════════
function openImportPicker(){ importChecked=new Set(); renderImportPicker(); document.getElementById('importOverlay').style.display='flex'; }
function closeImportPicker(){ document.getElementById('importOverlay').style.display='none'; }

function renderImportPicker(){
  const proj=ap();if(!proj)return;
  const usedOrgIds=new Set(proj.teams.flatMap(t=>t.members.filter(m=>m.orgId).map(m=>m.orgId)));
  function pickRow(node,depth){
    const col=ORG_TYPE_COLOR[node.type]||'#888';
    const persons=flatPersonsUnder(node);
    const allUsed=persons.length>0&&persons.every(p=>usedOrgIds.has(p.id));
    const checked=importChecked.has(node.id);
    const isP=node.type==='person';
    const sub=isP?node.role:persons.length+' people';
    const indent=depth>0?`padding-left:${depth*18}px`:'';
    return`<div class="pick-row" style="${indent}">
      <input type="checkbox" ${checked?'checked':''} ${allUsed&&!checked?'disabled title="All assigned"':''}
        onchange="togglePick('${node.id}',this.checked);renderImportPicker()">
      <div style="width:16px;height:16px;border-radius:3px;background:${col}18;color:${col};display:flex;align-items:center;justify-content:center;font-size:10px;flex-shrink:0;">${ORG_TYPE_ICON[node.type]||'●'}</div>
      <div><div style="font-size:13px;font-weight:${isP?500:600};">${node.name}</div>${sub?`<div style="font-size:11px;color:var(--faint);">${sub}</div>`:''}</div>
    </div>${(!isP&&node.children?.length)?node.children.map(c=>pickRow(c,depth+1)).join(''):''}`;
  }
  const body=(S.globalOrg?.children||[]).map(n=>pickRow(n,0)).join('');
  const selCount=[...importChecked].reduce((a,id)=>{const n=findNode(S.globalOrg,id);return a+flatPersonsUnder(n||{}).length;},0);
  document.getElementById('importOverlay').innerHTML=`
    <div class="import-panel">
      <div class="import-header">
        <div><div style="font-size:15px;font-weight:700;">Import from Organization</div>
          <div style="font-size:12px;color:var(--muted);margin-top:2px;">Adding to: <span style="color:${proj.color};font-weight:600;">${proj.teams.find(t=>t.id===proj.selTeamId)?.name||'team'}</span></div></div>
        <button class="btn btn-danger btn-sm" onclick="closeImportPicker()">✕</button>
      </div>
      <div class="import-body">${body}</div>
      <div class="import-footer">
        <div style="font-size:13px;color:var(--muted);">${selCount} people selected</div>
        <div class="flex-ac">
          <select id="importTargetTeam">${proj.teams.map(t=>`<option value="${t.id}" ${t.id===proj.selTeamId?'selected':''}>${t.name}</option>`).join('')}</select>
          <button class="btn" onclick="closeImportPicker()">Cancel</button>
          <button class="btn btn-primary" onclick="confirmImport()">Import ${selCount>0?selCount+' people':'selected'}</button>
        </div>
      </div>
    </div>`;
}

function togglePick(id,checked){
  const node=findNode(S.globalOrg,id);if(!node)return;
  const persons=flatPersonsUnder(node);
  if(node.type==='person'){checked?importChecked.add(id):importChecked.delete(id);}
  else{persons.forEach(p=>{checked?importChecked.add(p.id):importChecked.delete(p.id);});checked?importChecked.add(id):importChecked.delete(id);}
}

async function confirmImport(){
  const proj=ap();if(!proj)return;
  const targetId=document.getElementById('importTargetTeam').value;
  const orgIds=[...importChecked].filter(id=>findNode(S.globalOrg,id)?.type==='person');
  await POST(`/api/projects/${proj.id}/import-org`,{teamId:targetId,orgIds});
  closeImportPicker();
  await loadState();
  renderTeams();
}
