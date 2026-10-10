// What a doctor report covers: its date range, its sections, and the lines
// that describe the three optional datasets (flares, medication changes,
// as-needed ratings). Shared by the web PDF (generateReport.js) and the phone's
// HTML report (reportData.js + reportHtml.js), so both print the same words
// for the same choices.
//
// No imports: server/lib/reportOptions.test.js reads this file as text and
// evaluates it, the way flares.test.js reads flareHelpers.js.
//
// Kept byte-identical with mobile/theme/reportOptions.js.

/** Every section, in the order the report prints them. */
export const REPORT_SECTIONS = [
  { key: "glance", label: "At a glance" },
  { key: "trend", label: "Trend chart" },
  { key: "averages", label: "Averages" },
  { key: "notable", label: "Notable events" },
  { key: "flares", label: "Flares" },
  { key: "symptoms", label: "Symptom frequency" },
  { key: "patterns", label: "Observed patterns" },
  { key: "medications", label: "Current medications" },
  { key: "medChanges", label: "Medication changes" },
  { key: "adherence", label: "Adherence" },
  { key: "helped", label: "As-needed ratings" },
  { key: "skipReasons", label: "Skip reasons" },
  { key: "appointments", label: "Appointments" },
  { key: "dailyLog", label: "Daily health log" },
  { key: "weather", label: "Weather in daily log" },
  { key: "notes", label: "Your notes" },
  { key: "medLog", label: "Daily medication log" },
];
export const SECTION_KEYS = REPORT_SECTIONS.map((s) => s.key);

export const RANGE_PRESETS = [
  { key: "last30", days: 30, label: "Last 30 days" },
  { key: "last90", days: 90, label: "Last 90 days" },
];
export const DEFAULT_PRESET = "last30";

// GET /api/checkins returns at most 1000 rows, newest first. A year is the
// longest range that stays well inside that for someone checking in daily,
// and a year of daily rows is already a dozen PDF pages.
export const MAX_RANGE_DAYS = 365;
export const CHECKIN_FETCH_CAP = 1000;

const DAY_MS = 86400000;
const pad = (n) => String(n).padStart(2, "0");
const plural = (n, word) => `${n} ${n === 1 ? word : `${word}s`}`;

// Day arithmetic on Date.UTC so a daylight-saving change can't add or drop a
// day, as in flareHelpers.js.
function utcOf(ymd) {
  const [y, m, d] = String(ymd).split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}
function ymdOfUtc(ms) {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}
// Local noon is the safe hour to format a calendar date from.
function atLocalNoon(ymd) {
  const [y, m, d] = String(ymd).split("-").map(Number);
  return new Date(y, m - 1, d, 12, 0, 0, 0);
}
// "Mar 4", with the year only when it isn't `today`'s year
function shortDate(ymd, today) {
  const thisYear = isYmd(today) ? Number(today.slice(0, 4)) : new Date().getFullYear();
  const opts = { month: "short", day: "numeric" };
  if (Number(String(ymd).slice(0, 4)) !== thisYear) opts.year = "numeric";
  return atLocalNoon(ymd).toLocaleDateString("en-US", opts);
}

/** A real calendar date written YYYY-MM-DD. */
export function isYmd(s) {
  if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  return ymdOfUtc(utcOf(s)) === s;
}

export function addDays(ymd, n) {
  return ymdOfUtc(utcOf(ymd) + n * DAY_MS);
}

/** Inclusive: the same day twice is 1 day. */
export function dayCount(from, to) {
  return Math.round((utcOf(to) - utcOf(from)) / DAY_MS) + 1;
}

export function eachDay(from, to) {
  const out = [];
  for (let ms = utcOf(from), end = utcOf(to); ms <= end; ms += DAY_MS) out.push(ymdOfUtc(ms));
  return out;
}

/**
 * Turns whatever a caller passed into a range the report can print. Never
 * throws: a missing date falls back to the default range (today − 30 … today),
 * `to` is clamped to today, `from` to at most MAX_RANGE_DAYS before `to`, and a
 * `from` after `to` becomes `to`.
 */
