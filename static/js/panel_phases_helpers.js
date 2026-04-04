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
