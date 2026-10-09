export const TYPE_ICONS = {
  pill:        "💊",
  injection:   "💉",
  infusion:    "🩺",
  supplement:  "🌿",
  sublingual:  "🔘",
};

export const FREQUENCY_LABELS = {
  daily:              "Daily",
  twice_daily:        "Twice daily",
  three_times_daily:  "Three times daily",
  four_times_daily:   "Four times daily",
  every_other_day:    "Every other day",
  weekly:             "Weekly",
  biweekly:           "Biweekly",
  monthly:            "Monthly",
  every_x_weeks:      "Every X weeks",
  as_needed:          "As needed",
};

export const FREQUENCY_TIME_COUNTS = {
  daily:              1,
  twice_daily:        2,
  three_times_daily:  3,
  four_times_daily:   4,
  every_other_day:    1,
  weekly:             1,
  biweekly:           1,
  monthly:            1,
  every_x_weeks:      1,
  as_needed:          0,
};

export function formatTime(time) {
  if (!time) return "";
  const [h, m] = time.split(":");
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 || 12;
  return `${hour12}:${m} ${ampm}`;
}

// ── Canonical schedule patterns ─────────────────────────────────────────────
// New meds save frequency ∈ daily | specific_days | every_n_days | monthly | as_needed.
// Legacy enums are resolved here at read time — no data migration, old rows work forever.

