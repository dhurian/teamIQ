// ════════════════════════════════════════════════════════════════════════════
// ORG HIERARCHY
// ════════════════════════════════════════════════════════════════════════════
const ND={org:{w:200,h:62},division:{w:178,h:58},department:{w:162,h:54},team:{w:152,h:52},person:{w:142,h:62}};
const V_GAP=70,H_GAP=22;
function ndim(t){return ND[t]||{w:152,h:52};}

function computeLayout(node,depth=0){
  const d=ndim(node.type);node._depth=depth;
  if(!node.children?.length||!node.expanded){node._w=d.w;return d.w;}
  let total=0;node.children.forEach(c=>{total+=computeLayout(c,depth+1)+H_GAP;});total-=H_GAP;
  node._w=Math.max(d.w,total);return node._w;
}
function placeLayout(node,x=0){
  const d=ndim(node.type);node._x=x+(node._w-d.w)/2;node._y=node._depth*(80+V_GAP);
  if(node.children?.length&&node.expanded){let cx=x;node.children.forEach(c=>{placeLayout(c,cx);cx+=c._w+H_GAP;});}
}

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

function buildOrgMap(org){
  computeLayout(org); placeLayout(org);
  let edges='',nodes='';
  function walk(node){
    const d=ndim(node.type),col=ORG_TYPE_COLOR[node.type]||'#888';
    const isSel=node.id===orgMapSelId;
    const px=node._x,py=node._y,pw=d.w,ph=d.h,cx=px+pw/2;
    if(node.children?.length&&node.expanded){
      node.children.forEach(c=>{
        const cd=ndim(c.type),ccx=c._x+cd.w/2,my=(py+ph+c._y)/2;
        edges+=`<path d="M${cx},${py+ph} C${cx},${my} ${ccx},${my} ${ccx},${c._y}" stroke="${col}55" stroke-width="1.5" fill="none" stroke-linecap="round"/>`;
        walk(c);
      });
    }
    const persons=flatPersonsUnder(node);
    let inner='';
    if(node.type==='person'){
      const topSk=ALL_SKILLS.reduce((a,sk)=>((node.skills?.[sk]?.m||0)>(node.skills?.[a]?.m||0)?sk:a),ALL_SKILLS[0]);
      const ts=node.skills?.[topSk]?.m||0;
      inner=`<circle cx="${px+22}" cy="${py+ph/2}" r="14" fill="${col}22" stroke="${col}44" stroke-width="1"/>
        <text x="${px+22}" y="${py+ph/2+4}" text-anchor="middle" fill="${col}" font-size="10" font-weight="700" font-family="Segoe UI,system-ui">${ini(node.name)}</text>
        <text x="${px+42}" y="${py+16}" fill="${col}" font-size="10" font-weight="700" font-family="Segoe UI,system-ui">${node.name.length>14?node.name.slice(0,13)+'…':node.name}</text>
        <text x="${px+42}" y="${py+28}" fill="#4a556a" font-size="9" font-family="Segoe UI,system-ui">${(node.role||'').slice(0,16)}</text>
        <rect x="${px+42}" y="${py+35}" width="${pw-50}" height="4" rx="2" fill="${col}22"/>
        <rect x="${px+42}" y="${py+35}" width="${Math.round(ts/10*(pw-50))}" height="4" rx="2" fill="${scv(ts)}88"/>`;
    } else {
      const sub=node.type==='org'?`${persons.length} people`
               :node.type==='division'?`${(node.children||[]).length} depts · ${persons.length}p`
               :node.type==='department'?`${(node.children||[]).length} teams · ${persons.length}p`
               :`${persons.length} member${persons.length!==1?'s':''}`;
      inner=`<rect x="${px}" y="${py}" width="${pw}" height="5" rx="3" fill="${col}"/>
        <rect x="${px}" y="${py+2}" width="${pw}" height="3" fill="${col}"/>
        <text x="${px+12}" y="${py+22}" fill="${col}" font-size="11" font-weight="700" font-family="Segoe UI,system-ui">${node.name.length>20?node.name.slice(0,19)+'…':node.name}</text>
        <text x="${px+12}" y="${py+37}" fill="#4a556a" font-size="9" font-family="Segoe UI,system-ui">${sub}</text>`;
    }
    const hasKids=node.children?.length>0;
    const toggle=hasKids?`<g onclick="toggleOrgNode('${node.id}')" style="cursor:pointer;">
      <circle cx="${cx}" cy="${py+ph}" r="8" fill="#1e2535" stroke="${col}66" stroke-width="1"/>
      <text x="${cx}" y="${py+ph+4}" text-anchor="middle" fill="${col}" font-size="10" font-family="Segoe UI,system-ui">${node.expanded?'−':'+'}</text>
    </g>`:'';
    nodes+=`<g class="omap-node" data-id="${node.id}" style="cursor:pointer;" onclick="orgMapSelect('${node.id}')">
      <rect x="${px}" y="${py}" width="${pw}" height="${ph}" rx="8"
        fill="${isSel?col+'25':'#1e2535'}" stroke="${isSel?col:col+'44'}" stroke-width="${isSel?2:1}"
        ${isSel?`filter="drop-shadow(0 0 10px ${col}55)"`:''}/>
      ${inner}</g>${toggle}`;
  }
  walk(org);
  let maxX=0,maxY=0;
  function measure(n){const d=ndim(n.type);maxX=Math.max(maxX,n._x+d.w+60);maxY=Math.max(maxY,n._y+d.h+80);if(n.children?.length&&n.expanded)n.children.forEach(measure);}
  measure(org);

  const sel=orgMapSelId?findNode(org,orgMapSelId):null;
  return`<div style="display:grid;grid-template-columns:1fr ${sel?'310px':'0px'};gap:${sel?'14px':'0'};transition:grid-template-columns .2s;align-items:start;">
    <div style="position:relative;">
      <div style="position:absolute;top:10px;right:10px;z-index:2;display:flex;gap:6px;">
        <button class="btn btn-sm" onclick="orgMapZoom=Math.min(2.2,orgMapZoom+.15);updateMapTransform()" title="Zoom in">+</button>
        <button class="btn btn-sm" onclick="orgMapZoom=Math.max(.25,orgMapZoom-.15);updateMapTransform()" title="Zoom out">−</button>
        <button class="btn btn-sm" onclick="orgMapPan={x:60,y:50};orgMapZoom=1;updateMapTransform()" title="Reset">⊙</button>
      </div>
      <svg id="orgMapSvg" width="100%" height="580">
        <g id="orgMapG" transform="translate(${orgMapPan.x},${orgMapPan.y}) scale(${orgMapZoom})">
          <g>${edges}</g><g>${nodes}</g>
        </g>
      </svg>
      <div style="font-size:11px;color:var(--faint);margin-top:6px;padding-left:4px;">Scroll to zoom · Drag to pan · Click node to inspect · ± to collapse</div>
    </div>
    ${sel?`<div>${buildOrgDetail(sel)}</div>`:'<div></div>'}
  </div>`;
}

