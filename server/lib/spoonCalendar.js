// Pure helpers behind GET /api/spoons/month — the calendar's month view.
// Kept free of Sequelize so the date maths and roll-up can be unit-tested.

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

// roll SpoonDay rows and their entries up into one summary per planned date.
// only dates the user actually has a row for appear - the calendar renders the
// rest as empty, so browsing a month never has to create days
function summarizeMonth({ days = [], entries = [] } = {}) {
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
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date));
}

module.exports = {
  isMonthKey,
  monthOf,
  monthRange,
  shiftDate,
  shiftMonth,
  summarizeMonth,
};
