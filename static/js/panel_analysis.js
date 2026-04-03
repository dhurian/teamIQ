// ════════════════════════════════════════════════════════════════════════════
// ANALYSIS
// ════════════════════════════════════════════════════════════════════════════
async function renderAnalysis(){
  const proj=ap();if(!proj)return;
  const{teams,connections,phases}=proj;
  const allM=teams.flatMap(t=>t.members);
  const tw=phases.reduce((a,p)=>a+p.weeks,0);
  document.getElementById('panelAnalysis').innerHTML=`
    <div class="flex-between mb15">
      <div><h2 style="margin:0 0 4px;">${proj.name} — Analysis</h2>
        <div style="font-size:12px;color:var(--muted);">${teams.length} teams · ${allM.length} members · ${phases.length} phases · ${tw}w</div></div>
      <button class="btn btn-primary" onclick="renderAnalysis()">↻ Re-run</button>
    </div>
    <div id="analysisContent"><div style="padding:3rem;text-align:center;color:var(--muted);"><span class="spinner" style="display:inline-block;margin-right:8px;"></span>Running Monte Carlo simulation…</div></div>`;

  const data = await POST('/api/simulate', {projectId: proj.id, runs: 2000});
  const res  = data.combined;
  const tRes = data.teams;

  const maxReq={};phases.forEach(ph=>Object.entries(ph.required||{}).forEach(([sk,lv])=>{if(!maxReq[sk]||maxReq[sk]<lv)maxReq[sk]=lv;}));
  const gaps=Object.entries(maxReq).map(([sk,req])=>{const av=res.team_exp?.[sk]||0;return{sk,req,av,cov:Math.min(1,av/req)};}).sort((a,b)=>a.cov-b.cov);
  const crit=gaps.filter(g=>g.cov<.85).length;
  const oPct=Math.round((res.overall_prob||0)*100);
  const sc=spCol(res.overall_prob||0);

  const tCards=teams.map(t=>{
    const tr=tRes[t.id]||{};const pct=Math.round((tr.overall_prob||0)*100);const hcol=spCol(tr.overall_prob||0);
    const wk=Object.entries(maxReq).map(([sk,req])=>({sk,req,av:tr.team_exp?.[sk]||0,cov:Math.min(1,(tr.team_exp?.[sk]||0)/req)})).sort((a,b)=>a.cov-b.cov).slice(0,3);
    return`<div class="card-sm" style="border-left:3px solid ${t.color};">
      <div class="flex-between" style="margin-bottom:8px;">
        <div class="flex-ac"><div style="width:8px;height:8px;border-radius:50%;background:${t.color};"></div><span style="font-weight:700;font-size:13px;">${t.name}</span><span style="font-size:11px;color:var(--faint);">${t.members.length}m</span></div>
        <span style="font-size:18px;font-weight:700;font-family:var(--mono);color:${hcol};">${pct}%</span>
      </div>
      <div style="height:4px;background:var(--bg4);border-radius:2px;overflow:hidden;margin-bottom:8px;"><div style="height:100%;width:${pct}%;background:${hcol};border-radius:2px;"></div></div>
      <div style="font-size:11px;color:var(--faint);margin-bottom:3px;">Weakest skills:</div>
      ${wk.map(g=>`<div class="flex-ac" style="margin-top:4px;"><span style="font-size:11px;color:var(--muted);width:100px;flex-shrink:0;">${g.sk}</span>
        <div class="gap-bar-wrap"><div class="gap-fill" style="width:${Math.round(g.cov*100)}%;background:${g.cov>=1?'#1fb885':g.cov>=.7?'#f0a030':'#e05050'};"></div></div>
        <span style="font-size:10px;color:var(--faint);min-width:28px;">${Math.round(g.cov*100)}%</span></div>`).join('')}
    </div>`;}).join('');

  const gapRows=gaps.map(g=>{
    const bc=g.cov>=1?'#1fb885':g.cov>=.85?'#5dc890':g.cov>=.7?'#f0a030':'#e05050';
    const rb=g.cov>=.85?'b-ok':g.cov>=.7?'b-med':'b-high';
    const risk=g.cov>=1?'None':g.cov>=.85?'Low':g.cov>=.7?'Medium':'High';
    const ph=phases.filter(p=>p.required?.[g.sk]).map(p=>p.name).join(', ');
    const gap=Math.max(0,g.req-g.av);
    const contrib=teams.map(t=>{const tr2=tRes[t.id]||{};return(tr2.team_exp?.[g.sk]||0)>=1?`<span style="color:${t.color};font-size:10px;">●</span>`:null;}).filter(Boolean).join(' ');
    return`<tr><td><div style="font-weight:600;">${g.sk}</div><div style="font-size:11px;color:var(--faint);">${ph}</div></td>
      <td class="c" style="font-family:var(--mono);font-weight:700;">${g.req.toFixed(1)}</td>
      <td class="c" style="font-family:var(--mono);font-weight:700;color:${bc};">${g.av.toFixed(1)}</td>
      <td class="c" style="font-family:var(--mono);color:${gap>0?'#e05050':'#1fb885'};">${gap>0?'+'+gap.toFixed(1):'✓'}</td>
      <td><div class="flex-ac"><div class="gap-bar-wrap"><div class="gap-fill" style="width:${Math.round(Math.min(100,g.cov*100))}%;background:${bc};"></div></div><span style="font-size:11px;color:var(--muted);min-width:30px;">${Math.round(g.cov*100)}%</span></div></td>
      <td class="c"><span class="badge ${rb}">${risk}</span></td>
      <td class="c">${contrib||'—'}</td></tr>`;}).join('');

  const connRisks=connections.map(c=>{
    const ft=teams.find(t=>t.id===c.from),tt=teams.find(t=>t.id===c.to);if(!ft||!tt)return'';
    const fr=tRes[c.from]||{},tr2=tRes[c.to]||{};
    const risk=Math.min(fr.overall_prob||0,tr2.overall_prob||0);
    const overlap=ALL_SKILLS.filter(sk=>(fr.team_exp?.[sk]||0)>=7&&(tr2.team_exp?.[sk]||0)>=7);
    return`<tr><td><span style="color:${ft.color};font-weight:600;">${ft.name}</span><span style="color:var(--faint);margin:0 5px;">→</span><span style="color:${tt.color};font-weight:600;">${tt.name}</span></td>
      <td class="c"><span style="font-size:11px;padding:2px 8px;border-radius:4px;background:${tCol(c.type)}18;color:${tCol(c.type)};">${c.label||c.type}</span></td>
      <td class="c" style="font-family:var(--mono);font-weight:700;color:${spCol(risk)};">${Math.round(risk*100)}%</td>
      <td style="font-size:11px;color:var(--muted);">${overlap.slice(0,4).join(', ')||'—'}</td></tr>`;}).join('');

  const timeline=phases.map((ph,pi)=>{
    const prob=(res.phase_prob||[])[pi]||0,pct=Math.round(prob*100),col=PCOLS[pi%4];
    const phG=Object.entries(ph.required||{}).map(([sk,req])=>({sk,req,av:res.team_exp?.[sk]||0,ok:(res.team_exp?.[sk]||0)>=req}));
    const bad=phG.filter(g=>!g.ok);
    const contrib=teams.map(t=>{const tr2=tRes[t.id]||{};return Object.keys(ph.required||{}).some(sk=>(tr2.team_exp?.[sk]||0)>3)?`<span style="font-size:10px;padding:1px 7px;border-radius:10px;background:${t.color}18;color:${t.color};margin:2px;display:inline-block;">${t.name}</span>`:null;}).filter(Boolean).join('');
    return`<div style="display:grid;grid-template-columns:16px 1fr;gap:12px;margin-bottom:14px;">
      <div style="display:flex;flex-direction:column;align-items:center;"><div class="timeline-dot" style="background:${col};"></div>${pi<phases.length-1?'<div class="timeline-line"></div>':''}</div>
      <div style="padding-bottom:14px;">
        <div class="flex-between" style="margin-bottom:6px;"><div><span style="font-weight:700;font-size:14px;">${ph.name}</span><span style="font-size:12px;color:var(--muted);margin-left:8px;">${ph.weeks}w</span></div>
          <div class="flex-ac"><span style="font-size:12px;color:var(--muted);">Success:</span><span style="font-size:16px;font-weight:700;font-family:var(--mono);color:${spCol(prob)};">${pct}%</span></div></div>
        <div style="margin-bottom:5px;">${contrib}</div>
        ${bad.length?`<div style="font-size:12px;color:var(--red);background:rgba(224,80,80,.08);padding:6px 10px;border-radius:6px;border:1px solid rgba(224,80,80,.2);margin-bottom:6px;">Gaps: ${bad.map(g=>`${g.sk} (need ${g.req.toFixed(0)}, ≈${g.av.toFixed(1)})`).join(' · ')}</div>`:`<div style="font-size:12px;color:var(--teal);margin-bottom:6px;">✓ All requirements covered</div>`}
        <div>${phG.map(g=>`<span class="badge ${g.ok?'b-ok':'b-high'}" style="margin:2px;">${g.sk} ${g.ok?'✓':g.av.toFixed(1)+'/'+g.req.toFixed(0)}</span>`).join('')}</div>
      </div></div>`;}).join('');

  document.getElementById('analysisContent').innerHTML=`
    <div class="grid4">
      <div class="metric"><label>Overall success</label><div class="val" style="color:${sc};">${oPct}%</div><div class="sub">all teams combined</div></div>
      <div class="metric"><label>Teams / People</label><div class="val">${teams.length}<span style="font-size:16px;color:var(--faint);"> / ${allM.length}</span></div><div class="sub">in this project</div></div>
      <div class="metric"><label>Critical gaps</label><div class="val" style="color:${crit>0?'#e05050':'#1fb885'};">${crit}</div><div class="sub">skills &lt; 85% covered</div></div>
      <div class="metric"><label>Interfaces</label><div class="val">${connections.length}</div><div class="sub">team connections</div></div>
    </div>
    <div style="margin-bottom:1.5rem;"><h3>Per-team success</h3>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:10px;">${tCards}</div></div>
    <div class="grid2 mb15">
      <div class="card"><h3>Skill coverage</h3><div style="position:relative;height:${Math.max(180,gaps.length*36+50)}px;"><canvas id="skillChart"></canvas></div></div>
      <div class="card"><h3>Phase probabilities</h3><div style="position:relative;height:${Math.max(180,phases.length*58+50)}px;"><canvas id="phaseChart"></canvas></div></div>
    </div>
    <div class="card mb15"><h3>Gap analysis</h3>
      <table><thead><tr><th>Skill</th><th class="c">Required</th><th class="c">Available</th><th class="c">Gap</th><th>Coverage</th><th class="c">Risk</th><th class="c">Teams</th></tr></thead>
      <tbody>${gapRows}</tbody></table></div>
    ${connections.length?`<div class="card mb15"><h3>Interface risk</h3>
      <table><thead><tr><th>Interface</th><th class="c">Type</th><th class="c">Joint success</th><th>Shared skills</th></tr></thead>
      <tbody>${connRisks}</tbody></table></div>`:''}
    <div class="card"><h3>Phase timeline &amp; readiness</h3>${timeline}</div>`;

  setTimeout(()=>{
    dc('skillChart');dc('phaseChart');
    const sc2=document.getElementById('skillChart');
    if(sc2)charts.skillChart=new Chart(sc2,{type:'bar',data:{labels:gaps.map(g=>g.sk),datasets:[{label:'Required',data:gaps.map(g=>g.req),backgroundColor:'#ffffff12',borderColor:'#ffffff33',borderWidth:1,borderRadius:3},{label:'Available',data:gaps.map(g=>parseFloat(g.av.toFixed(2))),backgroundColor:gaps.map(g=>g.av>=g.req?'#1fb88566':g.av/g.req>=.7?'#f0a03066':'#e0505066'),borderColor:gaps.map(g=>g.av>=g.req?'#1fb885':g.av/g.req>=.7?'#f0a030':'#e05050'),borderWidth:1,borderRadius:3}]},options:{indexAxis:'y',responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{min:0,max:10,grid:{color:'#ffffff08'},ticks:{color:'#8893a8',font:{size:11}}},y:{grid:{display:false},ticks:{color:'#8893a8',font:{size:11}}}}}});
    const pc2=document.getElementById('phaseChart');
    if(pc2)charts.phaseChart=new Chart(pc2,{type:'bar',data:{labels:phases.map(p=>p.name),datasets:[{data:(res.phase_prob||[]).map(p=>Math.round(p*100)),backgroundColor:phases.map((_,i)=>PCOLS[i%4]+'66'),borderColor:phases.map((_,i)=>PCOLS[i%4]),borderWidth:1,borderRadius:4}]},options:{indexAxis:'y',responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{min:0,max:100,grid:{color:'#ffffff08'},ticks:{color:'#8893a8',font:{size:11},callback:v=>v+'%'}},y:{grid:{display:false},ticks:{color:'#8893a8',font:{size:11}}}}}});
  },80);
}
