// ── Local UI state (no computation here – Python owns all data) ────────────
let S = {};          // full state mirror from /api/state
let activeTab = 'overview';
let orgHierView = 'map';
let orgMapPan = {x:60,y:50}, orgMapZoom = 1, orgMapDragging = null, orgMapSelId = null;
let orgNodeDrag = null, orgConnFrom = null;
let orgPan={x:20,y:20}, orgZoom=1, orgPanning=null, orgEventsSetup=false;
let charts = {};
let importChecked = new Set();
let ganttCollapsed = new Set();
let ganttZoom = 1;
let ganttSelId = null;        // selected item id (phase / subphase / WP)
let ganttSelType = null;      // 'phase' | 'subphase' | 'wp'
let ganttBarResizeDrag = null;
let ganttBarResizeSetup = false;
let phaseSplit = 0.5;        // left-pane width fraction (0.15–0.85)
let phaseCardsMin = false;   // cards pane minimized
let phaseDiagMin  = false;   // diagram pane minimized
let phaseSplitSetup = false; // window drag listeners attached once
let ganttHeight = 440;       // gantt chart height px (user-resizable)
let ganttResizeSetup = false;
// ── Extended timeline state ─────────────────────────────────────────────────
let ganttViewStartDay = -14;   // project-relative day shown at left edge
let ganttViewDays = 140;       // default visible window width in days
let ganttInspectorPos = {x: 260, y: 140};
let ganttInspectorDrag = null;
let ganttInspectorSetup = false;
