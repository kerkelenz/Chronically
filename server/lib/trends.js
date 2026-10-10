// Trends: daily means and "these N days vs the N before", per metric.
//
// Pure — no database. The controller hands it check-in rows; everything that
// decides what a number means lives here and is tested. It runs on the server
// rather than on each client because a one-year comparison reads two years of
// check-ins, which is past the 1000-row cap of GET /api/checkins and a lot to
// ship to a phone — and because one implementation gives web and mobile the
// same numbers.

// Each period needs at least this many logged days before it is compared.
// Must match MIN_BUCKET_DAYS in insights.js: the same honesty floor for the
// same kind of claim.
const MIN_COMPARE_DAYS = 5;

const METRICS = ["energy", "mood", "pain", "anxiety", "appetite", "sleep"];
const COLUMNS = {
  energy: "energyLevel",
  mood: "moodLevel",
  pain: "painLevel",
  anxiety: "anxietyLevel",
  appetite: "appetiteLevel",
  sleep: "sleepLevel",
};

const DAY_MS = 86400000;
const pad = (n) => String(n).padStart(2, "0");
// Date.UTC arithmetic, as flareHelpers' utcOf does, so a daylight-saving
// change can never add or drop a day
const utcOf = (ymd) => {
  const [y, m, d] = String(ymd).split("-").map(Number);
  return Date.UTC(y, m - 1, d);
};
const ymdOf = (ms) => {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
};
const addDays = (ymd, n) => ymdOf(utcOf(ymd) + n * DAY_MS);
const dayCount = (from, to) => Math.round((utcOf(to) - utcOf(from)) / DAY_MS) + 1;

function isYmd(s) {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && ymdOf(utcOf(s)) === s;
}

/** The same number of days, ending the day before `startDate`. */
function previousWindow(startDate, endDate) {
  const n = dayCount(startDate, endDate);
  return { prevStartDate: addDays(startDate, -n), prevEndDate: addDays(startDate, -1) };
}

// A reading is a 1–5 level. Null means not asked or skipped, and a stray 0 is
// treated the same way: neither is ever averaged in.
const reading = (v) => (typeof v === "number" && v > 0 ? v : null);

/**
 * One row per logged date in `[fromYmd, toYmd]`, ascending: each metric is the
 * mean of that day's readings, or null. Unrounded. A day logged twice counts
 * once, as in insights.
 */
function dailyMeans(checkIns, fromYmd, toYmd) {
  const byDate = new Map();
  for (const c of checkIns || []) {
    const date = typeof c.date === "string" ? c.date.slice(0, 10) : null;
    if (!date || date < fromYmd || date > toYmd) continue;
    if (!byDate.has(date)) byDate.set(date, []);
    byDate.get(date).push(c);
  }
  return [...byDate.keys()].sort().map((date) => {
    const rows = byDate.get(date);
    const out = { date };
    for (const m of METRICS) {
      const vals = rows.map((r) => reading(r[COLUMNS[m]])).filter((v) => v !== null);
      out[m] = vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : null;
    }
    return out;
  });
}

const round1 = (x) => Math.round(x * 10) / 10;

function periodStat(days, metric) {
  const vals = days.map((d) => d[metric]).filter((v) => v !== null);
  return {
    mean: vals.length ? round1(vals.reduce((s, v) => s + v, 0) / vals.length) : null,
    days: vals.length,
  };
}

/**
 * Per metric: the average of daily means in the window and in the same number
 * of days before it, with how many days each rests on. `comparable` only when
 * both periods clear MIN_COMPARE_DAYS.
 */
function comparePeriods(checkIns, { startDate, endDate }) {
  const { prevStartDate, prevEndDate } = previousWindow(startDate, endDate);
  const current = dailyMeans(checkIns, startDate, endDate);
  const previous = dailyMeans(checkIns, prevStartDate, prevEndDate);
  const metrics = {};
  for (const m of METRICS) {
    const cur = periodStat(current, m);
    const prev = periodStat(previous, m);
    metrics[m] = {
      current: cur,
      previous: prev,
      comparable: cur.days >= MIN_COMPARE_DAYS && prev.days >= MIN_COMPARE_DAYS,
    };
  }
  return { window: { startDate, endDate, prevStartDate, prevEndDate }, metrics };
}

/** dailyMeans for the response: the same rows, each value to one decimal. */
function roundedDays(rows) {
  return rows.map((r) => {
    const out = { date: r.date };
    for (const m of METRICS) out[m] = r[m] === null ? null : round1(r[m]);
    return out;
  });
}

module.exports = {
  MIN_COMPARE_DAYS,
  METRICS,
  COLUMNS,
  isYmd,
  dayCount,
  previousWindow,
  dailyMeans,
  comparePeriods,
  roundedDays,
};
