export const TYPE_ICONS = {
  pill:        "💊",
  injection:   "💉",
  infusion:    "🩺",
  supplement:  "🌿",
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
