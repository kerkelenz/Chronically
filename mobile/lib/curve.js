// SVG path builders for the trend charts.

// Monotone cubic interpolation — a direct port of d3-shape's curveMonotoneX.
// Takes an array of { x, y } points (x strictly increasing) and returns an
// SVG path string. Produces the same gentle, non-overshooting curve the web
// charts use via Recharts type="monotone". Kept for comparison; the charts
// now draw with catmullRomPath below.
const f = (v) => v.toFixed(2);
const sign = (x) => (x < 0 ? -1 : 1);

function slope3(pts, i) {
  const x0 = pts[i - 1].x, y0 = pts[i - 1].y;
  const x1 = pts[i].x, y1 = pts[i].y;
  const x2 = pts[i + 1].x, y2 = pts[i + 1].y;
  const h0 = x1 - x0, h1 = x2 - x1;
  const s0 = (y1 - y0) / (h0 || (h1 < 0 ? -0 : 0));
  const s1 = (y2 - y1) / (h1 || (h0 < 0 ? -0 : 0));
  const p = (s0 * h1 + s1 * h0) / (h0 + h1);
  return (sign(s0) + sign(s1)) * Math.min(Math.abs(s0), Math.abs(s1), 0.5 * Math.abs(p)) || 0;
}

export function monotonePath(pts) {
  const n = pts.length;
  if (n === 0) return "";
  if (n === 1) return `M${f(pts[0].x)},${f(pts[0].y)}`;
  if (n === 2) return `M${f(pts[0].x)},${f(pts[0].y)} L${f(pts[1].x)},${f(pts[1].y)}`;

  // tangents at each point
  const t = new Array(n);
  for (let i = 1; i < n - 1; i++) t[i] = slope3(pts, i);
  // endpoints (d3's slope2)
  t[0] = (3 * (pts[1].y - pts[0].y) / (pts[1].x - pts[0].x) - t[1]) / 2;
  t[n - 1] =
    (3 * (pts[n - 1].y - pts[n - 2].y) / (pts[n - 1].x - pts[n - 2].x) - t[n - 2]) / 2;

  let d = `M${f(pts[0].x)},${f(pts[0].y)}`;
  for (let i = 0; i < n - 1; i++) {
    const dx = (pts[i + 1].x - pts[i].x) / 3;
    const c1x = pts[i].x + dx, c1y = pts[i].y + dx * t[i];
    const c2x = pts[i + 1].x - dx, c2y = pts[i + 1].y - dx * t[i + 1];
    d += ` C${f(c1x)},${f(c1y)} ${f(c2x)},${f(c2y)} ${f(pts[i + 1].x)},${f(pts[i + 1].y)}`;
  }
  return d;
}

// Number formatting matching d3-path's default (3 decimals) so a Catmull-Rom
// path built here is byte-comparable to d3-shape's curveCatmullRom output.
const cf = (v) => Number(v.toFixed(3));

// Centripetal Catmull-Rom (alpha = 0.5) — port of d3-shape's curveCatmullRom.
// Soft through local peaks with negligible overshoot. Interpolating: the curve
// passes through every input point.
export function catmullRomPath(pts, alpha = 0.5) {
  const n = pts.length;
  if (n === 0) return "";
  if (n === 1) return `M${cf(pts[0].x)},${cf(pts[0].y)}`;
  if (n === 2) return `M${cf(pts[0].x)},${cf(pts[0].y)}L${cf(pts[1].x)},${cf(pts[1].y)}`;

  let d = `M${cf(pts[0].x)},${cf(pts[0].y)}`;
  for (let i = 0; i < n - 1; i++) {
    const p0 = pts[i - 1] || pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] || p2;

    const d01 = Math.pow(Math.hypot(p1.x - p0.x, p1.y - p0.y), alpha);
    const d12 = Math.pow(Math.hypot(p2.x - p1.x, p2.y - p1.y), alpha);
    const d23 = Math.pow(Math.hypot(p3.x - p2.x, p3.y - p2.y), alpha);

    const d01_2 = d01 * d01;
    const d12_2 = d12 * d12;
    const d23_2 = d23 * d23;

    let c1x = p1.x, c1y = p1.y, c2x = p2.x, c2y = p2.y;
    if (d01 > 1e-12) {
      const a = 2 * d01_2 + 3 * d01 * d12 + d12_2;
      const b = 3 * d01 * (d01 + d12);
      c1x = (a * p1.x - d12_2 * p0.x + d01_2 * p2.x) / b;
      c1y = (a * p1.y - d12_2 * p0.y + d01_2 * p2.y) / b;
    }
    if (d23 > 1e-12) {
      const a = 2 * d23_2 + 3 * d23 * d12 + d12_2;
      const b = 3 * d23 * (d23 + d12);
      c2x = (a * p2.x + d23_2 * p1.x - d12_2 * p3.x) / b;
      c2y = (a * p2.y + d23_2 * p1.y - d12_2 * p3.y) / b;
    }
    d += `C${cf(c1x)},${cf(c1y)},${cf(c2x)},${cf(c2y)},${cf(p2.x)},${cf(p2.y)}`;
  }
  return d;
}
