// ════════════════════════════════════════════════════════════════════════════
// BUSINESS CASE
// ════════════════════════════════════════════════════════════════════════════
function renderBizCase(){
  const proj=ap();if(!proj)return;
  const bc=proj.businessCase||{};
  const allWPs=[];
  function collectWPs(phases){phases.forEach(ph=>{(ph.workPackages||[]).forEach(wp=>allWPs.push({...wp,phaseName:ph.name}));collectWPs(ph.children||[]);});}
  collectWPs(proj.phases||[]);

  const linkedWPIds=new Set(bc.linkedWPs||[]);

  document.getElementById('panelBizcase').innerHTML=`
    <div class="flex-between mb15">
      <div><h2 style="margin:0 0 4px;">Business Case</h2>
        <div style="font-size:12px;color:var(--muted);">Project: <span style="color:${proj.color};font-weight:600;">${proj.name}</span></div></div>
      <button class="btn btn-primary" onclick="saveBizCase('${proj.id}')">💾 Save</button>
    </div>
    <div style="display:grid;grid-template-columns:1fr 340px;gap:16px;align-items:start;">
      <div>
        <div class="card mb15">
          <div style="margin-bottom:14px;">
            <label style="font-size:11px;color:var(--faint);text-transform:uppercase;letter-spacing:.06em;display:block;margin-bottom:5px;">Title</label>
            <input type="text" id="bc_title" value="${bc.title||''}" placeholder="Business case title…"
              style="width:100%;font-size:16px;font-weight:700;background:transparent;border:none;border-bottom:2px solid var(--border);color:var(--text);padding:4px 0;outline:none;">
          </div>
          ${bcField('bc_problem','Problem / Opportunity',bc.problem||'','Describe the problem this project solves or the opportunity it captures…',4)}
          ${bcField('bc_solution','Proposed Solution',bc.solution||'','Describe the approach or solution…',4)}
        </div>
        <div class="grid2 mb15">
          <div class="card">${bcField('bc_benefits','Benefits',bc.benefits||'','Expected outcomes and value delivered…',5)}</div>
          <div class="card">${bcField('bc_costs','Costs',bc.costs||'','Estimated investment, resources, budget…',5)}</div>
        </div>
        <div class="grid2 mb15">
          <div class="card">${bcField('bc_risks','Risks',bc.risks||'','Key risks and mitigation approaches…',5)}</div>
          <div class="card">${bcField('bc_timeline','Timeline',bc.timeline||'','High-level milestones and key dates…',5)}</div>
        </div>
      </div>
      <div>
        <div class="card">
          <h3>Link to Work Packages</h3>
          <div style="font-size:11px;color:var(--faint);margin-bottom:10px;">Select the work packages this business case justifies</div>
          ${allWPs.length===0
            ? '<div style="font-size:12px;color:var(--faint);">No work packages defined yet — add them in the Phases tab</div>'
            : allWPs.map(wp=>`<div class="flex-ac" style="padding:6px 0;border-bottom:1px solid var(--border);">
                <input type="checkbox" id="bcwp_${wp.id}" ${linkedWPIds.has(wp.id)?'checked':''}
                  onchange="toggleBCLink('${proj.id}','${wp.id}',this.checked)"
                  style="accent-color:var(--teal);width:14px;height:14px;cursor:pointer;flex-shrink:0;">
                <label for="bcwp_${wp.id}" style="cursor:pointer;margin-left:8px;">
                  <div style="font-size:12px;font-weight:600;">${wp.name}</div>
                  <div class="label-xs">${wp.phaseName}</div>
                </label>
              </div>`).join('')}
        </div>
      </div>
    </div>`;
}

function bcField(id,label,value,placeholder,rows){
  return`<div style="margin-bottom:14px;">
    <label style="font-size:11px;color:var(--faint);text-transform:uppercase;letter-spacing:.06em;display:block;margin-bottom:5px;">${label}</label>
    <textarea id="${id}" rows="${rows}" placeholder="${placeholder}"
      style="width:100%;background:var(--bg3);border:1px solid var(--border);color:var(--text);border-radius:6px;padding:8px 10px;font-size:13px;line-height:1.6;resize:vertical;outline:none;font-family:var(--font);"
      onfocus="this.style.borderColor='var(--teal)'" onblur="this.style.borderColor='var(--border)'">${value}</textarea>
  </div>`;
}

function saveBizCase(pid){
  const bc={
    title:   document.getElementById('bc_title')?.value||'',
    problem: document.getElementById('bc_problem')?.value||'',
    solution:document.getElementById('bc_solution')?.value||'',
    benefits:document.getElementById('bc_benefits')?.value||'',
    costs:   document.getElementById('bc_costs')?.value||'',
    risks:   document.getElementById('bc_risks')?.value||'',
    timeline:document.getElementById('bc_timeline')?.value||'',
  };
  const proj=ap();if(!proj)return;
  bc.linkedWPs=proj.businessCase?.linkedWPs||[];
  act(()=>PATCH(`/api/projects/${pid}`,{businessCase:bc}));
}

function toggleBCLink(pid,wpid,checked){
  const proj=ap();if(!proj)return;
  const bc=proj.businessCase||{};
  const linked=new Set(bc.linkedWPs||[]);
  if(checked)linked.add(wpid);else linked.delete(wpid);
  bc.linkedWPs=[...linked];
  proj.businessCase=bc;
  PATCH(`/api/projects/${pid}`,{businessCase:bc});
}
