// Flare formatting shared by the dashboard card and the history list.
//
// `flareDay` must agree with `durationDays` in server/lib/flares.js: the server
// decides whether a date is inside a flare, and the client prints the day
// number beside it. If they disagreed, somebody would read "day 4" next to a
// span the server calls five days long. A parity test in server/lib/flares.test.js
// reads this file and fails if they drift.
//
// Kept byte-identical with mobile/theme/flareHelpers.js.

const DAY_MS = 86400000;

// The device-local calendar date, in the same form the rest of the app uses for
// "today" (check-ins, spoon days). en-CA gives YYYY-MM-DD.
export function localToday() {
  return new Date().toLocaleDateString("en-CA");
}

// Built on Date.UTC rather than local Date parsing so a daylight-saving change
// cannot add or drop a day: subtracting local midnights across "fall back"
// gives 24.0416… days for what is plainly 24.
function utcOf(ymd) {
  const [y, m, d] = String(ymd).split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

// A date object at local noon, which is the safe hour to format from: midnight
// can land on the previous day in some zones and shift the weekday.
function atLocalNoon(ymd) {
  const [y, m, d] = String(ymd).split("-").map(Number);
  return new Date(y, m - 1, d, 12, 0, 0, 0);
}

/** Inclusive day number. A flare started today is day 1, not day 0. */
export function flareDay(startDate, today) {
  return Math.round((utcOf(today) - utcOf(startDate)) / DAY_MS) + 1;
}

const plural = (n, word) => `${n} ${n === 1 ? word : `${word}s`}`;

/**
 * The heading on the ongoing-flare card. Deliberately factual: how long it has
 * been, and since when. No encouragement, no alarm, nothing that changes tone
 * as the number grows.
 */
export function flareSinceLabel(startDate, today) {
  const day = flareDay(startDate, today);
  if (day <= 1) return "Flare started today";
  const d = atLocalNoon(startDate);
  // within the week a weekday is easier to place than a date
  const when = day <= 7
    ? d.toLocaleDateString("en-US", { weekday: "short" })
    : d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return `Flare since ${when} · day ${day}`;
}

/** "Oct 2 – Oct 6 · 5 days", "Oct 2 · 1 day", "Since Oct 2 · ongoing". */
export function formatFlareRange(flare, today) {
  const thisYear = new Date().getFullYear();
  const fmt = (ymd) => {
    const d = atLocalNoon(ymd);
    const opts = { month: "short", day: "numeric" };
    // the year earns its space only when the flare isn't from this year
    if (d.getFullYear() !== thisYear) opts.year = "numeric";
    return d.toLocaleDateString("en-US", opts);
  };

  if (!flare || !flare.startDate) return "";
  if (!flare.endDate) return `Since ${fmt(flare.startDate)} · ongoing`;

  const days = Math.round((utcOf(flare.endDate) - utcOf(flare.startDate)) / DAY_MS) + 1;
  if (flare.startDate === flare.endDate) return `${fmt(flare.startDate)} · ${plural(days, "day")}`;
  return `${fmt(flare.startDate)} – ${fmt(flare.endDate)} · ${plural(days, "day")}`;
}

/** What a screen reader says for the ongoing card. */
export function flareCardLabel(startDate, today) {
  const day = flareDay(startDate, today);
  const full = atLocalNoon(startDate).toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric",
  });
  return `Flare ongoing, day ${day}, since ${full}`;
}
