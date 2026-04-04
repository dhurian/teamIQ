// ════════════════════════════════════════════════════════════════════════════
// ORG HIERARCHY – layout engine + main render + map events
// (HTML builders moved to panel_org_hier_helpers.js)
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

function initOrgMapEvents(){
  const svg=document.getElementById('orgMapSvg');if(!svg)return;
  svg.addEventListener('wheel',e=>{e.preventDefault();orgMapZoom=Math.max(.25,Math.min(2.2,orgMapZoom+(e.deltaY>0?-.1:.1)));updateMapTransform();},{passive:false});
  svg.addEventListener('mousedown',e=>{if(e.target.closest('.omap-node')||e.target.closest('circle'))return;orgMapDragging={sx:e.clientX-orgMapPan.x,sy:e.clientY-orgMapPan.y};svg.style.cursor='grabbing';});
  window.addEventListener('mousemove',e=>{if(!orgMapDragging)return;orgMapPan.x=e.clientX-orgMapDragging.sx;orgMapPan.y=e.clientY-orgMapDragging.sy;updateMapTransform();});
  window.addEventListener('mouseup',()=>{if(orgMapDragging){orgMapDragging=null;const s=document.getElementById('orgMapSvg');if(s)s.style.cursor='grab';}});
}
