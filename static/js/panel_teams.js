// ════════════════════════════════════════════════════════════════════════════
// TEAMS
// ════════════════════════════════════════════════════════════════════════════
function renderTeams(){
  const proj=ap();if(!proj)return;
  const{teams,selTeamId,selMemberId}=proj;
  const team=teams.find(t=>t.id===selTeamId);
  const rawMember=team?.members.find(m=>m.id===selMemberId);

  const orgLookup={};
  flatPersons(S.globalOrg||{}).forEach(p=>{orgLookup[p.id]=p;});
  const resolveName=m=>m.orgId?orgLookup[m.orgId]?.name||'Linked':m.name||'Unknown';
  const resolveRole=m=>m.orgId?orgLookup[m.orgId]?.role||'':m.role||'';
  const resolveSkills=m=>m.orgId?orgLookup[m.orgId]?.skills||{}:m.skills||{};

  const teamList=teams.map(t=>`
    <div style="display:flex;align-items:center;gap:8px;padding:9px 12px;border-radius:8px;cursor:pointer;border:1px solid ${t.id===selTeamId?'var(--border)':'transparent'};background:${t.id===selTeamId?'var(--bg3)':'transparent'};transition:all .15s;margin-bottom:4px;" onclick="selectTeam('${proj.id}','${t.id}')">
      <div style="width:10px;height:10px;border-radius:50%;background:${t.color};flex-shrink:0;box-shadow:0 0 6px ${t.color}66;"></div>
      <div style="min-width:0;flex:1;"><div style="font-size:13px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${t.name}</div>
        <div style="font-size:11px;color:var(--faint);">${t.members.length} member${t.members.length!==1?'s':''}</div></div>
      <button class="btn btn-danger btn-sm" onclick="event.stopPropagation();delTeam('${proj.id}','${t.id}')">✕</button>
    </div>`).join('');

  const memberList=team?team.members.map(m=>{
    const nm=resolveName(m),rl=resolveRole(m);
    return`<div class="member-item ${m.id===selMemberId?'sel':''}" onclick="selectMember('${proj.id}','${m.id}')">
      <div class="avatar" style="width:32px;height:32px;background:${team.color}22;color:${team.color};">${ini(nm)}</div>
      <div style="min-width:0;flex:1;"><div style="font-size:13px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${nm}</div>
        <div style="font-size:11px;color:var(--faint);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${rl}</div></div>
      ${m.orgId?'<span class="org-tag">org</span>':''}
    </div>`;}).join(''):'';

  let editor='<div style="display:flex;align-items:center;justify-content:center;height:200px;color:var(--faint);font-size:13px;">← Select a member</div>';
  if(rawMember){
    const isLinked=!!rawMember.orgId;
    const nm=resolveName(rawMember),rl=resolveRole(rawMember),sk=resolveSkills(rawMember);
    editor=`<div class="card">
      <div class="flex-between" style="margin-bottom:1.25rem;">
        <div class="flex-ac">
          <div class="avatar" style="width:44px;height:44px;font-size:15px;background:${team.color}22;color:${team.color};">${ini(nm)}</div>
          <div>${isLinked?`<div style="font-size:15px;font-weight:700;">${nm}</div><div style="font-size:12px;color:var(--muted);">${rl}</div>
              <div style="margin-top:4px;font-size:11px;color:var(--teal);">🔗 Linked from org — edit in Organization</div>`
            :`<input type="text" value="${nm}" onchange="patchMember('${proj.id}','${rawMember.id}',{name:this.value})" style="font-size:15px;font-weight:700;background:transparent;border:none;border-bottom:1px solid var(--border);color:var(--text);padding:2px 0;width:200px;outline:none;">
              <input type="text" value="${rl}" onchange="patchMember('${proj.id}','${rawMember.id}',{role:this.value})" style="font-size:12px;background:transparent;border:none;color:var(--muted);padding:2px 0;width:200px;outline:none;display:block;margin-top:4px;">`}</div>
        </div>
        <div class="flex-ac">
          <select onchange="moveMember('${proj.id}','${rawMember.id}',this.value)">${teams.map(t=>`<option value="${t.id}" ${t.id===selTeamId?'selected':''}>${t.name}</option>`).join('')}</select>
          ${isLinked?`<button class="btn btn-sm" onclick="unlinkMember('${proj.id}','${rawMember.id}')">Unlink</button>`:''}
          <button class="btn btn-danger btn-sm" onclick="delMember('${proj.id}','${rawMember.id}')">Remove</button>
        </div>
      </div>
      ${isLinked?`<h3>Skills (read-only — edit in Organization)</h3>${ALL_SKILLS.map(sk2=>{const mn=sk[sk2]?.m||0;return`<div style="display:grid;grid-template-columns:120px 1fr 44px;align-items:center;gap:10px;margin-bottom:7px;"><div class="skill-label">${sk2}</div><div style="height:3px;background:var(--bg4);border-radius:2px;overflow:hidden;"><div style="height:100%;width:${mn*10}%;background:${scv(mn)};border-radius:2px;"></div></div><div class="skill-val" style="color:${scv(mn)};">${mn.toFixed(1)}</div></div>`;}).join('')}`
      :`<h3>Technical skills</h3>${TECH_SKILLS.map(sk2=>memberSkillRow(rawMember,sk2,proj.id)).join('')}<div class="sep"></div><h3>Personality &amp; work style</h3>${PERS_SKILLS.map(sk2=>memberSkillRow(rawMember,sk2,proj.id)).join('')}`}
    </div>`;
  }

  document.getElementById('panelTeams').innerHTML=`
    <div class="flex-between mb15">
      <div><h2 style="margin:0 0 4px;">Teams</h2>
        <div style="font-size:12px;color:var(--muted);">Project: <span style="color:${proj.color};font-weight:600;">${proj.name}</span></div></div>
      <div class="flex-ac">
        <button class="btn" onclick="openImportPicker()">⬇ Import from Org</button>
        <button class="btn btn-primary" onclick="addTeam('${proj.id}')">+ New Team</button>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:200px 210px 1fr;gap:16px;align-items:start;">
      <div><h3>Teams (${teams.length})</h3>${teamList}</div>
      <div>${team?`<div class="flex-between" style="margin-bottom:8px;">
          <div>
            <input type="text" value="${team.name}" onchange="patchTeam('${proj.id}','${team.id}',{name:this.value})" style="font-size:13px;font-weight:700;background:transparent;border:none;border-bottom:1px solid var(--border);color:var(--text);padding:2px 0;width:130px;outline:none;">
            <div class="flex-ac" style="margin-top:6px;gap:5px;"><span style="font-size:11px;color:var(--faint);">Color:</span>
              ${TCOLS.map(c=>`<div onclick="patchTeam('${proj.id}','${team.id}',{color:'${c}'})" style="width:13px;height:13px;border-radius:50%;background:${c};cursor:pointer;border:2px solid ${c===team.color?'#fff':'transparent'};"></div>`).join('')}
            </div>
          </div>
          <button class="btn btn-primary btn-sm" onclick="addStandaloneMember('${proj.id}','${team.id}')">+ Add</button>
        </div>
        <h3>Members (${team.members.length})</h3>${memberList}`:'<div style="color:var(--faint);font-size:13px;">Select a team</div>'}</div>
      <div>${editor}</div>
    </div>`;
}

function memberSkillRow(m,sk,pid){
  const{m:mn,s:sg}=m.skills?.[sk]||{m:5,s:1.5};
  const uid2=`ms_${m.id}_${sk.replace(/[^a-z0-9]/gi,'_')}`;
  return`<div class="skill-row">
    <div class="skill-label">${sk}</div>
    <div style="display:flex;flex-direction:column;gap:3px;">
      <div class="slider-line"><span class="slider-hint">Level</span>
        <input type="range" min="0" max="10" step="0.5" value="${mn}" oninput="patchMemberSkill('${pid}','${m.id}','${sk}','m',this.value);const e=document.getElementById('${uid2}');if(e){e.textContent=parseFloat(this.value).toFixed(1);e.style.color=scv(parseFloat(this.value));}">
      </div>
      <div class="slider-line"><span class="slider-hint" style="color:var(--faint);">Uncert.</span>
        <input type="range" min="0.2" max="3" step="0.1" value="${sg}" oninput="patchMemberSkill('${pid}','${m.id}','${sk}','s',this.value)" style="opacity:.45;">
      </div>
    </div>
    <div class="skill-val" id="${uid2}" style="color:${scv(mn)};">${mn.toFixed(1)}</div>
  </div>`;
}
