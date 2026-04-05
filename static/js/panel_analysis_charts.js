// ════════════════════════════════════════════════════════════════════════════
// ANALYSIS — Chart.js initialisation (skill coverage + phase probability)
// Call: _initAnalysisCharts(gaps, phases, res)
// ════════════════════════════════════════════════════════════════════════════

// ── SECTION: chart init ───────────────────────────────────────────────────────
function _initAnalysisCharts(gaps, phases, res) {
  setTimeout(() => {
    dc('skillChart'); dc('phaseChart');

    // ── Skill coverage horizontal bar ────────────────────────────────────────
    const sc = document.getElementById('skillChart');
    if (sc) charts.skillChart = new Chart(sc, {
      type: 'bar',
      data: {
        labels: gaps.map(g => g.sk),
        datasets: [
          { label: 'Required', data: gaps.map(g => g.req),
            backgroundColor: '#ffffff12', borderColor: '#ffffff33', borderWidth: 1, borderRadius: 3 },
          { label: 'Available', data: gaps.map(g => parseFloat(g.av.toFixed(2))),
            backgroundColor: gaps.map(g => g.av>=g.req?C.teal+'66':g.av/g.req>=.7?C.amber+'66':C.red+'66'),
            borderColor:      gaps.map(g => g.av>=g.req?C.teal:g.av/g.req>=.7?C.amber:C.red),
            borderWidth: 1, borderRadius: 3 },
        ],
      },
      options: {
        indexAxis: 'y', responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { min: 0, max: 10, grid: { color: '#ffffff08' }, ticks: { color: C.muted, font: { size: 11 } } },
          y: { grid: { display: false },                       ticks: { color: C.muted, font: { size: 11 } } },
        },
      },
    });

    // ── Phase success bar with 95% CI whiskers ────────────────────────────────
    const phasePcts = (res.phase_prob || []).map(p => Math.round(p * 100));
    const phCiLo    = (res.phase_ci95 || []).map(ci => ci ? Math.round(ci[0] * 100) : 0);
    const phCiHi    = (res.phase_ci95 || []).map(ci => ci ? Math.round(ci[1] * 100) : 0);

    const pc = document.getElementById('phaseChart');
    if (pc) charts.phaseChart = new Chart(pc, {
      type: 'bar',
      data: {
        labels: phases.map(p => p.name),
        datasets: [{ data: phasePcts,
          backgroundColor: phases.map((_, i) => PCOLS[i % 4] + '66'),
          borderColor:      phases.map((_, i) => PCOLS[i % 4]),
          borderWidth: 1, borderRadius: 4 }],
      },
      options: {
        indexAxis: 'y', responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: ctx => {
            const i = ctx.dataIndex;
            return `Success: ${phasePcts[i]}%  (95% CI: ${phCiLo[i]}–${phCiHi[i]}%)`;
          }}},
        },
        scales: {
          x: { min: 0, max: 100, grid: { color: '#ffffff08' }, ticks: { color: C.muted, font: { size: 11 }, callback: v => v + '%' } },
          y: { grid: { display: false },                         ticks: { color: C.muted, font: { size: 11 } } },
        },
      },
      plugins: [{
        id: 'ci-bars',
        afterDatasetsDraw(chart) {
          const { ctx, scales: { x, y } } = chart;
          ctx.save(); ctx.strokeStyle = '#ffffff88'; ctx.lineWidth = 1.5;
          phasePcts.forEach((_, i) => {
            const lo = phCiLo[i], hi = phCiHi[i]; if (lo === hi) return;
            const yC = y.getPixelForValue(i), xLo = x.getPixelForValue(lo), xHi = x.getPixelForValue(hi), h = 5;
            ctx.beginPath(); ctx.moveTo(xLo, yC-h); ctx.lineTo(xLo, yC+h); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(xHi, yC-h); ctx.lineTo(xHi, yC+h); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(xLo, yC);   ctx.lineTo(xHi, yC);   ctx.stroke();
          });
          ctx.restore();
        },
      }],
    });
  }, 80);
}
