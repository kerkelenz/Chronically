// Chronicle's tips, and the welcome that comes before them.
//
// Tips are progressive: each one shows the first time the thing it describes
// is actually on screen — the dials after a first check-in, the cabinet after
// a first medication — not all at once on a first visit. Each tip names an
// anchor (a `data-tip` element on the web, a <TipAnchor id> on the phone) and
// waits until that anchor exists.
//
// Tip state comes from GET /api/users/tips (see tipsStore.js), never from the
// cached user. Null means not enrolled: no tips anywhere. Keys are tip ids
// (that tip was shown) or screens (the whole screen is closed, later
// additions included) — see server/lib/tips.js.
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
    { id: "dashboard.flare", anchor: "dashboard.flare", text: "While a flare's going, it lives here. Tell me when it eases — there's no rush." },
    { id: "dashboard.dials", anchor: "dashboard.dials", text: "Your last two weeks gather here as you check in. Just averages — no grades, no judgement." },
    { id: "dashboard.history", anchor: "dashboard.history", text: "Your recent check-ins land here. Tap the pencil to adjust one — second thoughts are welcome." },
  ],
  checkin: [
    { id: "checkin.levels", anchor: "checkin.levels", text: "Tap whichever feels closest. There are no wrong answers, and each choice carries you to the next question." },
    { id: "checkin.skip", anchor: "checkin.skip", text: "Not sure how you slept? Skipping is always okay. I'd much rather leave a gap than guess." },
    { id: "checkin.cancel", anchor: "checkin.cancel", text: "You can step away anytime. Nothing is saved until you reach the end." },
  ],
  trends: [
    { id: "trends.range", anchor: "trends.range", text: "Choose how far back to look. Shorter shows the texture of this week; longer shows the shape of things." },
    { id: "trends.flares", anchor: "trends.flares", text: "Rough stretches can be marked as flares — here, or at the end of a check-in. I'll shade them on your charts." },
    { id: "trends.insights", anchor: "trends.insights", text: "When two things keep turning up together, I'll mention it here — always with how many days it's based on." },
    { id: "trends.insightCard", anchor: "trends.insightCard", text: "This is a pattern, not a cause. The line underneath shows how many days it rests on, so you can weigh it yourself." },
    { id: "trends.chart", anchor: "trends.chart", text: "All six measures, side by side. Higher is always better here, even for pain and anxiety." },
  ],
  medications: [
    { id: "meds.add", anchor: "meds.add", text: "Add a medication here, with as much or as little detail as you like." },
    { id: "meds.today", anchor: "meds.today", text: "Today's doses gather here. Taken or skipped are both honest answers, and either one is fine." },
    { id: "meds.dose", anchor: "meds.dose", text: "Tap when you've taken a dose, or skip it. A wrong tap is easy to undo." },
    { id: "meds.helped", anchor: "meds.helped", text: "If you'd like, note whether this helped. It's optional, and tapping your answer again clears it." },
    { id: "meds.cabinet", anchor: "meds.cabinet", text: "Everything you take, paused ones included, lives in the cabinet. Open it to edit, refill or look back." },
  ],
  appointments: [
    { id: "appts.add", anchor: "appts.add", text: "When a visit's coming up, add it here. There's room to note what you'd like to bring up." },
    { id: "appts.report", anchor: "appts.report", text: "This makes a tidy summary of your recent days to share with your doctor — only if and when you want to." },
    { id: "appts.doctors", anchor: "appts.doctors", text: "Doctors you see often can be saved here, so adding the next visit is quicker." },
    { id: "appts.prep", anchor: "appts.prep", text: "Before a visit, jot down what you'd like to ask. It'll be waiting here when you're in the room." },
    { id: "appts.afterVisit", anchor: "appts.afterVisit", text: "Once a visit's done, you can note how it went and any follow-up. It's here for next time, if you want it." },
  ],
  spoons: [
    { id: "spoons.ring", anchor: "spoons.ring", text: "This is today's energy, counted in spoons. It's an estimate to plan around, never a target to hit." },
    { id: "spoons.activities", anchor: "spoons.activities", text: "Add what's on your plate and see what it costs. Ticking things off is entirely optional." },
    { id: "spoons.calendar", anchor: "spoons.calendar", text: "Look back at past days, or sketch out a busy one ahead of time." },
    { id: "spoons.reflection", anchor: "spoons.reflection", text: "At the end of a day, you can note how it actually went. Plans and real days rarely match, and both are worth keeping." },
  ],
  profile: [
    { id: "profile.notifications", anchor: "profile.notifications", text: "Reminders live here. Every one is optional, and you can quiet them whenever you need to." },
    { id: "profile.tracking", anchor: "profile.tracking", text: "If you mostly track your body or your mind, this changes what I offer first. Nothing is ever hidden." },
    { id: "profile.chronicle", anchor: "profile.chronicle", text: "Anything I've shared is kept here, in case you dismissed it before you were ready." },
    { id: "profile.tips", anchor: "profile.tips", text: "And if you'd ever like these little notes back, or the welcome again, this is where they live." },
  ],
};

