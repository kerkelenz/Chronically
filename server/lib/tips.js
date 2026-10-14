// First-visit tips: which screens a user has already been shown.
//
// Pure — no database. `null` means the account isn't enrolled (it finished
// the welcome before tips existed, or hasn't finished it yet) and never sees
// tips; marking a screen never enrols anyone. An object means enrolled, and a
// screen shows its tips until its key is true. Profile's "Show tips" resets to
// {}, which is the only way an existing account opts in.
//
// TIP_SCREENS must match the clients' tips.js (a parity test checks).

const TIP_SCREENS = ["dashboard", "checkin", "trends", "medications", "appointments", "spoons", "profile"];

/** Stored JSON made safe: null stays null, junk becomes {}, only known screens marked true survive. */
function normalizeTipsSeen(raw) {
  if (raw === null || raw === undefined) return null;
  if (typeof raw !== "object" || Array.isArray(raw)) return {};
  const out = {};
  for (const screen of TIP_SCREENS) {
    if (raw[screen] === true) out[screen] = true;
  }
  return out;
}

function isEnrolled(state) {
  return normalizeTipsSeen(state) !== null;
}

/** Marks a screen seen. A null state stays null: marking never enrols. */
function markScreenSeen(state, screen) {
  const current = normalizeTipsSeen(state);
  if (current === null || !TIP_SCREENS.includes(screen)) return current;
  return { ...current, [screen]: true };
}

function resetTips() {
  return {};
}

module.exports = { TIP_SCREENS, normalizeTipsSeen, isEnrolled, markScreenSeen, resetTips };
