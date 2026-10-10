// When to send the two appointment notifications, and what they say.
//
// Pure: no database and no clock. Every function is handed its instants, so
// the planner in jobs/notificationScheduler.js only queries and claims, and
// everything that can go wrong with timezones and daylight saving is tested
// here. Nothing is stored ahead of time — each instant is derived from the
// appointment's date at tick time, so editing a date reschedules by itself and
// cancelling or completing stops everything (only "upcoming" is ever read).

const { isValidTimezone, localPartsIn, instantForLocal } = require("./medSchedule");

// The evening before, with whatever they noted to ask
const REMINDER_AT = "18:00";
// For a visit booked after that evening had passed: the same morning instead,
// but only when the visit leaves real lead time — a push at 08:00 for an 08:30
// visit is just noise
const MORNING_AT = "08:00";
const MORNING_MIN_START = "10:00";
// "How did it go?" this long after the start…
const FOLLOWUP_DELAY_MINUTES = 120;
// …moved out of the night to the next morning, not dropped: a visit recap is
// still worth having the day after
const QUIET_START = "21:00";
const QUIET_END = "09:00";

const NAME_MAX = 40;
const NOTE_MAX = 120;

const DAY_MS = 86400000;
const minutesOf = (hhmm) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};
const pad = (n) => String(n).padStart(2, "0");

/** Calendar arithmetic on the string itself, never on a local Date. */
function addDaysYmd(dateStr, n) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d) + n * DAY_MS);
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}

function localDayBefore(dateStr) {
  return addDaysYmd(dateStr, -1);
}

/**
 * `{ evening, morning }` for an appointment at instant `apptDate`, or null when
 * the zone is unknown (no time-of-day push at a guessed hour). `morning` is
 * null for a visit before 10:00 local.
 */
function reminderInstants(apptDate, tz) {
  if (!isValidTimezone(tz)) return null;
  const local = localPartsIn(new Date(apptDate), tz);
  return {
    evening: instantForLocal(localDayBefore(local.date), REMINDER_AT, tz),
    morning: local.minutes >= minutesOf(MORNING_MIN_START)
      ? instantForLocal(local.date, MORNING_AT, tz)
      : null,
  };
}

/** Two hours after the start, unless that lands in 21:00–09:00 — then the next 09:00. */
function followupInstant(apptDate, tz) {
  if (!isValidTimezone(tz)) return null;
  const due = new Date(new Date(apptDate).getTime() + FOLLOWUP_DELAY_MINUTES * 60000);
  const local = localPartsIn(due, tz);
  if (local.minutes >= minutesOf(QUIET_START)) return instantForLocal(addDaysYmd(local.date, 1), QUIET_END, tz);
  if (local.minutes < minutesOf(QUIET_END)) return instantForLocal(local.date, QUIET_END, tz);
  return due;
}

/**
 * Everything due in `[windowStart, windowEnd)` — the same half-open window as
 * prnFollowupsInWindow, so a tick boundary never sends twice or skips.
 * Both reminder variants are returned when their instants fall in the window;
 * the planner drops a morning one if that evening's was already sent.
 */
function apptNotificationsInWindow(appts, tz, windowStart, windowEnd) {
  if (!isValidTimezone(tz)) return [];
  const inWindow = (t) => t >= windowStart && t < windowEnd;
  const out = [];
  for (const appt of appts || []) {
    if (appt.status !== "upcoming") continue;
    const at = new Date(appt.date);
    if (Number.isNaN(at.getTime())) continue;

    const r = reminderInstants(at, tz);
    // a reminder is only ever before the visit
    if (r.evening < at && inWindow(r.evening)) {
      out.push({ kind: "appt_reminder", variant: "evening", appt, scheduledFor: r.evening, eveningInstant: r.evening });
    }
    if (r.morning && r.morning < at && inWindow(r.morning)) {
      out.push({ kind: "appt_reminder", variant: "morning", appt, scheduledFor: r.morning, eveningInstant: r.evening });
    }

    const f = followupInstant(at, tz);
    if (inWindow(f)) out.push({ kind: "appt_followup", variant: null, appt, scheduledFor: f });
  }
  return out;
}

const cut = (s, max) => (s.length > max ? `${s.slice(0, max - 1)}…` : s);
const nameOf = (appt) => cut(String(appt.doctorName || "").trim(), NAME_MAX);

/** "Tomorrow: Dr. Lee · 9:30 AM" / "You wanted to ask: …" */
function reminderCopy(appt, tz, variant) {
  // newer ICU puts a narrow no-break space before AM/PM; a plain space reads the same
  const time = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: tz })
    .format(new Date(appt.date))
    .replace(/\s+/g, " ");
  const when = variant === "morning" ? "Today" : "Tomorrow";
  const firstLine = String(appt.notesBefore || "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .find((l) => l !== "");
  return {
    title: `${when}: ${nameOf(appt)} · ${time}`,
    body: firstLine
      ? `You wanted to ask: ${cut(firstLine, NOTE_MAX)}`
      : "Anything you want to remember to ask? Add it to your prep notes.",
  };
}

function followupCopy(appt) {
  return {
    title: `How did it go with ${nameOf(appt)}?`,
    body: "Tap to add a note about the visit — only if you want to.",
  };
}

module.exports = {
  REMINDER_AT,
  MORNING_AT,
  MORNING_MIN_START,
  FOLLOWUP_DELAY_MINUTES,
  QUIET_START,
  QUIET_END,
  NAME_MAX,
  NOTE_MAX,
  localDayBefore,
  reminderInstants,
  followupInstant,
  apptNotificationsInWindow,
  reminderCopy,
  followupCopy,
};
