/* ---------- Charts as inline SVG / HTML ----------
   Colours come from CSS custom properties (--series-1 … --series-4, team
   colours), so light and dark theme are handled in styles.css. */

// A line chart can show this many series; each takes one colour slot (1-based)
export const SERIES_SLOTS = 4;

const W = 320, H = 170;
const M = { l:36, r:12, t:10, b:22 };
const PLOT_W = W - M.l - M.r, PLOT_H = H - M.t - M.b;

// Round axis values covering min…max in about `target` steps
export function niceTicks(min, max, target=4){
  if(max - min < 20){ const mid = (min + max) / 2; min = mid - 10; max = mid + 10; }
  const raw = (max - min) / target;
  const pow = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map(f=>f*pow).find(s=>s >= raw);
  const ticks = [];
  for(let v = Math.floor(min/step)*step; v < max + step; v += step) ticks.push(Math.round(v*100)/100);
  return ticks;
}

// The value of a series at position x: its latest point at or before x
export function valueAt(points, x){
  let value = points[0].y;
  for(const p of points){ if(p.x <= x) value = p.y; else break; }
  return value;
}

// series: [{ slot, points:[{ x, y }] }], points ordered by x and starting at x = 0.
// x runs from 0 to xMax in whole steps (here: matches in the period). A series
// stays level after its last point. xLabels: text under the left and right end.
export function lineChartSVG({ series, xMax, xLabels, label }){
  const span = Math.max(1, xMax);
  const ticks = niceTicks(
    Math.min(...series.flatMap(s=>s.points.map(p=>p.y))),
    Math.max(...series.flatMap(s=>s.points.map(p=>p.y)))
  );
  const y0 = ticks[0], y1 = ticks[ticks.length-1];
  const sx = x=>M.l + PLOT_W * x / span;
  const sy = y=>M.t + PLOT_H * (1 - (y - y0) / (y1 - y0));
  const n = v=>Math.round(v*10)/10;

  const grid = ticks.map(t=>`
    <line class="chart-grid" x1="${M.l}" x2="${W - M.r}" y1="${n(sy(t))}" y2="${n(sy(t))}"/>
    <text class="chart-tick" x="${M.l - 6}" y="${n(sy(t)) + 3.5}" text-anchor="end">${t}</text>`).join('');
  const lines = series.map(s=>{
    const pts = s.points.slice();
    const last = pts[pts.length-1];
    if(last.x < span) pts.push({ x:span, y:last.y });
    return `
      <polyline class="chart-line s${s.slot}" points="${pts.map(p=>n(sx(p.x)) + ',' + n(sy(p.y))).join(' ')}"/>
      <circle class="chart-dot s${s.slot}" cx="${n(sx(span))}" cy="${n(sy(last.y))}" r="4"/>`;
  }).join('');
  return `
    <svg class="chart" viewBox="0 0 ${W} ${H}" role="img" tabindex="0" aria-label="${label}" data-xmax="${span}">
      ${grid}
      <text class="chart-tick" x="${M.l}" y="${H - 6}" text-anchor="start">${xLabels[0]}</text>
      <text class="chart-tick" x="${W - M.r}" y="${H - 6}" text-anchor="end">${xLabels[1]}</text>
      ${lines}
      <line class="chart-cross" x1="0" x2="0" y1="${M.t}" y2="${M.t + PLOT_H}" visibility="hidden"/>
    </svg>`;
}

// Touching, hovering or using the arrow keys on the chart moves a crosshair to
// the nearest x position and reports it, so a readout can show every series there.
export function attachLineChart(svg, onPosition){
  const xMax = Number(svg.getAttribute('data-xmax'));
  const cross = svg.querySelector('.chart-cross');
  let current = xMax;
  const show = x=>{
    current = Math.max(0, Math.min(xMax, x));
    const px = M.l + PLOT_W * current / xMax;
    cross.setAttribute('x1', px); cross.setAttribute('x2', px);
    cross.setAttribute('visibility', 'visible');
    onPosition(current);
  };
  const fromPointer = e=>{
    const rect = svg.getBoundingClientRect();
    const vx = (e.clientX - rect.left) / rect.width * W;
    show(Math.round((vx - M.l) / PLOT_W * xMax));
  };
  svg.addEventListener('pointerdown', fromPointer);
  svg.addEventListener('pointermove', e=>{ if(e.pointerType==='mouse' || e.buttons || e.pressure > 0) fromPointer(e); });
  svg.addEventListener('keydown', e=>{
    if(e.key==='ArrowLeft'){ show(current - 1); e.preventDefault(); }
    if(e.key==='ArrowRight'){ show(current + 1); e.preventDefault(); }
  });
}

// One bar split into parts: [{ value, cls, title }]. Parts without a value are
// left out; the gaps between the parts are the surface showing through.
export function segmentedBarHTML(parts, label){
  const shown = parts.filter(p=>p.value > 0);
  return `
    <div class="segbar" role="img" aria-label="${label}">
      ${shown.map(p=>`<span class="seg ${p.cls}" style="flex-grow:${p.value}" title="${p.title}"></span>`).join('')}
    </div>`;
}

// Win probability of team A against team B as numbers and a two-part bar
export function oddsHTML(pA){
  const a = Math.round(pA*100), b = 100 - a;
  return `
    <div class="odds">
      <div class="odds-numbers"><span>Team A <b>${a} %</b></span><span><b>${b} %</b> Team B</span></div>
      ${segmentedBarHTML([
        { value:a, cls:'teamA', title:`Team A ${a} %` },
        { value:b, cls:'teamB', title:`Team B ${b} %` }
      ], `Siegchance Team A ${a} Prozent, Team B ${b} Prozent`)}
    </div>`;
}
