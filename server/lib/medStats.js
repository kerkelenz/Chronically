const { resolvePattern } = require("./medSchedule");

/**
 * Supply and rating arithmetic. Pure: no database, no clock — `now` and the
 * logs are passed in, so a boundary case can be tested instead of waited for.
 *
 * Remaining supply is computed, never stored. A running counter would be wrong
 * the first time somebody corrected a log, and wrong in a way nobody could see.
 * The same reasoning already governs missed doses.
 *
 * None of this is a judgement. `daysLeft` is "by your count" arithmetic, and
 * the rating counts are the user's own notes played back — nothing here decides
 * whether a medication works.
 */

// The insights window, reused so "last 90 days" means one thing in the app.
const HELPED_WINDOW_DAYS = 90;

const isHHMM = (t) => typeof t === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(t);

/**
 * How much of a supply a medication consumes, as units per cycle of days.
 * Returns null when there is nothing to project from: as-needed has no
 * schedule, and specific_days with no days selected never comes due.
 */
function unitsRate(med) {
  const pattern = resolvePattern(med);
  const perDose = Number(med.unitsPerDose) || 1;
  // No times set means one "anytime" dose a day — the same assumption
  // expectedDosesOn makes when it returns [null].
  const times = Array.isArray(med.scheduledTimes)
    ? med.scheduledTimes.filter(isHHMM).length || 1
    : 1;

  switch (pattern.kind) {
    case "daily":
      return { units: times * perDose, cycleDays: 1 };
    case "specific_days": {
      const days = Array.isArray(pattern.days) ? pattern.days.length : 0;
      if (days === 0) return null;
      // kept as units-per-7-days rather than a fraction per day: dividing here
      // introduces the float error the caller then has to undo
      return { units: times * days * perDose, cycleDays: 7 };
    }
    case "every_n_days":
      return { units: times * perDose, cycleDays: Math.max(1, pattern.n || 1) };
    case "monthly":
      return { units: times * perDose, cycleDays: 30 };
    default:
      // as_needed, none
      return null;
  }
}

/**
 * Units consumed since `since`. Mirrors adherenceStats' rule for duplicates: a
 * scheduled slot counts once however many taken rows it collected, because a
 * double tap is one dose. Every as-needed row is its own dose, so they all
 * count — they all carry scheduledTime null and cannot be told apart by slot.
 */
function countTakenUnits(med, logs, since) {
  if (!Array.isArray(logs)) return 0;
  const perDose = Number(med.unitsPerDose) || 1;
  const isPrn = resolvePattern(med).kind === "as_needed";
  const cutoff = since ? new Date(since).getTime() : null;

  let doses = 0;
  const seen = new Set();
  for (const log of logs) {
    if (log.status !== "taken") continue;
    // takenAt is nullable on older rows; createdAt is when it was recorded
    const at = new Date(log.takenAt ?? log.createdAt).getTime();
    if (Number.isNaN(at)) continue;
    if (cutoff !== null && at <= cutoff) continue;

    if (isPrn) {
      doses += 1;
    } else {
      const key = `${log.date}|${log.scheduledTime ?? ""}`;
      if (seen.has(key)) continue;
      seen.add(key);
      doses += 1;
    }
  }
  return doses * perDose;
}

/**
 * What the card shows. `recount` means more has been logged than was counted —
 * an invitation to update the number, never an alarm.
 */
function supplyStatus(med, logs, now) {
  if (med.supplyCount == null) return null;

  const used = countTakenUnits(med, logs, med.supplyUpdatedAt);
  const raw = Number(med.supplyCount) - used;
  const remaining = Math.max(0, raw);

  const rate = unitsRate(med);
  // Multiply before dividing, with an epsilon: 6 / (3/7) is 14.000000000000002
  // in floats, and Math.floor would turn a clean 14 into 14 only by luck.
  const daysLeft = rate
    ? Math.floor((remaining * rate.cycleDays) / rate.units + 1e-9)
    : null;

  const low = daysLeft !== null
    && med.refillReminderDays != null
    && daysLeft <= Number(med.refillReminderDays);

  void now;
  return { remaining, daysLeft, low, recount: raw < 0 };
}

/**
 * The user's own ratings, counted. Returns null when nothing has been rated:
 * a line reading "0 of 0" says less than no line at all.
 */
function summarizeHelped(logs, now) {
  if (!Array.isArray(logs)) return null;
  const cutoff = new Date(now).getTime() - HELPED_WINDOW_DAYS * 86400000;
  const counts = { rated: 0, yes: 0, a_little: 0, no: 0 };

  for (const log of logs) {
    if (log.status !== "taken") continue;
    if (log.helped !== "yes" && log.helped !== "a_little" && log.helped !== "no") continue;
    const at = new Date(log.takenAt ?? log.createdAt).getTime();
    if (Number.isNaN(at) || at < cutoff) continue;
    counts.rated += 1;
    counts[log.helped] += 1;
  }
  return counts.rated === 0 ? null : counts;
}

module.exports = {
  HELPED_WINDOW_DAYS,
  unitsRate,
  countTakenUnits,
  supplyStatus,
  summarizeHelped,
};
