// ════════════════════════════════════════════════════════════════════════════
// OVERVIEW
// ════════════════════════════════════════════════════════════════════════════
async function renderOverview(){
  const projects = S.projects||[];
  document.getElementById('panelOverview').innerHTML = `
    <div class="flex-between mb15">
      <div><h2 style="margin:0 0 4px;">Portfolio Overview</h2>
        <div style="font-size:12px;color:var(--muted);" id="overviewStatus">${projects.length} projects · <span class="spinner"></span> loading…</div></div>
      <div class="flex-ac">
        <button class="btn" onclick="setTab('orghier')">🏢 Organization</button>
        <button class="btn" onclick="exportProjects()" title="Export all projects to JSON">⬆ Export</button>
        <button class="btn" onclick="triggerImport()" title="Import projects from JSON">⬇ Import</button>
        <button class="btn btn-primary" onclick="addProject()">+ New Project</button>
      </div>
    </div>
    <div id="overviewCards" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:14px;margin-bottom:1.5rem;">
      ${projects.map(p=>`<div class="project-card" style="--proj-color:${p.color};min-height:120px;"></div>`).join('')}
    </div>
    <div class="card"><h3>Cross-project skill availability</h3>
      <div style="position:relative;height:280px;"><canvas id="crossChart"></canvas></div></div>`;

  const simRes = await POST('/api/simulate/portfolio');
  const cards = projects.map(p=>{
    const r   = simRes[p.id]||{};
    const pct = Math.round((r.overall_prob||0)*100);
    const hc  = spCol(r.overall_prob||0);
    const tw  = p.phases.reduce((a,ph)=>a+ph.weeks,0);
    const allM= p.teams.flatMap(t=>t.members);
    const maxReq={};
    p.phases.forEach(ph=>Object.entries(ph.required||{}).forEach(([sk,lv])=>{if(!maxReq[sk]||maxReq[sk]<lv)maxReq[sk]=lv;}));
    const crit=Object.entries(maxReq).filter(([sk,req])=>(r.team_exp?.[sk]||0)<req*.85).length;
    const linked=allM.filter(m=>m.orgId).length;
    return `<div class="project-card ${p.id===S.activeProjectId?'active-card':''}" style="--proj-color:${p.color};" onclick="switchProject('${p.id}');setTab('analysis')">
      <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:12px;margin-top:4px;">
        <div><div style="font-size:15px;font-weight:700;">${p.name}</div>
          <div style="font-size:11px;color:var(--faint);margin-top:3px;">${allM.length} people · ${p.teams.length} teams · ${tw}w</div></div>
        <div style="text-align:right;"><div style="font-size:24px;font-weight:700;font-family:var(--mono);color:${hc};">${pct}%</div>
          <div class="label-xs">success prob.</div></div>
      </div>
      <div style="height:5px;background:var(--bg4);border-radius:3px;overflow:hidden;margin-bottom:12px;">
        <div style="height:100%;width:${pct}%;background:${hc};border-radius:3px;"></div></div>
      <div style="display:flex;flex-wrap:wrap;gap:5px;margin-bottom:10px;">
        ${p.teams.map(t=>`<span style="font-size:11px;padding:2px 8px;border-radius:10px;background:${t.color}18;color:${t.color};font-weight:600;">${t.name}</span>`).join('')}
      </div>
      <div style="display:flex;gap:16px;">
        <div><div class="label-xs">Critical gaps</div><div style="font-size:13px;font-weight:700;color:${crit>0?C.red:C.teal};">${crit}</div></div>
        <div><div class="label-xs">Interfaces</div><div style="font-size:13px;font-weight:700;">${p.connections.length}</div></div>
        <div><div class="label-xs">From org</div><div style="font-size:13px;font-weight:700;color:var(--teal);">${linked}</div></div>
      </div></div>`;
  }).join('');
  document.getElementById('overviewCards').innerHTML=cards;
  const statusEl=document.getElementById('overviewStatus');
  if(statusEl) statusEl.textContent=`${projects.length} projects · ${projects.reduce((a,p)=>a+p.teams.flatMap(t=>t.members).length,0)} people`;

  // Cross-project skill chart
  const skSet=new Set();
  projects.forEach(p=>p.phases.forEach(ph=>Object.keys(ph.required||{}).forEach(sk=>skSet.add(sk))));
  const skArr=[...skSet].slice(0,10);
  dc('crossChart');
  const cc=document.getElementById('crossChart');
  if(cc&&skArr.length){
    charts.crossChart=new Chart(cc,{type:'bar',data:{labels:skArr,datasets:projects.map(p=>({
      label:p.name,
      data:skArr.map(sk=>parseFloat(((simRes[p.id]?.team_exp?.[sk])||0).toFixed(2))),
      backgroundColor:p.color+'66',borderColor:p.color,borderWidth:1,borderRadius:3
    }))},options:{indexAxis:'y',responsive:true,maintainAspectRatio:false,
      plugins:{legend:{labels:{color:C.muted,font:{size:11}}}},
      scales:{x:{min:0,max:10,grid:{color:'#ffffff08'},ticks:{color:C.muted,font:{size:11}}},
              y:{grid:{display:false},ticks:{color:C.muted,font:{size:11}}}}}});
  }
}
