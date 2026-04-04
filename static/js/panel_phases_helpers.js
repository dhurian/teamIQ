// ── Phase duration + status helpers ──────────────────────────────────────────
const TO_WEEKS = {days: 1/7, weeks: 1, months: 4.333, years: 52};
function phaseWeeks(ph){
  if(ph.value!=null && ph.unit) return ph.value * (TO_WEEKS[ph.unit]||1);
  return ph.weeks||2; // legacy
}
function durationLabel(ph){
  const v = ph.value??ph.weeks??2;
  const u = ph.unit||'weeks';
  return `${parseFloat(v)%1===0?parseInt(v):parseFloat(v).toFixed(1)} ${u}`;
}

const WP_COLS = {not_started:'#4a556a', in_progress:'#4a9eff', complete:'#1fb885', blocked:'#e05050'};
const WP_LABELS = {not_started:'Not started', in_progress:'In progress', complete:'Complete', blocked:'Blocked'};

function phaseProjectHeaderHtml(proj, totalWeeks){
  return `<div class="flex-between mb15" style="flex-shrink:0;">
    <div><h2 style="margin:0 0 4px;">Phases</h2>
      <div class="flex-ac">
        <span style="font-size:12px;color:var(--muted);">Project:</span>
        <input type="text" value="${proj.name}" onchange="patchProject('${proj.id}',{name:this.value})" style="font-size:14px;font-weight:600;">
        <div class="flex-ac" style="gap:4px;">${PROJ_COLORS.map(c=>`<div onclick="patchProject('${proj.id}',{color:'${c}'})" style="width:13px;height:13px;border-radius:50%;background:${c};cursor:pointer;border:2px solid ${c===proj.color?'#fff':'transparent'};"></div>`).join('')}</div>
        <span style="font-size:12px;color:var(--faint);">${totalWeeks}w total</span>
      </div>
    </div>
    <button class="btn btn-primary" onclick="addPhase('${proj.id}')">+ Add Phase</button>
  </div>`;
}

function phaseSummaryBarHtml(phases){
  return phases
    .map((ph,i)=>`<div class="phase-seg" style="flex:${Math.max(.1,phaseWeeks(ph))};background:${PCOLS[i%4]}22;"><span style="color:${PCOLS[i%4]};">${ph.name} (${durationLabel(ph)})</span></div>`)
    .join('');
}

function phaseCardsPaneHtml(cards, leftFlex){
  return `<div data-phase-pane="left" style="flex:${leftFlex};display:flex;flex-direction:column;min-width:0;border-right:1px solid var(--border);overflow:hidden;">
    ${phaseCardsMin
      ? `<div onclick="phaseCardsMin=false;renderPhases()" title="Restore"
           style="display:flex;flex-direction:column;align-items:center;padding:10px 0;gap:8px;height:100%;cursor:pointer;background:var(--bg3);">
           <span style="font-size:12px;color:var(--muted);">▶</span>
           <span style="writing-mode:vertical-rl;transform:rotate(180deg);font-size:10px;font-weight:600;color:var(--faint);text-transform:uppercase;letter-spacing:.07em;">Cards</span>
         </div>`
      : `<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 10px;border-bottom:1px solid var(--border);background:var(--bg3);flex-shrink:0;">
           <span style="font-size:11px;font-weight:600;color:var(--muted);">Phase Cards</span>
           <button class="btn btn-sm" onclick="phaseCardsMin=true;renderPhases()" title="Minimize">—</button>
         </div>
         <div style="overflow-y:auto;flex:1;">${cards}</div>`
    }
  </div>`;
}

function phaseDragHandleHtml(showHandle){
  if(!showHandle) return '';
  return `<div id="phaseDragHandle" onmousedown="startPhaseSplit(event)"
      style="width:5px;flex-shrink:0;cursor:col-resize;background:var(--border);display:flex;align-items:center;justify-content:center;transition:background .12s;"
      onmouseenter="this.style.background='var(--teal)'" onmouseleave="this.style.background='var(--border)'">
      <div style="width:2px;height:32px;border-radius:1px;background:var(--border2);pointer-events:none;"></div>
    </div>`;
}