export function resolveReportOptions(options, todayYmd) {
  const o = options || {};
  const today = todayYmd;
  let to = isYmd(o.to) ? o.to : today;
  let from = isYmd(o.from) ? o.from : addDays(today, -30);
  if (to > today) to = today;
  const earliest = addDays(to, -MAX_RANGE_DAYS);
  if (from < earliest) from = earliest;
  if (from > to) from = to;

  // a custom pick of exactly a preset's dates reads as that preset
  const preset = to === today
    ? RANGE_PRESETS.find((p) => from === addDays(today, -p.days))
    : null;

  const wanted = o.sections == null ? [] : [...o.sections].filter((k) => SECTION_KEYS.includes(k));
  const sections = new Set(wanted.length > 0 ? wanted : SECTION_KEYS);

  // jsPDF's built-in font is WinAnsi: one U+202F (which newer Intl puts before
  // AM/PM) garbles the whole line it sits on
  const heading = typeof o.heading === "string"
    ? o.heading.replace(/\u202f/g, " ").trim().slice(0, 120).trim()
    : "";

  return {
    from, to,
    days: dayCount(from, to),
    presetDays: preset ? preset.days : null,
    sections,
    heading: heading || null,
  };
}

/** Section titles: numbered for a preset, plain for any other range. */
export function rangeTitles(range) {
  const n = range.presetDays;
  if (n) {
    return {
      trend: `${n}-Day Trend`,
      averages: `${n}-Day Averages`,
      adherence: `Medication Adherence (${n} Days)`,
      recentAppts: `Recent Appointments (Last ${n} Days)`,
      glanceDays: n,
    };
  }
  return {
    trend: "Trend",
    averages: "Averages",
    adherence: "Medication Adherence",
    recentAppts: "Appointments in This Period",
    glanceDays: range.days,
  };
}

/** "Mar 4 – Oct 9, 2026 · 220 days" — the caption under the date choices. */
export function describeRange(range) {
  const a = atLocalNoon(range.from);
  const b = atLocalNoon(range.to);
  const full = { month: "short", day: "numeric", year: "numeric" };
  const span = range.from === range.to
    ? b.toLocaleDateString("en-US", full)
    : `${a.toLocaleDateString("en-US", a.getFullYear() === b.getFullYear() ? { month: "short", day: "numeric" } : full)} – ${b.toLocaleDateString("en-US", full)}`;
  return `${span} · ${plural(range.days, "day")}`;
}

/** Every how many points the trend chart labels a date: 31 points → 5. */
export function chartLabelStep(n) {
  return Math.max(1, Math.ceil((n - 1) / 6));
}

// ── Flares ──────────────────────────────────────────────────────────────────

/** Flares that touch the range at all, ongoing included, oldest first. */
export function flaresInRange(flares, from, to) {
  return (Array.isArray(flares) ? flares : [])
    .filter((f) => f && isYmd(f.startDate) && f.startDate <= to && (!f.endDate || f.endDate >= from))
    .sort((a, b) => a.startDate.localeCompare(b.startDate));
}

// the whole flare, not the part inside the range, as formatFlareRange counts it
const flareLength = (f) => dayCount(f.startDate, f.endDate);
const meanLength = (list) =>
  Math.max(1, Math.round(list.reduce((s, f) => s + flareLength(f), 0) / list.length));

/** "3 flares in this period · about 4 days each", and its variants. */
export function flareSummaryLine(list) {
  const n = list.length;
  if (n === 0) return "";
  const head = `${plural(n, "flare")} in this period`;
  const ended = list.filter((f) => f.endDate);
  if (n === 1) return `${head} · ${ended.length ? plural(flareLength(ended[0]), "day") : "ongoing"}`;
  if (ended.length === n) return `${head} · about ${plural(meanLength(ended), "day")} each`;
  if (ended.length === 0) return `${head} · ongoing`;
  if (ended.length === 1) return `${head} · the 1 that ended lasted ${plural(flareLength(ended[0]), "day")}`;
  return `${head} · the ${ended.length} that ended lasted about ${plural(meanLength(ended), "day")} each`;
}

/** "Mar 2 – Mar 6 · 5 days", "Mar 2 · 1 day", "Since Mar 2 (ongoing)". */
export function flareReportLine(flare, today) {
  const start = shortDate(flare.startDate, today);
  if (!flare.endDate) return `Since ${start} (ongoing)`;
  const days = flareLength(flare);
  if (days <= 1) return `${start} · 1 day`;
  return `${start} – ${shortDate(flare.endDate, today)} · ${plural(days, "day")}`;
}

// ── Medication changes ──────────────────────────────────────────────────────

/**
 * History entries dated (on this device's calendar) inside the range, for the
 * medications the patient still has, oldest first.
 */
