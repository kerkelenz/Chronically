const { Op } = require("sequelize");
const cron = require("node-cron");
const { Expo } = require("expo-server-sdk");

const User = require("../models/User");
const Medication = require("../models/Medication");
const MedicationLog = require("../models/MedicationLog");
const CheckIn = require("../models/CheckIn");
const PushToken = require("../models/PushToken");
const NotificationLog = require("../models/NotificationLog");
const Appointment = require("../models/Appointment");
const {
  DEFAULT_TIMEZONE,
  isValidTimezone,
  localPartsIn,
  instantForLocal,
  dueTimesInWindow,
  removalsInWindow,
  resolvePattern,
  prnFollowupsInWindow,
} = require("../lib/medSchedule");
const { supplyStatus } = require("../lib/medStats");
const { apptNotificationsInWindow, reminderCopy, followupCopy } = require("../lib/apptSchedule");

const expo = new Expo();

const TICK_CRON = "*/5 * * * *";
// Deliberately wider than the 5-minute tick: a late tick, a restart or a slow
// run would otherwise drop a dose silently. Overlap is free — NotificationLog's
// unique index makes a repeat impossible — whereas a gap is a missed dose.
const LOOKBACK_MINUTES = 10;
// How long after an as-needed dose to ask how it went.
const PRN_FOLLOWUP_MINUTES = 60;
// Local wall-clock time the daily check-in nudge becomes eligible.
const NUDGE_AT = "20:00";

// Gentle by design: the nudge must never read as a scolding. No streak talk,
// no "you forgot", nothing red. See the toast tone rules in checkinCopy.js.
const NUDGE_LINES = [
  "No pressure — just checking in if you have a moment today 💜",
  "Here whenever you're ready to log today 💜",
  "A quiet nudge, in case today's a good day to check in 💜",
  "Only if you're up to it — today's check-in is waiting 💜",
];

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * The local-time span this tick is responsible for, as day segments. Returns
 * one segment normally, two when the lookback crosses local midnight.
 */
function windowSegments(now, tz) {
  const startParts = localPartsIn(new Date(now.getTime() - LOOKBACK_MINUTES * 60000), tz);
  const endParts = localPartsIn(now, tz);
  if (startParts.date === endParts.date) {
    return [{ date: endParts.date, from: startParts.minutes, to: endParts.minutes }];
  }
  return [
    { date: startParts.date, from: startParts.minutes, to: 24 * 60 },
    { date: endParts.date, from: 0, to: endParts.minutes },
  ];
}

function prefsOf(user) {
  const p = user.notificationPrefs || {};
  return {
    enabled: p.enabled !== false,
    medReminders: p.medReminders !== false,
    checkinNudge: p.checkinNudge !== false,
    // `!== false` so an existing user whose stored JSON predates these keys is
    // treated as opted in. No data migration, and nobody is silently opted out
    // of something the Profile screen shows as on.
    refillReminders: p.refillReminders !== false,
    prnFollowups: p.prnFollowups !== false,
    appointmentReminders: p.appointmentReminders !== false,
    appointmentFollowups: p.appointmentFollowups !== false,
  };
}

/** Pick a nudge line deterministically, so the same day always reads the same. */
function nudgeLine(userId, dateStr) {
  let h = 0;
  const key = `${userId}:${dateStr}`;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) | 0;
  return NUDGE_LINES[Math.abs(h) % NUDGE_LINES.length];
}

/**
 * Claim a notification before sending it. The unique index means only one
 * caller can ever win a given (user, kind, ref, instant) — that is what makes
 * an overlapping tick, a restart, or a second instance safe.
 *
 * Claim-then-send, not send-then-record: a crash between the two loses one
 * notification, which is far better than repeating a medication reminder.
 */
async function claim(userId, kind, refId, scheduledFor) {
  try {
    await NotificationLog.create({ userId, kind, refId, scheduledFor, sentAt: new Date() });
    return true;
  } catch (err) {
    if (err.name === "SequelizeUniqueConstraintError") return false;
    throw err;
  }
}

// ── Per-user planning ───────────────────────────────────────────────────────

