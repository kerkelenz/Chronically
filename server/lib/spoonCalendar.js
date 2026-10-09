// Pure helpers behind GET /api/spoons/month and /week — the calendar views.
// Kept free of Sequelize so the date maths and roll-up can be unit-tested.
const { isValidTimezone, localPartsIn } = require("./medSchedule");

// a month key is "YYYY-MM"
const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

function isMonthKey(month) {
  return typeof month === "string" && MONTH_RE.test(month);
}

// the calendar month a YYYY-MM-DD date belongs to
function monthOf(dateStr) {
  return String(dateStr).slice(0, 7);
}

// first and last calendar date of a month, as YYYY-MM-DD strings
// Date.UTC(y, m, 0) is the last day of month m (months are 0-indexed, so m is
// already "next month"), which handles leap years for us
function monthRange(month) {
  if (!isMonthKey(month)) throw new Error(`Invalid month: ${month}`);
  const [year, mon] = month.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year, mon, 0)).getUTCDate();
  return {
    start: `${month}-01`,
    end: `${month}-${String(lastDay).padStart(2, "0")}`,
    days: lastDay,
  };
}

// shift a YYYY-MM-DD string by whole days without tripping over time zones
function shiftDate(dateStr, delta) {
  const [y, m, d] = String(dateStr).split("-").map(Number);
  const shifted = new Date(Date.UTC(y, m - 1, d + delta));
  return shifted.toISOString().slice(0, 10);
}

// shift a YYYY-MM month key by whole months
function shiftMonth(month, delta) {
  if (!isMonthKey(month)) throw new Error(`Invalid month: ${month}`);
  const [year, mon] = month.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, mon - 1 + delta, 1));
  return shifted.toISOString().slice(0, 7);
}


// a date key is a real "YYYY-MM-DD" — 2026-02-30 looks right and is not a day
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isDateKey(dateStr) {
  if (typeof dateStr !== "string" || !DATE_RE.test(dateStr)) return false;
  const [y, m, d] = dateStr.split("-").map(Number);
  // an impossible day normalises to a different date on the round trip
  const back = new Date(Date.UTC(y, m - 1, d));
  return back.getUTCFullYear() === y && back.getUTCMonth() === m - 1 && back.getUTCDate() === d;
}

// The Sunday-to-Saturday week containing `dateStr`, matching the month grid,
// which is Sunday-first on both platforms. All UTC maths, so the server's own
// zone cannot shift which week a date belongs to.
function weekRange(dateStr) {
  if (!isDateKey(dateStr)) throw new Error(`Invalid date: ${dateStr}`);
  const [y, m, d] = dateStr.split("-").map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();   // 0 = Sunday
  const start = shiftDate(dateStr, -dow);
  return { start, end: shiftDate(start, 6) };
}

/**
 * The user's own calendar date.
 *
 * With no stored zone the answer is deliberately generous: UTC + 1 day. No
 * zone on Earth is more than one calendar day ahead of UTC, so an east-of-UTC
 * user whose device has not reported a zone is never told that their actual
 * today is in the future. Being a day lenient costs nothing here; being a day
 * strict would refuse a reflection somebody is entitled to write.
 */
function localToday(now, tz) {
  if (isValidTimezone(tz)) return localPartsIn(now, tz).date;
  const utcToday = new Date(now).toISOString().slice(0, 10);
  return shiftDate(utcToday, 1);
}

const REFLECTIONS = ["lighter", "about_right", "heavier"];
const NOTE_MAX = 280;

/**
 * What to store for a reflection request.
 *
 * A note needs a reflection to belong to, so clearing the reflection clears
 * the note whatever was sent. An absent note key means "leave it alone", which
 * is what lets a pill tap change the answer without touching what was written.
 */
function normalizeReflection(body = {}, existingNote = null) {
  const { reflection } = body || {};
  if (reflection !== null && !REFLECTIONS.includes(reflection)) {
    return { error: "Choose lighter, about right or heavier." };
  }
  if (reflection === null) return { reflection: null, reflectionNote: null };

  if (!(body && Object.prototype.hasOwnProperty.call(body, "reflectionNote"))) {
    return { reflection, reflectionNote: existingNote ?? null };
  }
  const note = body.reflectionNote;
  if (note === null) return { reflection, reflectionNote: null };
  if (typeof note !== "string") return { error: "Notes can be up to 280 characters." };

  const trimmed = note.trim();
  if (trimmed === "") return { reflection, reflectionNote: null };
  // measured after trimming, in the same UTF-16 units both clients' maxLength
  // counts — the check-in note and the flare note use the same rule
  if (trimmed.length > NOTE_MAX) return { error: "Notes can be up to 280 characters." };
  return { reflection, reflectionNote: trimmed };
}

// roll SpoonDay rows and their entries up into one summary per planned date.
function summarizeDays({ days = [], entries = [] } = {}) {
  const byDay = new Map();
  for (const entry of entries) {
    const list = byDay.get(entry.spoonDayId);
    if (list) list.push(entry);
    else byDay.set(entry.spoonDayId, [entry]);
  }

  return days
    .map((day) => {
      const dayEntries = byDay.get(day.id) || [];
      return {
        date: String(day.date),
        budget: day.budget,
        budgetEdited: !!day.budgetEdited,
        // total spoon cost of everything planned for the day
        spent: dayEntries.reduce((sum, e) => sum + (e.cost || 0), 0),
        planned: dayEntries.length,
        completed: dayEntries.filter((e) => e.completed).length,
        reflection: day.reflection ?? null,
        // whether a note exists, never the note itself: a summary feeds a
        // calendar cell, and the words belong to the day view
        hasNote: !!(day.reflectionNote && String(day.reflectionNote).trim()),
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date));
}

module.exports = {
  isMonthKey,
  isDateKey,
  monthOf,
  monthRange,
  weekRange,
  shiftDate,
  shiftMonth,
  localToday,
  normalizeReflection,
  REFLECTIONS,
  summarizeDays,
  // kept so nothing that already imports it has to change
  summarizeMonth: summarizeDays,
};
