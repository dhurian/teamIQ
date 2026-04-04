// ════════════════════════════════════════════════════════════════════════════
// PHASES – main render function
// (helpers → panel_phases_helpers.js, cards → phase_card.js,
//  diagram → phase_diagram.js, selection → phase_actions.js)
// ════════════════════════════════════════════════════════════════════════════

function renderPhases(){
  const proj=ap(); if(!proj) return;
  const {phases, phaseEdges=[]} = proj;
  const tw = phases.reduce((a,ph)=>a+phaseWeeks(ph),0).toFixed(1);
  const bar = phases.map((ph,i)=>`<div class="phase-seg" style="flex:${Math.max(.1,phaseWeeks(ph))};background:${PCOLS[i%4]}22;"><span style="color:${PCOLS[i%4]};">${ph.name} (${durationLabel(ph)})</span></div>`).join('');

  const cards = phases.map((ph,pi)=>phaseCard(ph,pi,proj)).join('');
  const phH   = Math.max(380, window.innerHeight - 218);
  const lFlex = phaseCardsMin ? '0 0 30px' : phaseDiagMin ? '1 1 0' : `${phaseSplit} 1 0`;
  const rFlex = phaseDiagMin  ? '0 0 30px' : phaseCardsMin ? '1 1 0' : `${1-phaseSplit} 1 0`;
  const showHandle = !phaseCardsMin && !phaseDiagMin;
  const diagH = Math.max(200, phH - 64);
  const diagSvg = buildPhaseDiagram(proj, diagH);

  document.getElementById('panelPhases').innerHTML=`
    <div class="flex-between mb15" style="flex-shrink:0;">
      <div><h2 style="margin:0 0 4px;">Phases</h2>
        <div class="flex-ac">
          <span style="font-size:12px;color:var(--muted);">Project:</span>
          <input type="text" value="${proj.name}" onchange="patchProject('${proj.id}',{name:this.value})" style="font-size:14px;font-weight:600;">
          <div class="flex-ac" style="gap:4px;">${PROJ_COLORS.map(c=>`<div onclick="patchProject('${proj.id}',{color:'${c}'})" style="width:13px;height:13px;border-radius:50%;background:${c};cursor:pointer;border:2px solid ${c===proj.color?'#fff':'transparent'};"></div>`).join('')}</div>
          <span style="font-size:12px;color:var(--faint);">${tw}w total</span>
        </div>
      </div>
      <button class="btn btn-primary" onclick="addPhase('${proj.id}')">+ Add Phase</button>
    </div>
    <div class="phase-bar mb15" style="flex-shrink:0;">${bar}</div>
    <div style="display:flex;height:${phH}px;border:1px solid var(--border);border-radius:10px;overflow:hidden;flex-shrink:0;background:var(--bg2);">

      <!-- Left: Phase Cards -->
      <div data-phase-pane="left" style="flex:${lFlex};display:flex;flex-direction:column;min-width:0;border-right:1px solid var(--border);overflow:hidden;">
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
      </div>

      <!-- Drag handle -->
      ${showHandle ? `<div id="phaseDragHandle" onmousedown="startPhaseSplit(event)"
          style="width:5px;flex-shrink:0;cursor:col-resize;background:var(--border);display:flex;align-items:center;justify-content:center;transition:background .12s;"
          onmouseenter="this.style.background='var(--teal)'" onmouseleave="this.style.background='var(--border)'">
          <div style="width:2px;height:32px;border-radius:1px;background:var(--border2);pointer-events:none;"></div>
        </div>` : ''}

      <!-- Right: Phase Diagram -->
      <div data-phase-pane="right" style="flex:${rFlex};display:flex;flex-direction:column;min-width:0;overflow:hidden;">
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
             ${diagSvg}`
        }
      </div>
    </div>`;

  initPhaseDiagramEvents(proj.id);
  initPhaseSplitEvents();
}