function phaseDiagramPaneHtml(proj, diagramSvg, rightFlex){
  return `<div data-phase-pane="right" style="flex:${rightFlex};display:flex;flex-direction:column;min-width:0;overflow:hidden;">
    ${phaseDiagMin
      ? `<div onclick="phaseDiagMin=false;renderPhases()" title="Restore"
           style="display:flex;flex-direction:column;align-items:center;padding:10px 0;gap:8px;height:100%;cursor:pointer;background:var(--bg3);">
           <span style="font-size:12px;color:var(--muted);">◀</span>
           <span style="writing-mode:vertical-rl;transform:rotate(180deg);font-size:10px;font-weight:600;color:var(--faint);text-transform:uppercase;letter-spacing:.07em;">Diagram</span>
         </div>`
      : `<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 10px;border-bottom:1px solid var(--border);background:var(--bg3);flex-shrink:0;">
           <span style="font-size:11px;font-weight:600;color:var(--muted);">Phase Diagram</span>
           <div class="flex-ac">
             <button class="btn btn-sm ${pdMode==='connecting'?'btn-active':''}" onclick="togglePhDiagConnMode('${proj.id}')">${pdMode==='connecting'?'● Connecting…':'⊕ Connect'}</button>
             <button class="btn btn-sm" onclick="phDiagAutoLayout('${proj.id}')">↺ Auto</button>
             <button class="btn btn-sm" onclick="pdZoom=Math.min(2,pdZoom+.15);phUpdateTransform()">+</button>
             <button class="btn btn-sm" onclick="pdZoom=Math.max(.3,pdZoom-.15);phUpdateTransform()">−</button>
             <button class="btn btn-sm" onclick="pdPan={x:20,y:20};pdZoom=1;phUpdateTransform()">⊙</button>
             <button class="btn btn-sm" onclick="phaseDiagMin=true;renderPhases()" title="Minimize">—</button>
           </div>
         </div>
         <div style="font-size:11px;color:var(--faint);padding:4px 12px;border-bottom:1px solid var(--border);flex-shrink:0;">
           ${pdMode==='connecting'
             ? '<span style="color:var(--blue);">Click first node → click second to connect</span>'
             : 'Drag nodes · ⊕ Connect to draw edges · Click edge to remove · Click node to select'}
         </div>
         ${diagramSvg}`
    }
  </div>`;
}

function phaseDurationInputHtml(projId, ph){
  return `<div class="flex-ac" onclick="event.stopPropagation()">
    <input type="number" min="0.1" step="0.5" value="${ph.value??ph.weeks??2}"
      onchange="patchPhase('${projId}','${ph.id}',{value:parseFloat(this.value)})"
      style="width:52px;text-align:center;">
    <select onchange="patchPhase('${projId}','${ph.id}',{unit:this.value})" style="font-size:11px;padding:4px 6px;">
      ${DURATION_UNITS.map(u=>`<option value="${u}" ${(ph.unit||'weeks')===u?'selected':''}>${u}</option>`).join('')}
    </select>
  </div>`;
}

function phaseSkillSectionHtml(projId, ph, col){
  const toggles = ALL_SKILLS.map(sk=>{
    const on=ph.required?.[sk]!==undefined;
    return `<button class="skill-toggle ${on?'on':''}" style="${on?`color:${col};border-color:${col};background:${col}18;`:''}" onclick="togglePhaseSkill('${projId}','${ph.id}','${sk}')">${sk}</button>`;
  }).join('');

  const sliders = Object.keys(ph.required||{}).length
    ? `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(195px,1fr));gap:8px;margin-top:10px;">
        ${Object.entries(ph.required||{}).map(([sk,lv])=>`<div class="flex-ac">
          <span style="font-size:11px;color:var(--muted);width:100px;flex-shrink:0;">${sk}</span>
          <input type="range" min="1" max="10" step="0.5" value="${lv}"
            oninput="updatePhaseReq('${projId}','${ph.id}','${sk}',this.value);this.nextElementSibling.textContent=parseFloat(this.value).toFixed(1)" style="flex:1;">
          <span style="font-size:12px;font-weight:700;min-width:24px;font-family:var(--mono);">${parseFloat(lv).toFixed(1)}</span>
        </div>`).join('')}</div>`
    : `<div style="font-size:12px;color:var(--faint);margin-top:8px;">No requirements — click skills above</div>`;

  return `<div style="font-size:11px;color:var(--faint);margin-bottom:6px;">Toggle required skills:</div>
    <div>${toggles}</div>${sliders}`;
}

function phaseWorkPackageSectionHtml(projId, ph, proj){
  const wps = (ph.workPackages||[]).map(wp=>wpRow(wp,proj,ph)).join('');
  return `<div class="sep" style="margin:.75rem 0;"></div>
    <div class="flex-between" style="margin-bottom:6px;">
      <h3 style="margin:0;font-size:10px;">Work Packages (${(ph.workPackages||[]).length})</h3>
      <button class="btn btn-sm" onclick="event.stopPropagation();addWP('${projId}','${ph.id}')">+ Add</button>
    </div>
    ${wps||'<div style="font-size:11px;color:var(--faint);">No work packages yet</div>'}`;
}

function phaseChildrenSectionHtml(projId, ph, proj, col, pi, depth){
  const subCards = (ph.children||[]).map(sub=>phaseCard(sub,pi,proj,depth+1)).join('');
  const hasChildren = (ph.children||[]).length > 0;
  return `<div class="sep" style="margin:.75rem 0;"></div>
    <div class="flex-between" style="margin-bottom:6px;">
      <div class="flex-ac">
        ${hasChildren?`<button class="btn btn-sm" onclick="event.stopPropagation();togglePhaseExpanded('${projId}','${ph.id}')" style="padding:2px 7px;">${ph.expanded!==false?'▾':'▸'}</button>`:''}
        <h3 style="margin:0;font-size:10px;">Subphases (${(ph.children||[]).length})</h3>
      </div>
      <button class="btn btn-sm" onclick="event.stopPropagation();addSubphase('${projId}','${ph.id}')">+ Add</button>
    </div>
    ${ph.expanded!==false&&hasChildren?`<div style="margin-left:12px;border-left:2px solid ${col}44;padding-left:8px;">${subCards}</div>`:''}`;
}
