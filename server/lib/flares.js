const { isValidTimezone, localPartsIn } = require("./medSchedule");

/**
 * A flare is the user's own label for a stretch of days. The app never infers
 * one — not from scores, not from symptoms, not from the unrelated "Pain flare"
 * tag — so everything here is about keeping the spans the user marked coherent:
 * no future dates, no overlaps, one ongoing flare at a time.
 *
 * Nothing in this file reads the clock. "Today" is always passed in, because
 * today depends on the user's timezone rather than the server's, and because a
 * function that reads the clock cannot be tested across a DST boundary.
 */

const NOTE_MAX = 280;

// A flare with no end is still happening. For overlap purposes its end is
// treated as +infinity: nothing may be logged after an ongoing flare started.
const ONGOING = null;

/** A real calendar date in YYYY-MM-DD form. Rejects 2026-02-30. */
function isYmd(s) {
  if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split("-").map(Number);
  // round-trip through UTC: an impossible day normalises to a different date
  const t = Date.UTC(y, m - 1, d);
  const back = new Date(t);
  return back.getUTCFullYear() === y && back.getUTCMonth() === m - 1 && back.getUTCDate() === d;
}

const utcOf = (ymd) => {
  const [y, m, d] = ymd.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
};

const DAY_MS = 86400000;

/**
 * Whole days from `a` to `b`. Built on Date.UTC rather than local Date parsing
 * so a clock change can never add or drop a day: on the US "fall back" date a
 * local-midnight subtraction gives 24.041666 days for what is plainly 24.
 */
function daysBetween(a, b) {
  return Math.round((utcOf(b) - utcOf(a)) / DAY_MS);
}

/** Inclusive length. A flare started today is on day 1, not day 0. */
function durationDays(flare, today) {
  const end = flare.endDate ?? today;
  return daysBetween(flare.startDate, end) + 1;
}

/** Whether a calendar day falls inside the flare. Wave 2's shading uses this. */
function isDateInFlare(date, flare, today) {
  const end = flare.endDate ?? today;
  return date >= flare.startDate && date <= end;
}

/**
 * Inclusive overlap. Touching days count: a flare ending 10 Oct and one
 * starting 10 Oct overlap, because both claim that day. Starting 11 Oct does
 * not. An ongoing flare extends forever, so anything at or after its start
 * collides with it.
 */
function rangesOverlap(a, b, today) {
  const aEnd = a.endDate ?? null;
  const bEnd = b.endDate ?? null;
  // compare as strings — YYYY-MM-DD sorts chronologically
  const aAfterB = bEnd !== null && a.startDate > bEnd;
  const bAfterA = aEnd !== null && b.startDate > aEnd;
  void today;
  return !(aAfterB || bAfterA);
}

/**
 * The order of these checks is the order the messages make sense in: tell
 * someone their date is unreadable before telling them it collides.
 *
 * @param others the user's OTHER flares — the caller filters out the one being
 *        edited, so a flare never conflicts with itself.
 */
function validateFlare(candidate, others, today) {
  const { startDate, endDate } = candidate;

  if (!isYmd(startDate)) {
    return { ok: false, status: 400, error: "Please choose a start date." };
  }
  if (endDate !== ONGOING && endDate !== undefined && !isYmd(endDate)) {
    return { ok: false, status: 400, error: "Please choose a valid end date." };
  }
  const end = endDate === undefined ? ONGOING : endDate;

  if (startDate > today) {
    return { ok: false, status: 400, error: "A flare can't start in the future." };
  }
  if (end !== ONGOING && end > today) {
    return { ok: false, status: 400, error: "A flare can't end in the future." };
  }
  if (end !== ONGOING && end < startDate) {
    return { ok: false, status: 400, error: "The end date can't be before the start." };
  }

  const list = Array.isArray(others) ? others : [];
  if (end === ONGOING && list.some((f) => f.endDate === ONGOING || f.endDate === undefined)) {
    return { ok: false, status: 409, error: "You already have a flare going. End that one first." };
  }
  if (list.some((f) => rangesOverlap({ startDate, endDate: end }, f, today))) {
    return { ok: false, status: 409, error: "That overlaps another flare you've logged." };
  }
  return { ok: true };
}

/**
 * Over the limit is refused, never truncated: silently cutting someone's own
 * words in half is worse than making them shorten it themselves.
 */
function cleanNote(v) {
  if (typeof v !== "string") return null;
  const trimmed = v.trim();
  if (trimmed === "") return null;
  return trimmed;
}

/** Whether a note is short enough. Separate from cleanNote so the controller
 *  can answer with a 400 instead of quietly dropping characters. */
const noteTooLong = (v) => typeof v === "string" && v.trim().length > NOTE_MAX;

/**
 * The user's own "today". Their device reports a timezone, but it is nullable —
 * a brand-new account has not told us yet. The fallback is deliberately the
 * latest calendar date anywhere on Earth (UTC+14), so the one thing we never do
 * is tell somebody that their real local today is "in the future".
 */
function todayFor(timezone, now) {
  const zone = isValidTimezone(timezone) ? timezone : "Pacific/Kiritimati";
  return localPartsIn(now, zone).date;
}

module.exports = {
  NOTE_MAX,
  isYmd,
  daysBetween,
  durationDays,
  isDateInFlare,
  rangesOverlap,
  validateFlare,
  cleanNote,
  noteTooLong,
  todayFor,
};
