// Organization hierarchy panel orchestration

function renderOrgHier(){
  const org=S.globalOrg;
  if(!org)return;
  const totalP=flatPersons(org).length;
  document.getElementById('panelOrgHier').innerHTML=`
    <div class="flex-between mb15">
      <div><h2 style="margin:0 0 4px;">Organization</h2>
        <div style="font-size:12px;color:var(--muted);">${totalP} people · reusable across all projects</div></div>
      <div class="flex-ac">
        <button class="btn ${orgHierView==='map'?'btn-active':''}" onclick="orgHierView='map';renderOrgHier()">🗺 Map</button>
        <button class="btn ${orgHierView==='tree'?'btn-active':''}" onclick="orgHierView='tree';renderOrgHier()">🌲 Tree</button>
        <button class="btn btn-primary btn-sm" onclick="addOrgChild('${org.id}')">+ Add Division</button>
      </div>
    </div>
    ${orgHierView==='map' ? buildOrgMap(org) : buildOrgTreePanel(org)}`;
  if(orgHierView==='map') initOrgMapEvents();
}


function buildOrgTreePanel(org){
  const selId=orgMapSelId;
  const selNode=selId?findNode(org,selId):org;
  function treeNode(node,isRoot=false){
    const col=ORG_TYPE_COLOR[node.type]||'#888';
    const hasCh=node.children?.length>0;
    const isSel=node.id===selId;
    const canAdd=(ORG_CHILD_TYPES[node.type]||[]).length>0;
    const persons=flatPersonsUnder(node);
    return`<div class="${isRoot?'tree-node-root':'tree-node'}">
      <div class="tree-row ${isSel?'sel':''}" onclick="orgMapSelId='${node.id}';renderOrgHier()">
        <div class="tree-toggle" onclick="event.stopPropagation();toggleOrgNode('${node.id}')">${hasCh?(node.expanded?'▾':'▸'):'&nbsp;'}</div>
        <div class="tree-icon" style="background:${col}18;color:${col};">${ORG_TYPE_ICON[node.type]||'●'}</div>
        <div style="flex:1;min-width:0;">
          <div class="tree-label">${node.name}</div>
          <div class="tree-sublabel">${node.type==='person'?(node.role||''):persons.length+' people'}</div>
        </div>
        <div class="node-actions">
          ${canAdd?`<button class="btn btn-sm" onclick="event.stopPropagation();addOrgChild('${node.id}')">+</button>`:''}
          ${!isRoot?`<button class="btn btn-danger btn-sm" onclick="event.stopPropagation();deleteOrgNode('${node.id}')">✕</button>`:''}
        </div>
      </div>
      ${node.expanded&&hasCh?`<div>${node.children.map(c=>treeNode(c)).join('')}</div>`:''}
    </div>`;
  }
  const editorHtml=selNode?buildOrgEditor(selNode):`<div style="color:var(--faint);font-size:13px;padding:2rem;text-align:center;">← Select a node to edit</div>`;
  return`<div style="display:grid;grid-template-columns:300px 1fr;gap:16px;align-items:start;">
    <div class="card" style="padding:1rem;">
      <div class="flex-between" style="margin-bottom:10px;">
        <h3 style="margin:0;">Structure</h3>
        <button class="btn btn-primary btn-sm" onclick="addOrgChild('${org.id}')">+ Division</button>
      </div>
      <div class="tree-node-root">${treeNode(org,true)}</div>
    </div>
    <div>${editorHtml}</div>
  </div>`;
}

function buildOrgEditor(node){
  const col=ORG_TYPE_COLOR[node.type]||'#888';
  const persons=flatPersonsUnder(node);
  const canAdd=(ORG_CHILD_TYPES[node.type]||[]).length>0;
  const isRoot=node.id===S.globalOrg?.id;
  let html=`<div class="card">
    <div class="flex-between" style="margin-bottom:1.25rem;">
      <div class="flex-ac">
        <div style="width:36px;height:36px;border-radius:8px;background:${col}18;color:${col};display:flex;align-items:center;justify-content:center;font-size:18px;">${ORG_TYPE_ICON[node.type]||'●'}</div>
        <div>
          <input type="text" value="${node.name}" onchange="patchOrgNode('${node.id}',{name:this.value})" style="font-size:15px;font-weight:700;background:transparent;border:none;border-bottom:1px solid var(--border);color:var(--text);padding:2px 0;width:220px;outline:none;">
          <div style="font-size:11px;color:var(--faint);margin-top:2px;">${node.type} · ${persons.length} people below</div>
        </div>
      </div>
      ${canAdd?`<button class="btn btn-primary btn-sm" onclick="addOrgChild('${node.id}')">+ Add ${(ORG_CHILD_TYPES[node.type]||[''])[0]}</button>`:''}
    </div>`;
  if(node.type!=='person'&&node.type!=='org'){
    html+=`<div class="flex-ac" style="margin-bottom:10px;"><span style="font-size:12px;color:var(--muted);">Color:</span>
      ${TCOLS.map(c=>`<div onclick="patchOrgNode('${node.id}',{color:'${c}'})" style="width:14px;height:14px;border-radius:50%;background:${c};cursor:pointer;border:2px solid ${(node.color||'')===c?'#fff':'transparent'};"></div>`).join('')}
    </div>`;
  }
  if(node.type==='person'){
    html+=`<div style="margin-bottom:10px;">
      <input type="text" value="${node.role||''}" placeholder="Role / title" onchange="patchOrgNode('${node.id}',{role:this.value})" style="font-size:12px;color:var(--muted);background:transparent;border:none;border-bottom:1px solid var(--border);padding:2px 0;width:100%;outline:none;">
    </div>
    <h3>Technical skills</h3>
    ${TECH_SKILLS.map(sk=>orgSkillRow(node,sk)).join('')}
    <div class="sep"></div>
    <h3>Personality &amp; work style</h3>
    ${PERS_SKILLS.map(sk=>orgSkillRow(node,sk)).join('')}`;
  }
  return html+'</div>';
}


function updateMapTransform(){
  const g=document.getElementById('orgMapG');
  if(g)g.setAttribute('transform',`translate(${orgMapPan.x},${orgMapPan.y}) scale(${orgMapZoom})`);
}

function initOrgMapEvents(){
  const svg=document.getElementById('orgMapSvg');if(!svg)return;
  svg.addEventListener('wheel',e=>{e.preventDefault();orgMapZoom=Math.max(.25,Math.min(2.2,orgMapZoom+(e.deltaY>0?-.1:.1)));updateMapTransform();},{passive:false});
  svg.addEventListener('mousedown',e=>{if(e.target.closest('.omap-node')||e.target.closest('circle'))return;orgMapDragging={sx:e.clientX-orgMapPan.x,sy:e.clientY-orgMapPan.y};svg.style.cursor='grabbing';});
  window.addEventListener('mousemove',e=>{if(!orgMapDragging)return;orgMapPan.x=e.clientX-orgMapDragging.sx;orgMapPan.y=e.clientY-orgMapDragging.sy;updateMapTransform();});
  window.addEventListener('mouseup',()=>{if(orgMapDragging){orgMapDragging=null;const s=document.getElementById('orgMapSvg');if(s)s.style.cursor='grab';}});
}
