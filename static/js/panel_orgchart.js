// ════════════════════════════════════════════════════════════════════════════
// ORG CHART (per-project team connections — SVG canvas + connection list)
// ════════════════════════════════════════════════════════════════════════════

// ── SECTION: main render (renderOrgChart) ─────────────────────────────────────
function renderOrgChart(){
  const proj=ap();if(!proj)return;
  const{teams,connections}=proj;
  const orgMode=proj.orgMode||'none';
  const connTypes=[
    {val:'integration', label:'Integration', col:C.blue},
    {val:'dependency',  label:'Dependency',  col:C.amber},
    {val:'handoff',     label:'Handoff',     col:C.teal},
    {val:'reporting',   label:'Reporting',   col:C.purple},
  ];
  const orgLookup={};flatPersons(S.globalOrg||{}).forEach(p=>{orgLookup[p.id]=p;});
  const resolveName=m=>m.orgId?orgLookup[m.orgId]?.name||'?':m.name||'?';

  let edges='',nodes='';
  connections.forEach(c=>{
    const ft=teams.find(t=>t.id===c.from),tt=teams.find(t=>t.id===c.to);if(!ft||!tt)return;
    const col=tCol(c.type);
    const x1=ft.x+NODE_W/2,y1=ft.y+NODE_H/2,x2=tt.x+NODE_W/2,y2=tt.y+NODE_H/2;
    const mx=(x1+x2)/2,my=(y1+y2)/2,dx=x2-x1,dy=y2-y1,len=Math.sqrt(dx*dx+dy*dy)||1;
    const nx=-dy/len*20,ny=dx/len*20;
    edges+=`<path d="M${x1},${y1} Q${mx+nx},${my+ny} ${x2},${y2}" stroke="${col}" stroke-width="2" fill="none" marker-end="url(#arr-${c.type})" stroke-dasharray="${c.type==='dependency'?'6,3':'none'}"/>
      <rect x="${mx+nx-36}" y="${my+ny-11}" width="72" height="20" rx="4" fill="var(--bg2)" stroke="${col}" stroke-width="1" opacity=".92" style="cursor:pointer;" onclick="editConnLabel('${proj.id}','${c.id}')"/>
      <text x="${mx+nx}" y="${my+ny+4}" text-anchor="middle" fill="${col}" font-size="10" font-family="Segoe UI,system-ui" font-weight="600" style="cursor:pointer;" onclick="editConnLabel('${proj.id}','${c.id}')">${c.label||c.type}</text>`;
  });
  teams.forEach(t=>{
    const isSrc=orgConnFrom===t.id;
    const memberCount=t.members.length;
    nodes+=`<g class="proj-node" data-id="${t.id}" transform="translate(${t.x??30},${t.y??40})" cursor="${orgMode==='connecting'?'crosshair':'move'}" onclick="projNodeClick('${proj.id}','${t.id}')">
      <rect width="${NODE_W}" height="${NODE_H}" rx="10" fill="var(--bg3)" stroke="${isSrc?t.color:t.color+'44'}" stroke-width="${isSrc?3:1.5}" ${isSrc?`filter="drop-shadow(0 0 8px ${t.color}88)"`:''}/>
      <rect width="${NODE_W}" height="6" rx="10" fill="${t.color}"/>
      <text x="12" y="26" fill="${t.color}" font-size="12" font-weight="700" font-family="Segoe UI,system-ui">${t.name}</text>
      <text x="12" y="42" fill="${C.muted}" font-size="10" font-family="Segoe UI,system-ui">${memberCount} member${memberCount!==1?'s':''}</text>
      <text x="12" y="82" fill="${C.faint}" font-size="10" font-family="Segoe UI,system-ui">${t.members.slice(0,3).map(m=>ini(resolveName(m))).join(' · ')}${t.members.length>3?'…':''}</text>
    </g>`;
  });

  const connList=connections.map(c=>{
    const ft=teams.find(t=>t.id===c.from),tt=teams.find(t=>t.id===c.to);
    const ct=connTypes.find(t=>t.val===c.type)||connTypes[0];
    if(!ft||!tt)return'';
    return`<div style="padding:8px 10px;border-bottom:1px solid var(--border);">
      <div class="flex-ac" style="margin-bottom:4px;">
        <span style="color:${ft.color};font-weight:600;font-size:12px;">${ft.name}</span>
        <span style="color:var(--faint);margin:0 4px;">→</span>
        <span style="color:${tt.color};font-weight:600;font-size:12px;">${tt.name}</span>
        <select onchange="patchConnection('${proj.id}','${c.id}',{type:this.value})" style="font-size:11px;padding:2px 5px;margin-left:6px;">
          ${connTypes.map(t=>`<option value="${t.val}" ${t.val===c.type?'selected':''}>${t.label}</option>`).join('')}
        </select>
        <button class="btn btn-danger btn-sm" style="margin-left:auto;" onclick="delConnection('${proj.id}','${c.id}')">✕</button>
      </div>
      <input type="text" value="${c.label||''}" placeholder="Label…"
        onchange="patchConnection('${proj.id}','${c.id}',{label:this.value})"
        style="width:100%;font-size:11px;background:var(--bg4);border:1px solid var(--border);color:var(--muted);border-radius:4px;padding:3px 7px;outline:none;">
    </div>`;}).join('');

  const arrowDefs=['integration:'+C.blue,'dependency:'+C.amber,'handoff:'+C.teal,'reporting:'+C.purple]
    .map(s=>{const[v,c]=s.split(':');return`<marker id="arr-${v}" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto"><polygon points="0 0,8 3,0 6" fill="${c}"/></marker>`;}).join('');

  document.getElementById('panelOrgchart').innerHTML=`
    <div class="flex-between mb15">
      <div><h2 style="margin:0 0 4px;">Team Interfaces</h2>
        <div style="font-size:12px;color:var(--muted);">Project: <span style="color:${proj.color};font-weight:600;">${proj.name}</span>
          ${orgMode==='connecting'?'&nbsp;·&nbsp;<span style="color:var(--blue);">Connect mode — click teams to link · Esc to exit</span>':''}</div></div>
      <div class="flex-ac">
        <button class="btn ${orgMode==='connecting'?'btn-active':''}" onclick="toggleProjConnMode('${proj.id}')">${orgMode==='connecting'?'● Stop Connecting':'⊕ Connect Teams'}</button>
        <button class="btn" onclick="autoLayoutTeams('${proj.id}')">↺ Auto Layout</button>
        <button class="btn btn-sm" onclick="orgZoom=Math.min(2.5,orgZoom+.15);orgUpdateTransform()" title="Zoom in">+</button>
        <button class="btn btn-sm" onclick="orgZoom=Math.max(.2,orgZoom-.15);orgUpdateTransform()" title="Zoom out">−</button>
        <button class="btn btn-sm" onclick="orgPan={x:20,y:20};orgZoom=1;orgUpdateTransform()" title="Reset view">⊙</button>
      </div>
    </div>
    <svg id="orgSvg" width="100%" height="480" style="background:var(--bg3);border-radius:10px;border:1px solid var(--border);display:block;cursor:${orgMode==='connecting'?'crosshair':'grab'};margin-bottom:14px;">
      <defs>${arrowDefs}</defs>
      <g id="orgViewport" transform="translate(${orgPan.x},${orgPan.y}) scale(${orgZoom})">
        <g>${edges}</g><g>${nodes}</g>
      </g>
    </svg>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;">
      <div class="card">
        <h3>Connections (${connections.length})</h3>
        ${connections.length?connList:'<div style="font-size:12px;color:var(--faint);">No connections yet — use ⊕ Connect Teams above</div>'}
      </div>
      <div class="card"><h3>Add connection</h3>
        <div class="flex-ac" style="flex-wrap:wrap;gap:6px;margin-bottom:12px;">
          <select id="connFrom">${teams.map(t=>`<option value="${t.id}">${t.name}</option>`).join('')}</select>
          <span style="color:var(--faint);">→</span>
          <select id="connTo">${teams.map(t=>`<option value="${t.id}">${t.name}</option>`).join('')}</select>
          <select id="connType">${connTypes.map(ct=>`<option value="${ct.val}">${ct.label}</option>`).join('')}</select>
          <input type="text" id="connLabel" placeholder="Label" style="width:100px;font-size:12px;">
          <button class="btn btn-primary" onclick="addConnectionForm('${proj.id}')">Add</button>
        </div>
        <div style="font-size:11px;color:var(--faint);">Or use <strong>⊕ Connect Teams</strong> above — click two nodes to link them. You can make multiple connections without stopping. Press <kbd style="background:var(--bg4);padding:1px 5px;border-radius:3px;border:1px solid var(--border);">Esc</kbd> when done.</div>
      </div>
    </div>`;

  initProjOrgEvents(proj.id);
}

