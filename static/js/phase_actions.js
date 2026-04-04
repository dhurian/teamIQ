// ════════════════════════════════════════════════════════════════════════════
// PHASES – selection state and split-pane resize
// ════════════════════════════════════════════════════════════════════════════
let selPhaseId=null;

function selectPhase(phid){
  selPhaseId=(selPhaseId===phid?null:phid);
  renderPhases();
}
