// ════════════════════════════════════════════════════════════════════════════
// PHASES – constants, duration helpers, WP colours, diagram state
// ════════════════════════════════════════════════════════════════════════════

// ── Duration helpers ─────────────────────────────────────────────────────────
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

// ── WP status colours ─────────────────────────────────────────────────────────
const WP_COLS = {not_started:'#4a556a', in_progress:'#4a9eff', complete:'#1fb885', blocked:'#e05050'};
const WP_LABELS = {not_started:'Not started', in_progress:'In progress', complete:'Complete', blocked:'Blocked'};

// ── Diagram state ─────────────────────────────────────────────────────────────
const PH_W=200, PH_H=80;
let pdDrag=null, pdConnFrom=null, pdMode='none';
let pdPan={x:20,y:20}, pdZoom=1, pdPanning=null;

function _phX(ph){ return (ph.x!=null&&!isNaN(ph.x))?ph.x:60; }
function _phY(ph,i){ return (ph.y!=null&&!isNaN(ph.y))?ph.y:60+i*150; }