async function planMedReminders(user, tz, segments, messages) {
  const meds = await Medication.findAll({
    where: { userId: user.id, active: true },
    raw: true,
  });
  if (meds.length === 0) return;

  for (const seg of segments) {
    if (seg.to <= seg.from) continue;
    for (const med of meds) {
      const times = dueTimesInWindow(med, seg.date, seg.from, seg.to - seg.from);
      for (const time of times) {
        // already dealt with — taken, skipped or explicitly missed
        const logged = await MedicationLog.findOne({
          where: { userId: user.id, medicationId: med.id, date: seg.date, scheduledTime: time },
        });
        if (logged) continue;

        const scheduledFor = instantForLocal(seg.date, time, tz);
        if (!(await claim(user.id, "med", med.id, scheduledFor))) continue;

        messages.push({
          userId: user.id,
          title: `Time for ${med.name}`,
          body: med.dosage ? `${med.dosage}` : "Tap to log it when you can.",
          data: { kind: "med", medicationId: med.id, date: seg.date, scheduledTime: time },
        });
      }
    }
  }
}

/**
 * A refill nudge, at most once per supply period.
 *
 * `scheduledFor = supplyUpdatedAt` is what makes it once-per-period: the claim
 * is unique on (user, kind, refId, scheduledFor), so the same count can never
 * fire twice however many ticks run, and recording a refill moves
 * supplyUpdatedAt, which opens a new period.
 */
async function planRefills(user, tz, now, messages) {
  // Not at 3 a.m. A refill is never urgent enough to wake anybody.
  const { hour } = localPartsIn(now, tz);
  if (!(hour >= 10 && hour < 20)) return;

  const meds = await Medication.findAll({
    where: {
      userId: user.id,
      active: true,
      supplyCount: { [Op.ne]: null },
      refillReminderDays: { [Op.ne]: null },
    },
    raw: true,
  });
  // as-needed meds have no rate, so there is nothing to be running low against
  const tracked = meds.filter((m) => resolvePattern(m).kind !== "as_needed");
  if (tracked.length === 0) return;

  const earliest = new Date(Math.min(
    ...tracked.map((m) => (m.supplyUpdatedAt ? new Date(m.supplyUpdatedAt).getTime() : 0)),
  ));
  const logs = await MedicationLog.findAll({
    attributes: ["medicationId", "date", "scheduledTime", "status", "takenAt", "createdAt"],
    where: {
      userId: user.id,
      medicationId: { [Op.in]: tracked.map((m) => m.id) },
      status: "taken",
      createdAt: { [Op.gte]: earliest },
    },
    raw: true,
  });

  for (const med of tracked) {
    const status = supplyStatus(med, logs.filter((l) => l.medicationId === med.id), now);
    if (!status || !status.low) continue;
    if (!(await claim(user.id, "refill", med.id, med.supplyUpdatedAt))) continue;

    const n = status.daysLeft;
    messages.push({
      userId: user.id,
      title: `Running low on ${med.name}`,
      body: n > 0
        ? (n === 1 ? "About 1 day left, by your count." : `About ${n} days left, by your count.`)
        : "By your count, it may be time for a refill.",
      data: { kind: "refill", medicationId: med.id },
    });
  }
}


/**
 * The "did it help?" follow-up, one per dose, an hour afterwards.
 *
 * `claim` is keyed on the MedicationLog id, so a dose can only ever prompt
 * once. Questions that would land overnight are dropped rather than deferred:
 * the chips are in the app whenever they want them, and a 2 a.m. notification
 * asking how a dose went is worse than no notification.
 */
async function planPrnFollowups(user, tz, now, messages) {
  const meds = await Medication.findAll({
    where: { userId: user.id, active: true },
    raw: true,
  });
  const prn = meds.filter((m) => resolvePattern(m).kind === "as_needed");
  if (prn.length === 0) return;

  const windowEnd = now;
  const windowStart = new Date(now.getTime() - LOOKBACK_MINUTES * 60 * 1000);
  // far enough back to catch any dose whose question falls in this window
  const since = new Date(
    windowStart.getTime() - (PRN_FOLLOWUP_MINUTES + LOOKBACK_MINUTES) * 60 * 1000,
  );

  const logs = await MedicationLog.findAll({
    where: {
      userId: user.id,
      medicationId: { [Op.in]: prn.map((m) => m.id) },
      status: "taken",
      helped: null,
      takenAt: { [Op.gte]: since },
    },
    raw: true,
  });

  for (const med of prn) {
    const mine = logs.filter((l) => l.medicationId === med.id);
    for (const { log, due } of prnFollowupsInWindow(
      med, mine, windowStart, windowEnd, PRN_FOLLOWUP_MINUTES,
    )) {
      const { hour } = localPartsIn(due, tz);
      // 22:00-08:00 local: let it go, they can answer in the app
      if (hour >= 22 || hour < 8) continue;
      if (!(await claim(user.id, "prn_followup", log.id, due))) continue;

      messages.push({
        userId: user.id,
        title: `Did ${med.name} help?`,
        body: "Tap to note how it went — only if you want to.",
        data: { kind: "prn_followup", logId: log.id, medicationId: med.id },
      });
    }
  }
}

