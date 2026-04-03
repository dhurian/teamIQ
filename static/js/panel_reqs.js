// ════════════════════════════════════════════════════════════════════════════
// REQUIREMENTS
// ════════════════════════════════════════════════════════════════════════════
function renderReqs(){
  const proj=ap();if(!proj)return;
  const reqs=proj.requirements||[];
  const allWPs=[];
  function collectWPs(phases){phases.forEach(ph=>{(ph.workPackages||[]).forEach(wp=>allWPs.push({...wp,phaseName:ph.name}));collectWPs(ph.children||[]);});}
  collectWPs(proj.phases||[]);

  const reqCards=reqs.map((req,ri)=>{
    const linked=new Set(req.linkedWPs||[]);
    return`<div class="card" style="margin-bottom:12px;border-left:3px solid var(--teal);">
      <div class="flex-between" style="margin-bottom:10px;">
        <span style="font-size:11px;font-weight:700;color:var(--teal);font-family:var(--mono);">REQ-${String(ri+1).padStart(3,'0')}</span>
        <button class="btn btn-danger btn-sm" onclick="delReq('${proj.id}','${req.id}')">✕</button>
      </div>
      <textarea rows="3" placeholder="Requirement text…"
        onchange="patchReq('${proj.id}','${req.id}',{text:this.value})"
        style="width:100%;background:var(--bg3);border:1px solid var(--border);color:var(--text);border-radius:6px;padding:8px;font-size:13px;resize:vertical;outline:none;font-family:var(--font);margin-bottom:10px;">${req.text||''}</textarea>
      <h3 style="margin-bottom:6px;">Linked work packages</h3>
      <div style="display:flex;flex-wrap:wrap;gap:6px;">
        ${allWPs.map(wp=>{const on=linked.has(wp.id);return`<label style="display:flex;align-items:center;gap:5px;padding:3px 9px;border-radius:20px;border:1px solid ${on?'var(--teal)':'var(--border)'};background:${on?'rgba(31,184,133,.12)':'transparent'};cursor:pointer;font-size:11px;font-weight:${on?600:400};color:${on?'var(--teal)':'var(--muted)'};">
          <input type="checkbox" ${on?'checked':''} style="display:none;" onchange="toggleReqWP('${proj.id}','${req.id}','${wp.id}',this.checked)">
          ${wp.name}</label>`;}).join('')}
        ${allWPs.length===0?'<span style="font-size:11px;color:var(--faint);">No work packages yet</span>':''}
      </div>
    </div>`;}).join('');

  document.getElementById('panelReqs').innerHTML=`
    <div class="flex-between mb15">
      <div><h2 style="margin:0 0 4px;">Requirements</h2>
        <div style="font-size:12px;color:var(--muted);">Project: <span style="color:${proj.color};font-weight:600;">${proj.name}</span> · ${reqs.length} requirement${reqs.length!==1?'s':''}</div></div>
      <button class="btn btn-primary" onclick="addReq('${proj.id}')">+ Add Requirement</button>
    </div>
    ${reqs.length===0
      ? `<div class="card" style="text-align:center;padding:3rem;color:var(--faint);">
          <div style="font-size:32px;margin-bottom:12px;">📐</div>
          <div style="font-size:14px;margin-bottom:8px;">No requirements yet</div>
          <div style="font-size:12px;margin-bottom:16px;">Define requirements derived from the business case and link them to work packages.</div>
          <button class="btn btn-primary" onclick="addReq('${proj.id}')">+ Add First Requirement</button>
        </div>`
      : reqCards}`;
}

const addReq=(pid)=>act(()=>POST(`/api/projects/${pid}/requirements`,{}));
const delReq=(pid,rid)=>act(()=>DELETE(`/api/projects/${pid}/requirements/${rid}`));
const patchReq=(pid,rid,d)=>act(()=>PATCH(`/api/projects/${pid}/requirements/${rid}`,d));

function toggleReqWP(pid,rid,wpid,checked){
  const proj=ap();if(!proj)return;
  const req=proj.requirements?.find(r=>r.id===rid); if(!req) return;
  const linked=new Set(req.linkedWPs||[]);
  if(checked)linked.add(wpid);else linked.delete(wpid);
  req.linkedWPs=[...linked];
  act(()=>PATCH(`/api/projects/${pid}/requirements/${rid}`,{linkedWPs:req.linkedWPs}));
}
