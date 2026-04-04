// ════════════════════════════════════════════════════════════════════════════
// PHASES  (split pane: list editor left + interactive diagram right)
// ════════════════════════════════════════════════════════════════════════════

// ── Shared helpers are in panel_phases_helpers.js

// ── Diagram state ─────────────────────────────────────────────────────────────
const PH_W=200, PH_H=80;
let pdDrag=null, pdConnFrom=null, pdMode='none';
let pdPan={x:20,y:20}, pdZoom=1, pdPanning=null;
let selPhaseId=null;

// ── Main render ───────────────────────────────────────────────────────────────
function renderPhases(){
  const proj = ap();
  if(!proj) return;

  const phases = proj.phases || [];
  const totalWeeks = phases.reduce((acc, ph)=>acc + phaseWeeks(ph), 0).toFixed(1);
  const cards = phases.map((ph, pi)=>phaseCard(ph, pi, proj)).join('');

  const phasePanelHeight = Math.max(380, window.innerHeight - 218);
  const leftFlex = phaseCardsMin ? '0 0 30px' : phaseDiagMin ? '1 1 0' : `${phaseSplit} 1 0`;
  const rightFlex = phaseDiagMin ? '0 0 30px' : phaseCardsMin ? '1 1 0' : `${1-phaseSplit} 1 0`;
  const showHandle = !phaseCardsMin && !phaseDiagMin;

  const diagramHeight = Math.max(200, phasePanelHeight - 64);
  const diagramSvg = buildPhaseDiagram(proj, diagramHeight);

  document.getElementById('panelPhases').innerHTML = `
    ${phaseProjectHeaderHtml(proj, totalWeeks)}
    <div class="phase-bar mb15" style="flex-shrink:0;">${phaseSummaryBarHtml(phases)}</div>
    <div style="display:flex;height:${phasePanelHeight}px;border:1px solid var(--border);border-radius:10px;overflow:hidden;flex-shrink:0;background:var(--bg2);">
      ${phaseCardsPaneHtml(cards, leftFlex)}
      ${phaseDragHandleHtml(showHandle)}
      ${phaseDiagramPaneHtml(proj, diagramSvg, rightFlex)}
    </div>`;

  initPhaseDiagramEvents(proj.id);
  initPhaseSplitEvents();
}

// ── Phase card (recursive) ────────────────────────────────────────────────────
