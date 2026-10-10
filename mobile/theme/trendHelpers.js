// Trends: the range, where things sit on the x-axis, and the annotations drawn
// over the metrics chart (flares, medication changes, appointments).
//
// These depend on the device's own calendar date and on how wide the chart is
// on screen, which the server can't know — so they live on the clients. The
// numbers (daily means, period comparison) come from GET /api/trends/summary.
//
// No imports: the two platforms reach their helpers by different paths, which
// would break byte-identity. Callers pass describeChange and formatFlareRange
// in. server/lib/trends.test.js reads this file as text and evaluates it.
//
// Kept byte-identical with mobile/theme/trendHelpers.js.

export const TREND_RANGES = [
  { days: 7, label: "7 days" },
  { days: 30, label: "30 days" },
  { days: 90, label: "90 days" },
  { days: 365, label: "1 year" },
];
export const DEFAULT_RANGE_DAYS = 30;

// The comparison rows' order — the server's METRICS order (lib/trends.js)
export const COMPARE_METRICS = ["energy", "mood", "pain", "anxiety", "appetite", "sleep"];

const DAY_MS = 86400000;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const pad = (n) => String(n).padStart(2, "0");
const plural = (n, word) => `${n} ${n === 1 ? word : `${word}s`}`;

// Date.UTC arithmetic, so a daylight-saving change can't add or drop a day
function utcOf(ymd) {
  const [y, m, d] = String(ymd).split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}
function ymdOf(ms) {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}
// "Oct 4", split from the string itself — never new Date(ymd), which reads a
// bare date as UTC midnight and can land on the previous day
function monDay(ymd) {
  const [, m, d] = String(ymd).split("-").map(Number);
  return `${MONTHS[m - 1]} ${d}`;
}

/** N calendar days ending today, inclusive: 7 days on Oct 9 is Oct 3 – Oct 9. */
export function rangeWindow(todayYmd, days) {
  return { startDate: ymdOf(utcOf(todayYmd) - (days - 1) * DAY_MS), endDate: todayYmd, days };
}

/** Day 0 is the window's first day. */
export function dayIndex(startYmd, ymd) {
  return Math.round((utcOf(ymd) - utcOf(startYmd)) / DAY_MS);
}

/** The device-local calendar date of an instant — the rule describeChangeDate uses. */
export function localYmdOf(timestamp) {
  return new Date(timestamp).toLocaleDateString("en-CA");
}

const windowDays = (win) => dayIndex(win.startDate, win.endDate) + 1;

/** At most five calendar dates, evenly spread, first and last included. */
export function axisTicks(win, count = 5) {
  const days = windowDays(win);
  const n = Math.min(count, days);
  const out = [];
  for (let i = 0; i < n; i++) {
    const idx = n === 1 ? 0 : Math.round((i * (days - 1)) / (n - 1));
    if (out.length && out[out.length - 1].idx === idx) continue;
    out.push({ idx, label: monDay(ymdOf(utcOf(win.startDate) + idx * DAY_MS)) });
  }
  return out;
}

/**
 * Flares become bands, medication changes and appointments become markers,
 * all in day indexes of the window. Anything outside it is dropped; a flare
 * that began earlier is clipped to the left edge, and an ongoing one runs to
 * today. Cancelled appointments and appointment notes never appear.
 */