async function planRemovals(user, tz, now, messages) {
  const patches = await Medication.findAll({
    where: { userId: user.id, active: true, type: "patch", removalOffsetHours: { [Op.ne]: null } },
    raw: true,
  });
  if (patches.length === 0) return;

  const windowEnd = now;
  const windowStart = new Date(now.getTime() - LOOKBACK_MINUTES * 60000);
  const maxOffset = Math.max(...patches.map((p) => p.removalOffsetHours || 0));
  // only doses recent enough that their removal could fall in this window
  const since = new Date(windowStart.getTime() - (maxOffset + 1) * 60 * 60 * 1000);

  const logs = await MedicationLog.findAll({
    where: {
      userId: user.id,
      medicationId: { [Op.in]: patches.map((p) => p.id) },
      status: "taken",
      takenAt: { [Op.gte]: since },
    },
    raw: true,
  });
  if (logs.length === 0) return;

  for (const med of patches) {
    const mine = logs.filter((l) => l.medicationId === med.id);
    for (const { due } of removalsInWindow(med, mine, windowStart, windowEnd)) {
      if (!(await claim(user.id, "removal", med.id, due))) continue;
      messages.push({
        userId: user.id,
        title: `Time to remove your ${med.name}`,
        body: med.notes ? med.notes : `It's been ${med.removalOffsetHours} ${med.removalOffsetHours === 1 ? "hour" : "hours"}.`,
        data: { kind: "removal", medicationId: med.id },
      });
    }
  }
}

/**
 * The evening-before reminder and the after-visit "how did it go?". When each
 * is due is decided in lib/apptSchedule.js; this only reads and claims.
 */
async function planAppointments(user, tz, now, prefs, messages) {
  // Bounds wide enough for every instant this tick could be responsible for:
  // −18h reaches a visit at 21:xx whose follow-up was deferred to 09:00 the
  // next morning (about 12h later, plus the 2h delay, plus slack); +32h reaches
  // a 23:59 visit tomorrow whose reminder is 18:00 today (~30h ahead), plus a
  // daylight-saving hour.
  const appts = await Appointment.findAll({
    where: {
      userId: user.id,
      status: "upcoming",
      date: { [Op.between]: [new Date(now.getTime() - 18 * 3600000), new Date(now.getTime() + 32 * 3600000)] },
    },
    raw: true,
  });
  if (appts.length === 0) return;

  const windowStart = new Date(now.getTime() - LOOKBACK_MINUTES * 60000);
  for (const item of apptNotificationsInWindow(appts, tz, windowStart, now)) {
    const { appt } = item;
    if (item.kind === "appt_reminder") {
      if (!prefs.appointmentReminders) continue;
      // the morning one exists only for visits booked after the evening had
      // passed; if the evening one went out, this visit is already covered
      if (item.variant === "morning") {
        const evening = await NotificationLog.findOne({
          where: { userId: user.id, kind: "appt_reminder", refId: appt.id, scheduledFor: item.eveningInstant },
        });
        if (evening) continue;
      }
      if (!(await claim(user.id, "appt_reminder", appt.id, item.scheduledFor))) continue;
      messages.push({
        userId: user.id,
        ...reminderCopy(appt, tz, item.variant),
        data: { kind: "appt_reminder", appointmentId: appt.id },
      });
    } else {
      if (!prefs.appointmentFollowups) continue;
      // once per appointment ever, even if its date was edited afterwards
      const asked = await NotificationLog.findOne({
        where: { userId: user.id, kind: "appt_followup", refId: appt.id },
      });
      if (asked) continue;
      if (!(await claim(user.id, "appt_followup", appt.id, item.scheduledFor))) continue;
      messages.push({
        userId: user.id,
        ...followupCopy(appt),
        data: { kind: "appt_followup", appointmentId: appt.id },
      });
    }
  }
}

async function planNudge(user, tz, now, messages) {
  const local = localPartsIn(now, tz);
  const [nh, nm] = NUDGE_AT.split(":").map(Number);
  if (local.minutes < nh * 60 + nm) return;

  const already = await CheckIn.findOne({ where: { userId: user.id, date: local.date } });
  if (already) return;

  // one instant per user per local day, so the dedupe key is stable
  const scheduledFor = instantForLocal(local.date, NUDGE_AT, tz);
  if (!(await claim(user.id, "nudge", 0, scheduledFor))) return;

  messages.push({
    userId: user.id,
    title: "Chronically",
    body: nudgeLine(user.id, local.date),
    data: { kind: "nudge", date: local.date },
  });
}