export function medChangesInRange(medHistory, medications, from, to) {
  if (!medHistory) return [];
  const names = new Map((medications || []).map((m) => [String(m.id), m.name]));
  const out = [];
  Object.entries(medHistory).forEach(([id, entries]) => {
    if (!names.has(String(id))) return;
    (Array.isArray(entries) ? entries : []).forEach((entry) => {
      const at = new Date(entry && entry.changedAt);
      if (Number.isNaN(at.getTime())) return;
      const day = at.toLocaleDateString("en-CA");
      if (day < from || day > to) return;
      out.push({ medName: names.get(String(id)), changedAt: entry.changedAt, entry });
    });
  });
  return out.sort((a, b) =>
    new Date(a.changedAt) - new Date(b.changedAt) || a.medName.localeCompare(b.medName));
}

// ── As-needed ratings ───────────────────────────────────────────────────────

/**
 * One row per as-needed medication taken in the range. `isAsNeeded` comes from
 * the caller (resolvePattern lives in the medications pair, which this file
 * can't import).
 */
export function helpedRows(medications, logs, from, to, isAsNeeded) {
  return (medications || [])
    .filter((m) => isAsNeeded(m))
    .map((med) => {
      const taken = (logs || []).filter((l) =>
        l.medicationId === med.id && l.status === "taken" && l.date >= from && l.date <= to);
      if (taken.length === 0) return null;
      const count = (v) => taken.filter((l) => l.helped === v).length;
      return {
        name: med.name,
        taken: taken.length,
        counts: {
          rated: taken.filter((l) => l.helped != null).length,
          yes: count("yes"),
          a_little: count("a_little"),
          no: count("no"),
        },
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** "Rated 6 times: helped 4 · a little 1 · not really 1". Counts, never a rate. */
export function helpedReportLine(counts) {
  if (!counts || !counts.rated) return "Not rated";
  const parts = [
    counts.yes ? `helped ${counts.yes}` : null,
    counts.a_little ? `a little ${counts.a_little}` : null,
    counts.no ? `not really ${counts.no}` : null,
  ].filter(Boolean);
  return `Rated ${plural(counts.rated, "time")}: ${parts.join(" · ")}`;
}

// ── Fetch limit ─────────────────────────────────────────────────────────────

/**
 * Said only when the check-in fetch hit its cap before reaching `from`. The
 * oldest day returned may itself be cut short, so the warning starts after it.
 */
export function truncationNote(checkIns, from, today) {
  if (!Array.isArray(checkIns) || checkIns.length < CHECKIN_FETCH_CAP) return "";
  const oldest = checkIns.reduce((min, c) => (c.date < min ? c.date : min), checkIns[0].date);
  if (!(oldest > from)) return "";
  return `Only the most recent ${CHECKIN_FETCH_CAP.toLocaleString("en-US")} check-ins could be included, ` +
    `so days before ${shortDate(addDays(oldest, 1), today)} may be incomplete.`;
}

// ── Remembered choices ──────────────────────────────────────────────────────
// Each device remembers a preset and the sections (reportPrefs.js stores them).
// Dates picked for "Since a date" or "Custom" are never remembered: a saved
// fixed date goes stale.

/** Whatever was stored, made safe: unknown keys and presets dropped, nothing on → defaults. */
export function normalizeReportPrefs(raw) {
  const r = raw && typeof raw === "object" ? raw : {};
  const preset = RANGE_PRESETS.some((p) => p.key === r.preset) ? r.preset : DEFAULT_PRESET;
  const kept = Array.isArray(r.sections) ? SECTION_KEYS.filter((k) => r.sections.includes(k)) : [];
  return { preset, sections: kept.length > 0 ? kept : [...SECTION_KEYS] };
}

export function isDefaultPrefs(prefs) {
  const p = normalizeReportPrefs(prefs);
  return p.preset === DEFAULT_PRESET && p.sections.length === SECTION_KEYS.length;
}

/** The muted line under the export button: "" for the default, else "Last 90 days · 2 sections off". */
export function prefsSummary(prefs) {
  const p = normalizeReportPrefs(prefs);
  if (isDefaultPrefs(p)) return "";
  const label = RANGE_PRESETS.find((x) => x.key === p.preset).label;
  const off = SECTION_KEYS.length - p.sections.length;
  return off > 0 ? `${label} · ${plural(off, "section")} off` : label;
}