// ── SECTION: connection utils (editConnLabel, patchConnection, transform) ─────
function editConnLabel(pid,cid){
  const conn=ap()?.connections.find(c=>c.id===cid); if(!conn) return;
  const label=prompt('Edit connection label:',conn.label||'');
  if(label===null) return;
  patchConnection(pid,cid,{label});
}

const patchConnection=(pid,cid,d)=>act(()=>PATCH(`/api/projects/${pid}/connections/${cid}`,d));

function orgUpdateTransform(){
  const g=document.getElementById('orgViewport');
  if(g) g.setAttribute('transform',`translate(${orgPan.x},${orgPan.y}) scale(${orgZoom})`);
}

// ── SECTION: window-level mouse handlers (initOrgWindowEvents) ────────────────
function initOrgWindowEvents(){
  if(orgEventsSetup)return;
  orgEventsSetup=true;
  window.addEventListener('mousemove',e=>{
    const svg=document.getElementById('orgSvg');if(!svg)return;
    if(orgNodeDrag){
      const proj=S.projects?.find(p=>p.id===orgNodeDrag.pid);
      const t=proj?.teams.find(t=>t.id===orgNodeDrag.id);if(!t)return;
      const rect=svg.getBoundingClientRect();
      const vx=(e.clientX-rect.left-orgPan.x)/orgZoom;
      const vy=(e.clientY-rect.top-orgPan.y)/orgZoom;
      t.x=vx-orgNodeDrag.sx;
      t.y=vy-orgNodeDrag.sy;
      _redrawOrgChart(proj);
      clearTimeout(orgNodeDrag._t);
      const{pid:_pid,id:_id}=orgNodeDrag;const _x=t.x,_y=t.y;
      orgNodeDrag._t=setTimeout(()=>PATCH(`/api/projects/${_pid}/teams/${_id}`,{x:_x,y:_y}),400);
      return;
    }
    if(orgPanning){
      orgPan.x=e.clientX-orgPanning.sx;
      orgPan.y=e.clientY-orgPanning.sy;
      orgUpdateTransform();
    }
  });
  window.addEventListener('mouseup',()=>{
    if(!orgNodeDrag&&!orgPanning)return;
    orgNodeDrag=null;orgPanning=null;
    const svg=document.getElementById('orgSvg');
    if(svg)svg.style.cursor=ap()?.orgMode==='connecting'?'crosshair':'grab';
  });
}