// ── Sending ─────────────────────────────────────────────────────────────────

async function deliver(messages, tokensByUser) {
  const payloads = [];
  for (const m of messages) {
    for (const row of tokensByUser.get(m.userId) || []) {
      if (!Expo.isExpoPushToken(row.token)) continue;
      payloads.push({
        to: row.token,
        sound: "default",
        title: m.title,
        body: m.body,
        data: m.data,
        channelId: "default",
      });
    }
  }
  if (payloads.length === 0) return { sent: 0, pruned: 0 };

  let sent = 0;
  const dead = new Set();
  for (const chunk of expo.chunkPushNotifications(payloads)) {
    let tickets;
    try {
      tickets = await expo.sendPushNotificationsAsync(chunk);
    } catch (err) {
      console.error("Push chunk failed:", err);
      continue;
    }
    tickets.forEach((ticket, i) => {
      if (ticket.status === "ok") { sent += 1; return; }
      // the device uninstalled or the token was revoked — stop writing to it
      if (ticket.details?.error === "DeviceNotRegistered") dead.add(chunk[i].to);
      else console.error("Push ticket error:", ticket.message, ticket.details);
    });
  }

  let pruned = 0;
  if (dead.size > 0) {
    pruned = await PushToken.destroy({ where: { token: { [Op.in]: [...dead] } } });
  }
  return { sent, pruned };
}

// ── The tick ────────────────────────────────────────────────────────────────

/**
 * One scheduler pass. Exported so it can be invoked directly in a REPL or test
 * without waiting on cron; `send` is injectable so a test can exercise the
 * planning logic without posting to Expo.
 */
async function runTick(now = new Date(), send = deliver) {
  const tokens = await PushToken.findAll({ raw: true });
  if (tokens.length === 0) return { users: 0, sent: 0, pruned: 0 };

  const tokensByUser = new Map();
  for (const t of tokens) {
    if (!tokensByUser.has(t.userId)) tokensByUser.set(t.userId, []);
    tokensByUser.get(t.userId).push(t);
  }

  const users = await User.findAll({
    where: { id: { [Op.in]: [...tokensByUser.keys()] } },
    attributes: ["id", "notificationPrefs", "timezone"],
    raw: true,
  });

  const messages = [];
  for (const user of users) {
    const prefs = prefsOf(user);
    if (!prefs.enabled) continue;

    const tz = isValidTimezone(user.timezone) ? user.timezone : DEFAULT_TIMEZONE;
    const segments = windowSegments(now, tz);

    try {
      if (prefs.medReminders) {
        // A dose reminder at the wrong hour is worse than none, so a user whose
        // device has never reported a zone gets no medication reminders — only
        // the nudge, where being off by hours is merely untidy.
        if (isValidTimezone(user.timezone)) {
          await planMedReminders(user, tz, segments, messages);
          await planRemovals(user, tz, now, messages);
        }
      }
      // Same timezone rule as dose reminders: a push at the wrong hour is
      // worse than none, and this one is explicitly hour-bounded.
      if (prefs.refillReminders && isValidTimezone(user.timezone)) {
        await planRefills(user, tz, now, messages);
      }
      // same timezone rule: the question is time-of-day sensitive
      if (prefs.prnFollowups && isValidTimezone(user.timezone)) {
        await planPrnFollowups(user, tz, now, messages);
      }
      // Same timezone rule: "the evening before" and "the next morning" mean
      // nothing at a guessed hour, so no zone means no appointment pushes.
      if ((prefs.appointmentReminders || prefs.appointmentFollowups) && isValidTimezone(user.timezone)) {
        await planAppointments(user, tz, now, prefs, messages);
      }
      if (prefs.checkinNudge) await planNudge(user, tz, now, messages);
    } catch (err) {
      // one bad user must not stop everyone else's reminders
      console.error(`Notification planning failed for user ${user.id}:`, err);
    }
  }

  const { sent, pruned } = await send(messages, tokensByUser);
  return { users: users.length, queued: messages.length, messages, sent, pruned };
}

let task = null;

function startNotificationScheduler() {
  if (task) return task;
  task = cron.schedule(TICK_CRON, async () => {
    try {
      const result = await runTick();
      if (result.queued) console.log("Notification tick:", result);
    } catch (err) {
      console.error("Notification tick failed:", err);
    }
  });
  console.log(`Notification scheduler started (${TICK_CRON})`);
  return task;
}

module.exports = { startNotificationScheduler, runTick, deliver, windowSegments, nudgeLine, NUDGE_LINES };