function localDay(dateish) {
  const d = new Date(dateish);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
function parseYmd(s) {
  const [y, m, dd] = s.split("-").map(Number);
  return new Date(y, m - 1, dd);
}

/** Resolve any medication (new or legacy) to a canonical pattern object. */
export function resolvePattern(med) {
  const { frequency, frequencyWeeks, daysOfWeek, startDate, intervalDays, createdAt } = med;
  const anchor = startDate ? parseYmd(startDate) : localDay(createdAt);
  switch (frequency) {
    case "daily":
    case "twice_daily":
    case "three_times_daily":
    case "four_times_daily":
      return { kind: "daily" };
    case "specific_days":
      return { kind: "specific_days", days: Array.isArray(daysOfWeek) ? daysOfWeek : [] };
    case "weekly": // legacy: the weekday it was anchored to
      return { kind: "specific_days", days: [anchor.getDay()] };
    case "every_n_days":
      return { kind: "every_n_days", n: intervalDays || 1, anchor };
    case "every_other_day":
      return { kind: "every_n_days", n: 2, anchor };
    case "biweekly":
      return { kind: "every_n_days", n: 14, anchor };
    case "every_x_weeks":
      return { kind: "every_n_days", n: 7 * (frequencyWeeks || 1), anchor };
    case "monthly":
      return { kind: "monthly", dayOfMonth: anchor.getDate() };
    case "as_needed":
      return { kind: "as_needed" };
    default:
      return { kind: "none" };
  }
}

/** Is this medication due on the given local YYYY-MM-DD date? (PRN → false: it has no due days.) */
export function isMedicationDueOn(medication, dateStr) {
  const p = resolvePattern(medication);
  const day = parseYmd(dateStr);
  switch (p.kind) {
    case "daily":
      return true;
    case "specific_days":
      return p.days.includes(day.getDay());
    case "every_n_days": {
      const diff = Math.round((day - p.anchor) / (1000 * 60 * 60 * 24));
      return diff >= 0 && diff % p.n === 0;
    }
    case "monthly":
      return day.getDate() === p.dayOfMonth;
    default:
      return false;
  }
}

// Back-compat alias — current UI code calls this; Prompts 2–3 migrate call sites.
export function isMedicationDueToday(medication, today) {
  return isMedicationDueOn(medication, today);
}

/** Expected dose slots for a day: [] when not due; scheduled times (or [null] = anytime) when due. */
export function expectedDosesOn(medication, dateStr) {
  if (!isMedicationDueOn(medication, dateStr)) return [];
  const times = Array.isArray(medication.scheduledTimes) ? medication.scheduledTimes.filter(Boolean) : [];
  return times.length ? times : [null];
}

// ── Human-readable schedule sentence ────────────────────────────────────────
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAY_FULL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function fmtTime(t) {
  if (!t) return null;
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const hh = h % 12 === 0 ? 12 : h % 12;
  return `${hh}:${String(m).padStart(2, "0")} ${ampm}`;
}
function fmtTimes(med) {
  const ts = (med.scheduledTimes || []).filter(Boolean).map(fmtTime);
  if (!ts.length) return null;
  if (ts.length <= 2) return ts.join(" & ");
  return ts.join(", ");
}
function ordinal(n) {
  const s = ["th", "st", "nd", "rd"], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export function describeSchedule(med) {
  const p = resolvePattern(med);
  const times = fmtTimes(med);
  const withTimes = (base) => (times ? `${base} · ${times}` : base);
  switch (p.kind) {
    case "daily": {
      const n = (med.scheduledTimes || []).filter(Boolean).length;
      const word = n <= 1 ? "Once daily" : n === 2 ? "Twice daily" : `${n} times daily`;
      return withTimes(word);
    }
    case "specific_days": {
      if (p.days.length >= 7) return withTimes("Every day");
      if (p.days.length === 1) return withTimes(`Every ${DAY_FULL[p.days[0]]}`);
      const sorted = [...p.days].sort((a, b) => a - b);
      return withTimes(sorted.map((d) => DAY_NAMES[d]).join(", "));
    }
    case "every_n_days": {
      const from = `${p.anchor.toLocaleString("en-US", { month: "short" })} ${p.anchor.getDate()}`;
      return withTimes(p.n === 1 ? "Every day" : `Every ${p.n} days · from ${from}`);
    }
    case "monthly":
      return withTimes(`Monthly on the ${ordinal(p.dayOfMonth)}`);
    case "as_needed":
      return "As needed";
    default:
      return "";
  }
}

// ── Adherence math (computed-missed) ────────────────────────────────────────
// missed = an expected past dose with no log — computed at read time, never
// written to the database. Today's unlogged doses are pending (neutral): they
// count in neither the numerator nor the denominator.

export function adherenceStats(medications, logs, fromYmd, toYmd, todayYmd) {
  const end = toYmd < todayYmd ? toYmd : todayYmd;
  const perMedMap = new Map();
  const perDay = [];
  const weekday = Array.from({ length: 7 }, () => ({ expected: 0, taken: 0 }));
  const totals = { expected: 0, taken: 0, skipped: 0, missed: 0 };
  let prnTaken = 0;

  const meds = medications.map((m) => ({
    med: m,
    prn: resolvePattern(m).kind === "as_needed",
    // created-date clamp: a med added yesterday must not show phantom missed
    // days from before it existed
    createdYmd: localDay(m.createdAt).toLocaleDateString("en-CA"),
  }));

  for (const { med, prn } of meds) {
    if (prn) continue;
    perMedMap.set(med.id, { id: med.id, name: med.name, expected: 0, taken: 0, skipped: 0, missed: 0 });
  }

  // PRN doses are reported separately — they have no denominator, so they
  // never enter the adherence percentage
  for (const log of logs) {
    if (log.date < fromYmd || log.date > end) continue;
    const entry = meds.find((x) => x.med.id === log.medicationId);
    if (entry?.prn && log.status === "taken") prnTaken++;
  }

  for (let d = parseYmd(fromYmd); ; d.setDate(d.getDate() + 1)) {
    const day = d.toLocaleDateString("en-CA");
    if (day > end) break;
    const dayRow = { date: day, expected: 0, taken: 0, skipped: 0, missed: 0 };
    const dow = d.getDay();

    for (const { med, prn, createdYmd } of meds) {
      if (prn) continue;
      if (day < createdYmd) continue;
      for (const slot of expectedDosesOn(med, day)) {
        const slotLogs = logs.filter(
          (l) => l.medicationId === med.id && l.date === day && l.scheduledTime === slot
        );
        // first taken wins over skipped; duplicate logs count once. legacy
        // status:"missed" rows have neither, so the slot computes as missed
        // exactly once — no double counting
        let status;
        if (slotLogs.some((l) => l.status === "taken")) status = "taken";
        else if (slotLogs.some((l) => l.status === "skipped")) status = "skipped";
        else if (day < todayYmd) status = "missed";
        else continue; // pending — today's unlogged doses stay neutral

        const m = perMedMap.get(med.id);
        m.expected++;
        m[status]++;
        dayRow.expected++;
        dayRow[status]++;
        totals.expected++;
        totals[status]++;
        weekday[dow].expected++;
        if (status === "taken") weekday[dow].taken++;
      }
    }
    perDay.push(dayRow);
  }

  const pctOf = (taken, expected) => (expected ? Math.round((taken / expected) * 100) : null);
  const perMed = [...perMedMap.values()].map((m) => ({ ...m, pct: pctOf(m.taken, m.expected) }));
  const perWeekday = weekday.map((w, i) => ({
    weekday: i,
    expected: w.expected,
    taken: w.taken,
    pct: pctOf(w.taken, w.expected),
  }));

  return {
    perMed,
    totals: { ...totals, pct: pctOf(totals.taken, totals.expected) },
    perDay,
    perWeekday,
    prnTaken,
  };
}

/** Next due date on/after fromYmd within `horizon` days, or null (PRN/none). */
export function nextDueDate(medication, fromYmd, horizon = 31) {
  const p = resolvePattern(medication);
  if (p.kind === "as_needed" || p.kind === "none") return null;
  const start = parseYmd(fromYmd);
  for (let i = 0; i < horizon; i++) {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    const ymdStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    if (isMedicationDueOn(medication, ymdStr)) return ymdStr;
  }
  return null;
}

export const SKIP_REASONS = [
  "Forgot",
  "Felt sick / threw up",
  "Side effects",
  "Ran out",
  "Doctor advised",
  "Already took it",
  "Too painful to take",
];

// ── Supply and rating copy ──────────────────────────────────────────────────
// The maths lives on the server (server/lib/medStats.js): the clients only ever
// fetch seven days of logs, so they could not compute remaining supply or the
// rating counts even if they wanted to. These are formatters only, kept here so
// both platforms read identically word for word.

/** "1 day" / "5 days" — the app's count-agrees-with-its-noun rule. */
export function pluralDays(n) {
  return `${n} ${n === 1 ? "day" : "days"}`;
}

/**
 * The muted line under a medication's schedule. Returns "" when there is
 * nothing to say, so a caller can render nothing rather than an empty row.
 *
 * Never alarming: "Running low" is a fact about a number the user gave us, and
 * a recount is an invitation, not a warning.
 */
export function supplyLine(supply, isPrn) {
  if (!supply) return "";
  if (supply.recount) return "Your count may need updating";
  if (isPrn || supply.daysLeft === null) return `${supply.remaining} left`;
  const base = `${supply.remaining} left · about ${pluralDays(supply.daysLeft)}`;
  return supply.low ? `Running low · ${base}` : base;
}

/**
 * The user's own ratings, played back as counts. Deliberately never a verdict,
 * a percentage, or the word "works" — it reports what they noted, nothing more.
 */
export function helpedLine(helped) {
  if (!helped || !helped.rated) return "";
  const parts = [];
  if (helped.yes) parts.push(`helped ${helped.yes}`);
  if (helped.a_little) parts.push(`a little ${helped.a_little}`);
  if (helped.no) parts.push(`not really ${helped.no}`);
  const doses = `${helped.rated} ${helped.rated === 1 ? "dose" : "doses"}`;
  return `Last 90 days: you rated ${doses} — ${parts.join(" · ")}`;
}

/** The three rating choices, in the order they are offered. */
export const HELPED_CHOICES = [
  { value: "yes", label: "Yes" },
  { value: "a_little", label: "A little" },
  { value: "no", label: "Not really" },
];

// ── Dose-change history copy ────────────────────────────────────────────────
// What changed, in the words the app uses elsewhere. The server decides whether
// something changed (server/lib/medHistory.js compares the canonical schedule,
// so a legacy rewrite is not a change); this only phrases it.

// DAY_NAMES is already declared above, for describeSchedule.

const FORM_LABELS = {
  pill: "Pill", injection: "Injection", infusion: "Infusion",
  supplement: "Supplement", sublingual: "Sublingual", topical: "Topical",
  patch: "Patch", gummy: "Gummy", drops: "Drops",
};

const SCHEDULE_LABELS = {
  daily: "Every day",
  specific_days: "Specific days",
  every_n_days: "Every N days",
  monthly: "Monthly",
  as_needed: "As needed",
};

// A date at local noon, so formatting can't slip to the previous day.
function ymdToLabel(ymd) {
  if (!ymd) return "none";
  const [y, m, d] = String(ymd).split("-").map(Number);
  const date = new Date(y, m - 1, d, 12, 0, 0, 0);
  const opts = { month: "short", day: "numeric" };
  if (date.getFullYear() !== new Date().getFullYear()) opts.year = "numeric";
  return date.toLocaleDateString("en-US", opts);
}

/** One field's value, phrased. Null always reads "none" rather than blank. */
export function describeValue(field, value) {
  if (value === null || value === undefined) return "none";
  switch (field) {
    case "type": return FORM_LABELS[value] || String(value);
    case "frequency": return SCHEDULE_LABELS[value] || String(value);
    case "daysOfWeek":
      return Array.isArray(value) && value.length
        ? value.map((d) => DAY_NAMES[d] ?? d).join(", ")
        : "none";
    case "intervalDays": return `every ${value} ${value === 1 ? "day" : "days"}`;
    case "startDate": return ymdToLabel(value);
    case "scheduledTimes":
      return Array.isArray(value) && value.length
        ? value.map(formatTime).join(" & ")
        : "none";
    default: return String(value);
  }
}

const FIELD_LABELS = {
  type: "Form",
  dosage: "Dosage",
  frequency: "Schedule",
  daysOfWeek: "Days",
  startDate: "Starting",
  scheduledTimes: "Times",
};

/**
 * The lines for one history entry. The UI calls deactivation pause, because
 * that is the word on the button.
 */
export function describeChange(entry) {
  if (!entry) return [];
  if (entry.kind === "deactivated") return ["Paused"];
  if (entry.kind === "reactivated") return ["Resumed"];

  if (entry.kind === "created") {
    const changes = Array.isArray(entry.changes) ? entry.changes : [];
    // a derived entry carries no values: we don't know what they were
    if (changes.length === 0) return ["Added"];
    const parts = changes
      .filter((c) => c.field !== "type")
      .map((c) => (c.field === "dosage" ? c.to : describeValue(c.field, c.to)))
      .filter(Boolean);
    return [`Added · ${parts.join(" · ")}`];
  }

  return (Array.isArray(entry.changes) ? entry.changes : []).map((c) => {
    const from = c.field === "dosage" ? (c.from ?? "none") : describeValue(c.field, c.from);
    const to = c.field === "dosage" ? (c.to ?? "none") : describeValue(c.field, c.to);
    // the interval already reads as a phrase, so it carries no separate label
    if (c.field === "intervalDays") {
      return `${from.charAt(0).toUpperCase()}${from.slice(1)} → ${to}`;
    }
    const label = FIELD_LABELS[c.field] || c.field;
    return `${label} ${from} → ${to}`;
  });
}

/** The date line above an entry's changes. */
export function describeChangeDate(changedAt) {
  const d = new Date(changedAt);
  if (Number.isNaN(d.getTime())) return "";
  const opts = { month: "short", day: "numeric" };
  if (d.getFullYear() !== new Date().getFullYear()) opts.year = "numeric";
  return d.toLocaleDateString("en-US", opts);
}