// ── SECTION: SVG event setup — node drag, pan, zoom (initProjOrgEvents) ───────
function initProjOrgEvents(pid){
  const svg=document.getElementById('orgSvg');if(!svg)return;

  svg.querySelectorAll('.proj-node').forEach(el=>{
    el.addEventListener('mousedown',e=>{
      const proj=ap();if(proj?.orgMode==='connecting')return;
      const id=el.dataset.id,t=proj?.teams.find(t=>t.id===id);if(!t)return;
      const rect=svg.getBoundingClientRect();
      const vx=(e.clientX-rect.left-orgPan.x)/orgZoom;
      const vy=(e.clientY-rect.top-orgPan.y)/orgZoom;
      orgNodeDrag={pid,id,sx:vx-(t.x??30),sy:vy-(t.y??40)};
      e.preventDefault();e.stopPropagation();
    });
  });

  svg.addEventListener('mousedown',e=>{
    if(e.target.closest('.proj-node')) return;
    orgPanning={sx:e.clientX-orgPan.x,sy:e.clientY-orgPan.y};
    svg.style.cursor='grabbing';
  });

  svg.addEventListener('wheel',e=>{
    e.preventDefault();
    const delta=e.deltaY>0?-0.1:0.1;
    orgZoom=Math.max(.2,Math.min(2.5,orgZoom+delta));
    orgUpdateTransform();
  },{passive:false});

  initOrgWindowEvents();
}

// ── SECTION: lightweight redraw during node drag (_redrawOrgChart) ────────────
function _redrawOrgChart(proj){
  const{teams,connections}=proj;
  document.querySelectorAll('.proj-node').forEach(el=>{
    const t=teams.find(t=>t.id===el.dataset.id);if(!t)return;
    el.setAttribute('transform',`translate(${t.x??30},${t.y??40})`);
  });
  const edgesG=document.querySelector('#orgViewport g');if(!edgesG)return;
  edgesG.innerHTML=connections.map(c=>{
    const ft=teams.find(t=>t.id===c.from),tt=teams.find(t=>t.id===c.to);if(!ft||!tt)return'';
    const col=tCol(c.type);
    const x1=(ft.x??30)+NODE_W/2,y1=(ft.y??40)+NODE_H/2;
    const x2=(tt.x??30)+NODE_W/2,y2=(tt.y??40)+NODE_H/2;
    const mx=(x1+x2)/2,my=(y1+y2)/2,dx=x2-x1,dy=y2-y1,len=Math.sqrt(dx*dx+dy*dy)||1;
    const nx=-dy/len*20,ny=dx/len*20;
    return`<path d="M${x1},${y1} Q${mx+nx},${my+ny} ${x2},${y2}" stroke="${col}" stroke-width="2" fill="none" marker-end="url(#arr-${c.type})" stroke-dasharray="${c.type==='dependency'?'6,3':'none'}"/>
      <rect x="${mx+nx-36}" y="${my+ny-11}" width="72" height="20" rx="4" fill="var(--bg2)" stroke="${col}" stroke-width="1" opacity=".92"/>
      <text x="${mx+nx}" y="${my+ny+4}" text-anchor="middle" fill="${col}" font-size="10" font-family="Segoe UI,system-ui" font-weight="600">${c.label||c.type}</text>`;
  }).join('');
}
