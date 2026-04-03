// ════════════════════════════════════════════════════════════════════════════
// PHASE SPLIT DRAG
// ════════════════════════════════════════════════════════════════════════════
function startPhaseSplit(e){
  e.preventDefault();
  const wrap=document.querySelector('[data-phase-pane="left"]')?.parentElement;
  if(!wrap)return;
  const rect=wrap.getBoundingClientRect();
  window.__phaseSplitDrag={startX:e.clientX,startSplit:phaseSplit,containerW:rect.width};
}
function initPhaseSplitEvents(){
  if(phaseSplitSetup)return;
  phaseSplitSetup=true;
  window.addEventListener('mousemove',e=>{
    if(!window.__phaseSplitDrag)return;
    const{startX,startSplit,containerW}=window.__phaseSplitDrag;
    phaseSplit=Math.max(0.15,Math.min(0.85,startSplit+(e.clientX-startX)/containerW));
    const lp=document.querySelector('[data-phase-pane="left"]');
    const rp=document.querySelector('[data-phase-pane="right"]');
    if(lp)lp.style.flex=`${phaseSplit} 1 0`;
    if(rp)rp.style.flex=`${1-phaseSplit} 1 0`;
  });
  window.addEventListener('mouseup',()=>{window.__phaseSplitDrag=null;});
}

// ── Window resize → re-render active panel ────────────────────────────────────
window.addEventListener('resize',()=>{
  if(activeTab==='phases')renderPhases();
  else if(activeTab==='timeline')renderTimeline();
});

// ── Boot ───────────────────────────────────────────────────────────────────
(async()=>{
  await loadState();
  renderOverview();
})();