function buildOrgDetail(node){
  const col=ORG_TYPE_COLOR[node.type]||'#888';
  const persons=flatPersonsUnder(node);
  const canAdd=(ORG_CHILD_TYPES[node.type]||[]).length>0;
  const isRoot=node.id===S.globalOrg?.id;
  let body=`<div class="card" style="position:sticky;top:0;">
    <div class="flex-between" style="margin-bottom:12px;">
      <div class="flex-ac">
        <div style="width:34px;height:34px;border-radius:8px;background:${col}18;color:${col};display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0;">${ORG_TYPE_ICON[node.type]||'●'}</div>
        <div>
          <input type="text" value="${node.name}" onchange="patchOrgNode('${node.id}',{name:this.value})" style="font-size:14px;font-weight:700;background:transparent;border:none;border-bottom:1px solid var(--border);color:var(--text);padding:2px 0;width:175px;outline:none;">
          <div style="font-size:11px;color:${col};margin-top:2px;">${node.type}</div>
        </div>
      </div>
      <button class="btn btn-sm" onclick="orgMapSelId=null;renderOrgHier()" style="padding:3px 7px;">✕</button>
    </div>`;
  if(node.type==='person'){
    const top5=ALL_SKILLS.map(sk=>({sk,v:node.skills?.[sk]?.m||0})).sort((a,b)=>b.v-a.v).slice(0,5);
    body+=`<input type="text" value="${node.role||''}" placeholder="Role" onchange="patchOrgNode('${node.id}',{role:this.value})" style="font-size:12px;color:var(--muted);background:transparent;border:none;border-bottom:1px solid var(--border);padding:2px 0;width:100%;outline:none;margin-bottom:10px;">
    <h3 style="margin-bottom:8px;">Top skills</h3>
    ${top5.map(({sk,v})=>`<div class="flex-ac" style="margin-bottom:7px;">
      <span style="font-size:11px;color:var(--muted);width:95px;flex-shrink:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${sk}</span>
      <div class="gap-bar-wrap"><div class="gap-fill" style="width:${v*10}%;background:${scv(v)};"></div></div>
      <span style="font-size:11px;font-weight:700;font-family:var(--mono);color:${scv(v)};min-width:24px;">${v.toFixed(1)}</span>
    </div>`).join('')}
    <div class="sep" style="margin:.75rem 0;"></div>
    <button class="btn btn-sm" onclick="orgHierView='tree';orgMapSelId='${node.id}';renderOrgHier()" style="width:100%;">✏️ Edit all skills</button>`;
  } else {
    body+=`<div style="display:flex;gap:10px;margin-bottom:10px;">
      <div class="metric" style="flex:1;padding:.7rem;"><label>People</label><div class="val" style="font-size:20px;">${persons.length}</div></div>
      ${(node.children?.length)?`<div class="metric" style="flex:1;padding:.7rem;"><label>${(ORG_CHILD_TYPES[node.type]||[''])[0]}s</label><div class="val" style="font-size:20px;">${node.children.length}</div></div>`:''}
    </div>`;
    if(persons.length){
      body+=`<h3 style="margin-bottom:7px;">People</h3><div style="max-height:180px;overflow-y:auto;display:flex;flex-direction:column;gap:4px;">
        ${persons.map(p=>`<div class="flex-ac" style="padding:5px 8px;background:var(--bg3);border-radius:6px;cursor:pointer;" onclick="orgMapSelId='${p.id}';renderOrgHier()">
          <div class="avatar" style="width:26px;height:26px;background:${ORG_TYPE_COLOR.team}18;color:${ORG_TYPE_COLOR.team};font-size:10px;">${ini(p.name)}</div>
          <div style="min-width:0;"><div style="font-size:12px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${p.name}</div>
          <div style="font-size:10px;color:var(--faint);">${p.role||''}</div></div></div>`).join('')}
      </div>`;
    }
  }
  if(canAdd)body+=`<div class="sep" style="margin:.75rem 0;"></div><button class="btn btn-primary btn-sm" onclick="addOrgChild('${node.id}')" style="width:100%;">+ Add ${(ORG_CHILD_TYPES[node.type]||[''])[0]}</button>`;
  if(!isRoot)body+=`<button class="btn btn-danger btn-sm" onclick="deleteOrgNode('${node.id}')" style="width:100%;margin-top:6px;">Delete ${node.type}</button>`;
  return body+'</div>';
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

function orgSkillRow(node,sk){
  const{m:mn,s:sg}=node.skills?.[sk]||{m:5,s:1.5};
  const uid2=`os_${node.id}_${sk.replace(/[^a-z0-9]/gi,'_')}`;
  return`<div class="skill-row">
    <div class="skill-label">${sk}</div>
    <div style="display:flex;flex-direction:column;gap:3px;">
      <div class="slider-line"><span class="slider-hint">Level</span>
        <input type="range" min="0" max="10" step="0.5" value="${mn}" oninput="patchOrgSkill('${node.id}','${sk}','m',this.value);const e=document.getElementById('${uid2}');if(e){e.textContent=parseFloat(this.value).toFixed(1);e.style.color=scv(parseFloat(this.value));}">
      </div>
      <div class="slider-line"><span class="slider-hint" style="color:var(--faint);">Uncert.</span>
        <input type="range" min="0.2" max="3" step="0.1" value="${sg}" oninput="patchOrgSkill('${node.id}','${sk}','s',this.value)" style="opacity:.45;">
      </div>
    </div>
    <div class="skill-val" id="${uid2}" style="color:${scv(mn)};">${mn.toFixed(1)}</div>
  </div>`;
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
