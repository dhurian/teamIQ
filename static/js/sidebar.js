// ── Sidebar ────────────────────────────────────────────────────────────────
function renderSidebar(){
  const projects = S.projects||[];
  const active   = S.activeProjectId;
  document.getElementById('sidebarProjects').innerHTML = `
    <div class="proj-section-head">
      <span class="sec-label">Projects (${projects.length})</span>
      <button class="btn btn-primary" style="font-size:10px;padding:3px 8px;" onclick="addProject()">+ New</button>
    </div>
    ${projects.map(p=>`
      <div class="proj-item ${p.id===active?'active-proj':''}" onclick="switchProject('${p.id}')">
        <div class="proj-dot" style="background:${p.color};box-shadow:0 0 5px ${p.color}66;"></div>
        <div style="min-width:0;flex:1;">
          <div class="proj-name">${p.name}</div>
          <div class="proj-meta">${p.teams.length} teams · ${p.phases.length} phases</div>
        </div>
        <div style="display:flex;gap:2px;">
          <button class="proj-del" title="Clone project" onclick="event.stopPropagation();cloneProject('${p.id}')">⎘</button>
          ${projects.length>1?`<button class="proj-del" onclick="event.stopPropagation();delProject('${p.id}')">✕</button>`:''}
        </div>
      </div>`).join('')}`;
  const proj = ap();
  const lbl  = document.getElementById('projTabsLabel');
  if(lbl){ lbl.textContent = proj?.name||'Current Project'; lbl.style.color = proj?.color||'var(--faint)'; }
}

// ── Tab routing ────────────────────────────────────────────────────────────
function setTab(tab){
  activeTab = tab;
  const labels = {overview:'Overview',orghier:'Organization',resources:'Resources',teams:'Teams',phases:'Phases',timeline:'Timeline',orgchart:'Org Chart',bizcase:'Business Case',reqs:'Requirements',analysis:'Analysis'};
  document.querySelectorAll('.nav-item').forEach(n=>n.classList.toggle('active',n.textContent.trim()===labels[tab]));
  document.querySelectorAll('.panel').forEach(p=>p.classList.remove('active'));
  const pm = {overview:'panelOverview',orghier:'panelOrgHier',resources:'panelResources',teams:'panelTeams',phases:'panelPhases',timeline:'panelTimeline',orgchart:'panelOrgchart',bizcase:'panelBizcase',reqs:'panelReqs',analysis:'panelAnalysis'};
  document.getElementById(pm[tab])?.classList.add('active');
  rerender(tab);
}

function rerender(tab){
  const t = tab||activeTab;
  if(t==='overview')  renderOverview();
  else if(t==='orghier')  renderOrgHier();
  else if(t==='teams')    renderTeams();
  else if(t==='phases')   renderPhases();
  else if(t==='timeline') renderTimeline();
  else if(t==='orgchart') renderOrgChart();
  else if(t==='bizcase')  renderBizCase();
  else if(t==='reqs')     renderReqs();
  else if(t==='analysis')   renderAnalysis();
  else if(t==='resources')  renderResources();
}
