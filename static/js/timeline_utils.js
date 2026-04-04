// ════════════════════════════════════════════════════════════════════════════
// TIMELINE – utility helpers (date math, duration, task accessors)
// ════════════════════════════════════════════════════════════════════════════
const TO_DAYS = {days:1, weeks:7, months:30.44, years:365.25};

// ── Duration helpers ──────────────────────────────────────────────────────────
function phaseDays(ph){
  return parseFloat(ph.value ?? ph.weeks ?? 2) * ((ph.unit && TO_DAYS[ph.unit]) || 7);
}
function wpDays(wp){
  return parseFloat(wp.value ?? 1) * ((wp.unit && TO_DAYS[wp.unit]) || 7);
}
function clamp(n,min,max){ return Math.max(min, Math.min(max, n)); }

function daysToValueUnit(days){
  days=Math.max(1,Math.round(days*2)/2);
  if(days<=14)return{value:days,unit:'days'};
  const w=Math.round(days/7*2)/2;
  if(w<=12)return{value:w,unit:'weeks'};
  const m=Math.round(days/30.44*2)/2;
  if(m<=24)return{value:m,unit:'months'};
  return{value:Math.round(days/365.25*2)/2,unit:'years'};
}

// ── Date helpers ──────────────────────────────────────────────────────────────
function isoWeekParts(date){
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return {year:d.getUTCFullYear(), week:weekNo};
}
function fmtDateLabel(ms){
  return new Date(ms).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'});
}
function dateInputFromProjectDay(startMs, day){
  return new Date(startMs + Math.round(day)*86400000).toISOString().slice(0,10);
}
function projectDayFromDate(startMs, val){
  if(!val) return null;
  return Math.round((new Date(val).getTime() - startMs) / 86400000);
}

// ── Task accessors ────────────────────────────────────────────────────────────
function taskLabel(task){ return task.type==='wp' ? (task.wp?.name||'Work Package') : (task.ph?.name||'Phase'); }
function taskDuration(task){ return task.type==='wp' ? wpDays(task.wp||{}) : phaseDays(task.ph||{}); }
function taskStartOverride(task){ return task.type==='wp' ? task.wp?.startDateOverride : task.ph?.startDateOverride; }
function taskEndOverride(task){ return task.type==='wp' ? task.wp?.endDateOverride : task.ph?.endDateOverride; }
