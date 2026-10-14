// First-visit tips: what Chronicle points out the first time each main screen
// opens. Each tip names an anchor — a `data-tip` element on the web, a
// <TipAnchor id> on the phone — and is skipped when that anchor isn't on screen.
//
// Tip state comes from GET /api/users/tips (see tipsStore.js), never from the
// cached user. Null means not enrolled: no tips anywhere.
//
// No imports: server/lib/tips.test.js reads this file as text and evaluates it.
//
// Kept byte-identical with mobile/theme/tips.js.

/** Same order as TIP_SCREENS in server/lib/tips.js. */
export const TIP_SCREENS = ["dashboard", "checkin", "trends", "medications", "appointments", "spoons", "profile"];

// A tip is a sentence or two, never a paragraph
export const TIP_WORD_MAX = 25;

export const TIPS = {
  dashboard: [
    { id: "dashboard.checkin", anchor: "dashboard.checkin", text: "This is where today's check-in lives. Thirty seconds is plenty — and skipping a day is completely fine." },
    { id: "dashboard.flare", anchor: "dashboard.flare", text: "Rough stretch? You can mark a flare here, and I'll keep it alongside your days so you can see it in context later." },
    { id: "dashboard.dials", anchor: "dashboard.dials", text: "After a few check-ins, your last two weeks gather here. Just averages — no grades, no judgement." },
  ],
  checkin: [
    { id: "checkin.levels", anchor: "checkin.levels", text: "Tap whichever feels closest. There are no wrong answers, and each choice carries you to the next question." },
    { id: "checkin.skip", anchor: "checkin.skip", text: "Not sure how you slept? Skipping is always okay. I'd much rather leave a gap than guess." },
    { id: "checkin.cancel", anchor: "checkin.cancel", text: "You can step away anytime. Nothing is saved until you reach the end." },
  ],
  trends: [
    { id: "trends.range", anchor: "trends.range", text: "Choose how far back to look. Shorter shows the texture of this week; longer shows the shape of things." },
    { id: "trends.insights", anchor: "trends.insights", text: "When two things keep turning up together, I'll mention it here — always with how many days it's based on." },
    { id: "trends.chart", anchor: "trends.chart", text: "All six measures, side by side. Higher is always better here, even for pain and anxiety." },
  ],
  medications: [
    { id: "meds.add", anchor: "meds.add", text: "Add a medication here, with as much or as little detail as you like." },
    { id: "meds.today", anchor: "meds.today", text: "Today's doses gather here. Taken or skipped are both honest answers, and either one is fine." },
    { id: "meds.cabinet", anchor: "meds.cabinet", text: "Everything you take, paused ones included, lives in the cabinet. Open it to edit, refill or look back." },
  ],
  appointments: [
    { id: "appts.add", anchor: "appts.add", text: "When a visit's coming up, add it here. There's room to note what you'd like to bring up." },
    { id: "appts.report", anchor: "appts.report", text: "This makes a tidy summary of your recent days to share with your doctor — only if and when you want to." },
    { id: "appts.doctors", anchor: "appts.doctors", text: "Doctors you see often can be saved here, so adding the next visit is quicker." },
  ],
  spoons: [
    { id: "spoons.ring", anchor: "spoons.ring", text: "This is today's energy, counted in spoons. It's an estimate to plan around, never a target to hit." },
    { id: "spoons.activities", anchor: "spoons.activities", text: "Add what's on your plate and see what it costs. Ticking things off is entirely optional." },
    { id: "spoons.calendar", anchor: "spoons.calendar", text: "Look back at past days, or sketch out a busy one ahead of time." },
  ],
  profile: [
    { id: "profile.notifications", anchor: "profile.notifications", text: "Reminders live here. Every one is optional, and you can quiet them whenever you need to." },
    { id: "profile.tracking", anchor: "profile.tracking", text: "If you mostly track your body or your mind, this changes what I offer first. Nothing is ever hidden." },
    { id: "profile.chronicle", anchor: "profile.chronicle", text: "Anything I've shared is kept here, in case you dismissed it before you were ready." },
    { id: "profile.tips", anchor: "profile.tips", text: "And if you'd ever like these little notes back, this is where they live." },
  ],
};

const isState = (s) => s !== null && typeof s === "object" && !Array.isArray(s);

/**
 * The tips to show on a screen now: none unless enrolled and this screen isn't
 * marked seen; otherwise its tips whose anchors are on screen, in order.
 */
export function tipsToShow(screen, tipsSeen, presentAnchorIds) {
  if (!isState(tipsSeen) || tipsSeen[screen] === true) return [];
  const present = new Set(presentAnchorIds || []);
  return (TIPS[screen] || []).filter((t) => present.has(t.anchor));
}

export function tipCountLabel(i, n) {
  return `Tip ${i + 1} of ${n}`;
}

/** Profile's row: "Show tips" until any screen has been seen, then "Show tips again". */
export function tipsRowLabel(tipsSeen) {
  const anySeen = isState(tipsSeen) && Object.values(tipsSeen).some((v) => v === true);
  return anySeen ? "Show tips again" : "Show tips";
}
