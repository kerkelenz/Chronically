// Saved-doctor helpers shared by the appointment form and the doctors manager.
//
// `normalizeName` must agree with server/lib/doctors.js exactly: the server
// decides which saved doctor an appointment belongs to, and the form decides
// whether to offer "Save for next time". If the two disagreed, the checkbox
// would appear for a doctor already saved, or hide for one that isn't. A parity
// test in server/lib/doctors.test.js reads this file and fails if they drift.
//
// Kept byte-identical with mobile/theme/doctorHelpers.js.

// The report's own ceiling, so a visit summary can never ask for more than the
// report will print. Both copies of this file sit beside their reportOptions.js.
import { MAX_RANGE_DAYS } from "./reportOptions";

// Six is what fits under the field without pushing the rest of the form off
// screen on a phone. Suggestions are a shortcut, not a directory.
export const MAX_SUGGESTIONS = 6;

// Trimmed, internal whitespace collapsed, lower-cased. Punctuation is kept on
// purpose: "Dr. Lee" and "Dr Lee" stay distinct, because guessing which marks
// matter in a person's name is how two different people get merged.
export function normalizeName(name) {
  if (typeof name !== "string") return "";
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

// Substring match on what has been typed; everything when the field is empty.
// Server order is preserved — it already sorts by most recently seen.
export function matchDoctors(doctors, typed) {
  const list = Array.isArray(doctors) ? doctors : [];
  const q = typeof typed === "string" ? typed.trim().toLowerCase() : "";
  const matches = q === ""
    ? list
    : list.filter((d) => String(d?.name || "").toLowerCase().includes(q));
  return matches.slice(0, MAX_SUGGESTIONS);
}

// True once the field holds exactly one of the suggestions. The list hides at
// that point: the user has either picked a row or finished typing the name, and
// either way a list whose only entry repeats the field is just noise.
export function matchesExactly(doctors, typed) {
  const key = normalizeName(typed);
  if (!key) return false;
  return (Array.isArray(doctors) ? doctors : []).some((d) => normalizeName(d?.name) === key);
}

// Whether the typed name is already in the user's saved list — the one thing
// that decides if "Save for next time" is offered. A doctor who only appears in
// past appointments is NOT saved, so the checkbox still shows for them.
export function isAlreadySaved(doctors, typed) {
  const key = normalizeName(typed);
  if (!key) return false;
  return (Array.isArray(doctors) ? doctors : []).some(
    (d) => d?.saved && normalizeName(d?.name) === key,
  );
}

// "Neurology · Harbor Clinic", or just whichever one is present, or "".
export function describeDoctor(doctor) {
  const parts = [doctor?.specialty, doctor?.location]
    .map((p) => (typeof p === "string" ? p.trim() : ""))
    .filter((p) => p !== "");
  return parts.join(" · ");
}

// What a screen reader announces for a suggestion row.
export function suggestionLabel(doctor) {
  const name = String(doctor?.name || "").trim();
  const specialty = typeof doctor?.specialty === "string" ? doctor.specialty.trim() : "";
  return specialty ? `Use ${name}, ${specialty}` : `Use ${name}`;
}

// ── "Summary for this visit" ───────────────────────────────────────────────

// Fixed month names rather than a locale API, so the heading reads the same on
// every device and in tests.
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const ymdLabel = (ymd) => {
  const [y, m, d] = ymd.split("-").map(Number);
  return `${MONTHS[m - 1]} ${d}, ${y}`;
};
const shiftYmd = (ymd, n) => {
  const [y, m, d] = ymd.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d) + n * 86400000);
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, "0")}-${String(t.getUTCDate()).padStart(2, "0")}`;
};

/**
 * The stretch a report for this visit should cover: since the last completed
 * visit with the same doctor (same name, as normalizeName sees it), or the last
 * 90 days when there wasn't one — never past today, and never more than a year.
 * → { from, to, heading, priorVisitDate | null }, dates "YYYY-MM-DD".
 */
export function visitSummaryRange(appt, appointments, todayStr, localDate = (iso) => new Date(iso).toLocaleDateString("en-CA")) {
  const name = String(appt.doctorName || "").trim();
  const apptDay = localDate(appt.date);
  const to = apptDay < todayStr ? apptDay : todayStr;

  const key = normalizeName(appt.doctorName);
  let prior = null;
  (Array.isArray(appointments) ? appointments : []).forEach((a) => {
    if (!a || a.id === appt.id || a.status !== "completed") return;
    if (normalizeName(a.doctorName) !== key) return;
    const day = localDate(a.date);
    // a visit earlier the same day is not "the last time"
    if (day < apptDay && (prior === null || day > prior)) prior = day;
  });

  let from;
  let heading;
  if (prior) {
    from = prior < to ? prior : to;
    heading = `Since your visit with ${name} on ${ymdLabel(prior)}`;
  } else {
    from = shiftYmd(to, -89); // 90 days, inclusive
    heading = `Last 90 days · for your visit with ${name}`;
  }
  // a visit from three years ago shouldn't produce a 40-page PDF
  if (from < shiftYmd(to, -MAX_RANGE_DAYS)) {
    from = shiftYmd(to, -(MAX_RANGE_DAYS - 1));
    heading = `Last 12 months · for your visit with ${name}`;
  }
  return { from, to, heading, priorVisitDate: prior };
}
