// First-visit tips: which tips a user has already been shown.
//
// Pure — no database. `null` means the account isn't enrolled (it finished
// the welcome before tips existed, or hasn't finished it yet) and never sees
// tips; marking never enrols anyone. An object means enrolled. It holds two
// kinds of key:
//   - a tip id ("dashboard.dials") — that one tip has been shown;
//   - a screen ("dashboard") — the whole screen is closed, tips added to it
//     later included.
// Tips are marked one at a time, as each feature first appears; once every
// tip on a screen is marked, the screen is closed too. That's what keeps a
// tip added in a later release from interrupting someone already settled in —
// it reaches them only through Profile's "Show tips again", which resets to
// {}. Older app builds still mark whole screens, which stays valid.
//
// TIP_SCREENS and TIP_IDS must match the clients' tips.js (a parity test checks).

const TIP_SCREENS = ["dashboard", "checkin", "trends", "medications", "appointments", "spoons", "profile"];

const TIP_IDS = {
  dashboard: ["dashboard.checkin", "dashboard.flare", "dashboard.dials", "dashboard.history"],
  checkin: ["checkin.levels", "checkin.skip", "checkin.cancel"],
  trends: ["trends.range", "trends.flares", "trends.insights", "trends.insightCard", "trends.chart"],
  medications: ["meds.add", "meds.today", "meds.dose", "meds.helped", "meds.cabinet"],
  appointments: ["appts.add", "appts.report", "appts.doctors", "appts.prep", "appts.afterVisit"],
  spoons: ["spoons.ring", "spoons.activities", "spoons.calendar", "spoons.reflection"],
  profile: ["profile.notifications", "profile.tracking", "profile.chronicle", "profile.tips"],
};

const KNOWN_IDS = new Set(Object.values(TIP_IDS).flat());

/** Stored JSON made safe: null stays null, junk becomes {}, only known screens and tip ids marked true survive. */
function normalizeTipsSeen(raw) {
  if (raw === null || raw === undefined) return null;
  if (typeof raw !== "object" || Array.isArray(raw)) return {};
  const out = {};
  for (const [key, value] of Object.entries(raw)) {
    if (value === true && (TIP_SCREENS.includes(key) || KNOWN_IDS.has(key))) out[key] = true;
  }
  return out;
}

function isEnrolled(state) {
  return normalizeTipsSeen(state) !== null;
}

/** Marks a whole screen closed. A null state stays null: marking never enrols. */
function markScreenSeen(state, screen) {
  const current = normalizeTipsSeen(state);
  if (current === null || !TIP_SCREENS.includes(screen)) return current;
  return { ...current, [screen]: true };
}

/**
 * Marks individual tips shown; unknown ids are ignored. A screen whose every
 * tip is now marked is closed as well. A null state stays null.
 */
function markTipIdsSeen(state, ids) {
  const current = normalizeTipsSeen(state);
  if (current === null || !Array.isArray(ids)) return current;
  const next = { ...current };
  for (const id of ids) if (KNOWN_IDS.has(id)) next[id] = true;
  for (const screen of TIP_SCREENS) {
    if (TIP_IDS[screen].every((id) => next[id] === true)) next[screen] = true;
  }
  return next;
}

function resetTips() {
  return {};
}

module.exports = { TIP_SCREENS, TIP_IDS, normalizeTipsSeen, isEnrolled, markScreenSeen, markTipIdsSeen, resetTips };
