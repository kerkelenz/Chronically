const { resolvePattern } = require("./medSchedule");

/**
 * Deciding what actually changed about a medication.
 *
 * The hard part is that the two edit forms always submit the canonical schedule
 * shape, so opening a legacy medication and pressing Save rewrites
 * frequency "weekly" to "specific_days" with the same meaning. A diff over raw
 * columns would record that as a change the user never made — and a history
 * full of edits nobody performed is worse than no history.
 *
 * So everything is compared through `resolvePattern`: the canonical projection
 * of what the schedule *means*. Name and notes are not tracked; this is about
 * dosage and schedule.
 */

// The fields a history entry can mention, in the order they read best.
const TRACKED_FIELDS = [
  "type", "dosage", "frequency", "daysOfWeek", "intervalDays", "startDate", "scheduledTimes",
];

const isHHMM = (t) => typeof t === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(t);
const ymd = (d) => {
  if (!d) return null;
  if (typeof d === "string") return d.slice(0, 10);
  const date = new Date(d);
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
};

/**
 * The comparable shape of a medication. Fields that do not apply to the
 * pattern are null rather than stale: a daily medication's leftover startDate
 * is not part of what its schedule means, so changing it is not a change.
 */
function projectMedication(med) {
  const pattern = resolvePattern(med);
  const kind = pattern.kind;

  const dosage = typeof med.dosage === "string" && med.dosage.trim() !== ""
    ? med.dosage.trim()
    : null;

  const times = kind === "as_needed"
    ? null
    : (Array.isArray(med.scheduledTimes) ? med.scheduledTimes.filter(isHHMM).slice().sort() : []);

  return {
    type: med.type ?? null,
    dosage,
    frequency: kind,
    daysOfWeek: kind === "specific_days"
      ? (Array.isArray(pattern.days) ? pattern.days.slice().sort((a, b) => a - b) : [])
      : null,
    // every_x_weeks and biweekly collapse into a day count here, which is how
    // frequencyWeeks is tracked at all — it never appears as its own field
    intervalDays: kind === "every_n_days" ? pattern.n : null,
    startDate: (kind === "every_n_days" || kind === "monthly") ? ymd(med.startDate) : null,
    // [] and null both mean "no times set"
    scheduledTimes: times && times.length > 0 ? times : null,
  };
}

const sameValue = (a, b) => {
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b)) return false;
    return a.length === b.length && a.every((v, i) => v === b[i]);
  }
  return a === b;
};

/** [{ field, from, to }] over the two projections. Empty when nothing changed. */
function diffMedication(before, after) {
  const out = [];
  for (const field of TRACKED_FIELDS) {
    if (!sameValue(before[field], after[field])) {
      out.push({ field, from: before[field] ?? null, to: after[field] ?? null });
    }
  }
  return out;
}

/** The "created" entry: every field that has a value, as from null. */
function snapshotChanges(med) {
  const p = projectMedication(med);
  const out = [];
  for (const field of TRACKED_FIELDS) {
    const to = p[field];
    if (to === null || (Array.isArray(to) && to.length === 0)) continue;
    out.push({ field, from: null, to });
  }
  return out;
}

/**
 * The "Added" entry for a medication with no stored `created` row — every one
 * that predates history. Taken from its own createdAt and carrying no field
 * values, because we genuinely don't know what they were. Never written to the
 * database: reading a history must not create one. Shared by the per-medication
 * history and the all-medications changes endpoint so the two can't disagree.
 */
function derivedCreatedEntry(medication) {
  return { id: null, kind: "created", changedAt: medication.createdAt, changes: [], derived: true };
}

module.exports = { TRACKED_FIELDS, projectMedication, diffMedication, snapshotChanges, derivedCreatedEntry };