const isState = (s) => s !== null && typeof s === "object" && !Array.isArray(s);

/**
 * The tips to show on a screen now: none unless enrolled and the screen isn't
 * closed; otherwise its unseen tips whose anchors are on screen, in order.
 */
export function tipsToShow(screen, tipsSeen, presentAnchorIds) {
  if (!isState(tipsSeen) || tipsSeen[screen] === true) return [];
  const present = new Set(presentAnchorIds || []);
  return (TIPS[screen] || []).filter((t) => present.has(t.anchor) && tipsSeen[t.id] !== true);
}

/**
 * The state after these tips were shown — the same rule the server applies:
 * once every tip on a screen is marked, the screen is closed too. Null stays
 * null; marking never enrols.
 */
export function withTipsMarked(tipsSeen, ids) {
  if (!isState(tipsSeen)) return tipsSeen;
  const next = { ...tipsSeen };
  for (const id of ids || []) next[id] = true;
  for (const screen of TIP_SCREENS) {
    if ((TIPS[screen] || []).every((t) => next[t.id] === true)) next[screen] = true;
  }
  return next;
}

/** "Tip 2 of 3"; nothing for a tip that arrives on its own. */
export function tipCountLabel(i, n) {
  return n > 1 ? `Tip ${i + 1} of ${n}` : "";
}

/** Profile's row: "Show tips" until any tip has been seen, then "Show tips again". */
export function tipsRowLabel(tipsSeen) {
  const anySeen = isState(tipsSeen) && Object.values(tipsSeen).some((v) => v === true);
  return anySeen ? "Show tips again" : "Show tips";
}

// ── The welcome ─────────────────────────────────────────────────────────────
// Three short steps, skippable at any point; Profile can replay them. The
// second step is the tracking-focus question (TRACKING_OPTIONS live in each
// platform's tracking-focus helper). Feature icons are chosen per platform by key.

export const WELCOME_FEATURES = [
  { key: "checkin", name: "Daily check-ins", desc: "Note how you're feeling in seconds." },
  { key: "spoons", name: "Spoon Center", desc: "Plan your day around the energy you have." },
  { key: "medications", name: "Medications", desc: "Keep doses, schedules, and history in one place." },
  { key: "appointments", name: "Appointments", desc: "Prep visits and bring a clean report to your doctor." },
  { key: "trends", name: "Trends", desc: "Watch your patterns come into focus over time." },
];

export const WELCOME_STEPS = [
  {
    id: "hello",
    title: "Welcome to Chronically",
    body: "I'm Chronicle. I'll keep you company in a calm, private place to track life with a chronic illness — one day at a time.",
  },
  {
    id: "focus",
    title: "What would you like to keep track of?",
    body: "This shapes which questions come first. Pick whatever fits today — you can change it anytime in Profile.",
  },
  {
    id: "pace",
    title: "One thing at a time",
    body: "There's nothing to set up. The first time you meet each part of the app, I'll leave a short note beside it — skip any you like.",
    note: "You can bring the notes back, or see this welcome again, from Profile.",
  },
];

export const WELCOME_PRIVACY = "No ads, no tracking — just gentle, everyday support.";

export function welcomeStepLabel(i) {
  return `Step ${i + 1} of ${WELCOME_STEPS.length}`;
}