export function buildAnnotations({ window: win, flares, changes, appointments, describeChange, formatFlareRange, todayYmd }) {
  const days = windowDays(win);
  const inWindow = (idx) => idx >= 0 && idx <= days - 1;

  const bands = [];
  (Array.isArray(flares) ? flares : []).forEach((f) => {
    if (!f || !f.startDate) return;
    const s = dayIndex(win.startDate, f.startDate);
    const e = f.endDate ? dayIndex(win.startDate, f.endDate) : days - 1;
    if (e < 0 || s > days - 1) return;
    bands.push({
      startIdx: Math.max(0, s),
      endIdx: Math.min(days - 1, e),
      ongoing: !f.endDate,
      startDate: f.startDate,
      label: formatFlareRange(f, todayYmd),
    });
  });

  const markers = [];
  (Array.isArray(changes) ? changes : []).forEach((c) => {
    if (!c || !c.changedAt) return;
    const date = localYmdOf(c.changedAt);
    const dayIdx = dayIndex(win.startDate, date);
    if (!inWindow(dayIdx)) return;
    markers.push({
      dayIdx, date, type: "med",
      text: `${describeChange(c).join(", ")} · ${c.medicationName} · ${monDay(date)}`,
    });
  });
  (Array.isArray(appointments) ? appointments : []).forEach((a) => {
    if (!a || (a.status !== "completed" && a.status !== "upcoming")) return;
    const date = localYmdOf(a.date);
    const dayIdx = dayIndex(win.startDate, date);
    if (!inWindow(dayIdx)) return;
    markers.push({
      dayIdx, date, type: "appt",
      text: `Appointment · ${a.doctorName}${a.specialty ? ` (${a.specialty})` : ""} · ${monDay(date)}`,
    });
  });
  // by day, and within a day medication changes before appointments
  markers.sort((a, b) => a.dayIdx - b.dayIdx || (a.type === b.type ? 0 : a.type === "med" ? -1 : 1));

  return { bands, markers };
}

/**
 * Markers on the same day always share a glyph; so do neighbours that would
 * sit closer than `minGapPx` on screen. A cluster sits on its first item's day.
 */
export function clusterMarkers(markers, { days, plotWidth, minGapPx }) {
  const pxPerDay = plotWidth / Math.max(1, days - 1);
  const sorted = [...(markers || [])].sort((a, b) =>
    a.dayIdx - b.dayIdx || (a.type === b.type ? 0 : a.type === "med" ? -1 : 1));
  const clusters = [];
  sorted.forEach((m) => {
    const last = clusters[clusters.length - 1];
    if (last && (m.dayIdx - last.dayIdx) * pxPerDay < minGapPx) last.items.push(m);
    else clusters.push({ dayIdx: m.dayIdx, date: m.date, items: [m] });
  });
  return clusters;
}

const rangeName = (days) => (days === 365 ? "year" : `${days} days`);

/** One sentence for a screen reader: what the chart's annotations say. */
export function annotationSummary({ bands, markers, days }) {
  const head = `Last ${rangeName(days)}.`;
  const meds = (markers || []).filter((m) => m.type === "med").length;
  const appts = (markers || []).filter((m) => m.type === "appt").length;
  const parts = [];
  if (bands && bands.length) parts.push(`${plural(bands.length, "flare")}: ${bands.map((b) => b.label).join("; ")}.`);
  if (meds) parts.push(`${plural(meds, "medication change")}.`);
  if (appts) parts.push(`${plural(appts, "appointment")}.`);
  if (parts.length === 0) parts.push("No flares, medication changes or appointments in this range.");
  return `${head} ${parts.join(" ")}`;
}

// ── Period comparison copy ──────────────────────────────────────────────────
// The numbers arrive from the server already averaged and rounded; these only
// put words around them. No arrows, no better or worse.

const oneDp = (v) => (typeof v === "number" ? v.toFixed(1) : "—");

/** "Energy averaged 3.7 these 7 days vs 2.8 the 7 days before (6 vs 5 days logged)" */
export function formatComparison(metricLabel, row, days) {
  const span = days === 365 ? ["this year", "the year before"] : [`these ${days} days`, `the ${days} days before`];
  return `${metricLabel} averaged ${oneDp(row.current.mean)} ${span[0]} vs ${oneDp(row.previous.mean)} ${span[1]} ` +
    `(${row.current.days} vs ${row.previous.days} days logged)`;
}

export function comparisonTitle(days) {
  return days === 365 ? "Compared with the year before" : `Compared with the ${days} days before`;
}

export const COMPARISON_CAPTION = "Averages on the 1–5 scale, where 5 is best for every metric.";
export const COMPARISON_NONE = "Not enough days to compare yet. Each period needs at least 5 days with check-ins.";

/** "Not enough days to compare yet for anxiety and sleep." — one line for every metric left out. */
export function comparisonFootnote(names) {
  const list = names.length <= 2
    ? names.join(" and ")
    : `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;
  return `Not enough days to compare yet for ${list}.`;
}

/** The empty range: say what happened and what to try, without apologising. */
export function emptyRangeText(days) {
  return days === 365
    ? "No check-ins in the last year."
    : `No check-ins in the last ${days} days. Try a longer range.`;
}
