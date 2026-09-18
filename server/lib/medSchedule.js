// Server-side schedule maths for the notification scheduler.
//
// ⚠ The due-date half of this file MUST mirror `client/src/utils/medicationHelpers.js`
// (and its byte-identical twin `mobile/theme/medications.js`) — specifically
// resolvePattern / isMedicationDueOn. If the canonical patterns change there,
// change them here too, or reminders will disagree with the checklist the user
// sees. It is duplicated rather than imported because those files are ES
// modules in two client bundles and this server is CommonJS.
//
// The timezone half has no client counterpart: the clients never needed one,
// because "08:00" has always meant "08:00 wherever the phone is". The server
// has to reconstruct that explicitly.

const DEFAULT_TIMEZONE = "UTC";

// ── Timezone helpers ────────────────────────────────────────────────────────
// Intl is the only timezone database Node ships with, so all conversion goes
// through it rather than a date library.

/** Is this a zone name Node's ICU actually knows? Guards against junk from a client. */
function isValidTimezone(tz) {
  if (!tz || typeof tz !== "string") return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

const partsCache = new Map();
function formatterFor(tz) {
  let f = partsCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
      hour12: false,
    });
    partsCache.set(tz, f);
  }
  return f;
}

/**
 * What the wall clock reads in `tz` at instant `date`.
 * → { date: "YYYY-MM-DD", hour, minute, minutes } where `minutes` is minutes
 * since local midnight.
 */
function localPartsIn(date, tz) {
  const zone = isValidTimezone(tz) ? tz : DEFAULT_TIMEZONE;
  const p = {};
  for (const part of formatterFor(zone).formatToParts(date)) {
    if (part.type !== "literal") p[part.type] = part.value;
  }
  // en-CA gives a 24-hour clock, but midnight comes back as "24" on some ICU
  // builds — normalise it so 24:15 doesn't sort after 23:59.
  const hour = Number(p.hour) % 24;
  const minute = Number(p.minute);
  return {
    date: `${p.year}-${p.month}-${p.day}`,
    hour,
    minute,
    minutes: hour * 60 + minute,
  };
}

/**
 * The UTC instant at which local wall-clock `HH:MM` occurs on local `YYYY-MM-DD`
 * in `tz`. Used to build a stable `scheduledFor` key for the dedupe index.
 *
 * Works by guessing UTC-at-that-wall-time, measuring how far off the guess
 * lands in `tz`, and correcting — twice, so that a guess which starts on the
 * wrong side of a DST boundary still converges.
 */
function instantForLocal(dateStr, timeStr, tz) {
  const zone = isValidTimezone(tz) ? tz : DEFAULT_TIMEZONE;
  const [y, m, d] = dateStr.split("-").map(Number);
  const [hh, mm] = timeStr.split(":").map(Number);
  const target = Date.UTC(y, m - 1, d, hh, mm, 0, 0);

  let guess = target;
  for (let i = 0; i < 2; i++) {
    const p = localPartsIn(new Date(guess), zone);
    const [gy, gm, gd] = p.date.split("-").map(Number);
    const landed = Date.UTC(gy, gm - 1, gd, p.hour, p.minute, 0, 0);
    const drift = target - landed;
    if (drift === 0) break;
    guess += drift;
  }
  return new Date(guess);
}

// ── Canonical schedule patterns (mirror of medicationHelpers.js) ────────────

function parseYmd(s) {
  const [y, m, d] = s.split("-").map(Number);
  // noon, so a DST shift can never roll the date backwards
  return new Date(y, m - 1, d, 12, 0, 0, 0);
}

/** Resolve any medication (new or legacy) to a canonical pattern object. */
function resolvePattern(med) {
  const { frequency, frequencyWeeks, daysOfWeek, startDate, intervalDays, createdAt } = med;
  const anchor = startDate
    ? parseYmd(startDate)
    : parseYmd(new Date(createdAt || Date.now()).toISOString().slice(0, 10));
  switch (frequency) {
    case "daily":
    case "twice_daily":
    case "three_times_daily":
    case "four_times_daily":
      return { kind: "daily" };
    case "specific_days":
      return { kind: "specific_days", days: Array.isArray(daysOfWeek) ? daysOfWeek : [] };
    case "weekly":
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

/** Is this medication due on the given local YYYY-MM-DD? (PRN → false.) */
function isMedicationDueOn(medication, dateStr) {
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

// ── Which doses fall inside this tick ───────────────────────────────────────

const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/;

/**
 * Scheduled dose times for `medication` that land in the half-open local window
 * [windowStartMinutes, windowStartMinutes + windowMinutes) on `dateStr`.
 *
 * Half-open on purpose: consecutive ticks must never both claim the same
 * minute. Medications with no scheduled time are skipped — "sometime today"
 * has no hour to fire at, and guessing one would be worse than staying quiet.
 */
function dueTimesInWindow(medication, dateStr, windowStartMinutes, windowMinutes) {
  if (!medication.active) return [];
  if (!isMedicationDueOn(medication, dateStr)) return [];
  const times = Array.isArray(medication.scheduledTimes)
    ? medication.scheduledTimes.filter((t) => typeof t === "string" && HHMM.test(t))
    : [];
  const end = windowStartMinutes + windowMinutes;
  return times.filter((t) => {
    const [h, m] = t.split(":").map(Number);
    const mins = h * 60 + m;
    return mins >= windowStartMinutes && mins < end;
  });
}

/**
 * Patch-removal instants due in this tick, derived from doses actually logged
 * taken. `takenLogs` are MedicationLog rows with status "taken" and a takenAt.
 *
 * A removal is due when now - takenAt has passed removalOffsetHours, and the
 * crossing happened within this tick's window — so a patch applied days ago
 * doesn't produce a reminder the moment the feature ships.
 */
function removalsInWindow(medication, takenLogs, windowStart, windowEnd) {
  if (medication.type !== "patch") return [];
  const hours = medication.removalOffsetHours;
  if (!hours || hours <= 0) return [];
  const offsetMs = hours * 60 * 60 * 1000;
  const out = [];
  for (const log of takenLogs) {
    if (!log.takenAt) continue;
    const due = new Date(new Date(log.takenAt).getTime() + offsetMs);
    if (due >= windowStart && due < windowEnd) out.push({ log, due });
  }
  return out;
}

module.exports = {
  DEFAULT_TIMEZONE,
  isValidTimezone,
  localPartsIn,
  instantForLocal,
  resolvePattern,
  isMedicationDueOn,
  dueTimesInWindow,
  removalsInWindow,
};
