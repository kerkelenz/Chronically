const { Op } = require("sequelize");
const cron = require("node-cron");
const User = require("../models/User");
const CheckIn = require("../models/CheckIn");
const WeatherDay = require("../models/WeatherDay");
const { fetchWeatherForDay } = require("../lib/weather");

// How far back the nightly backfill looks for check-in days that never got
// weather — a failed fetch, an outage, or a location set after the fact.
const BACKFILL_DAYS = 7;
// These are free-tier calls against someone else's service. A short pause
// between users keeps us a good citizen; nothing here is time-critical.
const PER_USER_DELAY_MS = 250;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const todayStr = () => new Date().toLocaleDateString("en-CA");

/**
 * Ensure a WeatherDay exists for this user and date.
 * Returns "skipped" | "exists" | "created" | "empty" — or throws, so callers
 * decide how loudly to fail. Nothing here is allowed to matter to a check-in.
 */
async function ensureWeatherDay(user, dateStr) {
  if (!user?.weatherLat || !user?.weatherLon) return "skipped";

  const existing = await WeatherDay.findOne({ where: { userId: user.id, date: dateStr } });
  if (existing) return "exists";

  const row = await fetchWeatherForDay(user.weatherLat, user.weatherLon, dateStr, todayStr());
  if (!row) return "empty";

  try {
    await WeatherDay.create({ userId: user.id, date: dateStr, ...row });
  } catch (err) {
    // the unique index is the arbiter: two check-ins saved at once race here,
    // and losing the race just means somebody else already wrote the day
    if (err.name === "SequelizeUniqueConstraintError") return "exists";
    throw err;
  }
  return "created";
}

/**
 * Fire-and-forget capture for the check-in path.
 *
 * Deliberately not awaited by the caller and deliberately unable to throw: a
 * weather hiccup must never slow down or fail somebody logging how they feel.
 */
function captureWeatherInBackground(user, dateStr) {
  Promise.resolve()
    .then(() => ensureWeatherDay(user, dateStr))
    .catch((err) => {
      // logged, never surfaced — the check-in already succeeded
      console.error(`Weather capture failed for user ${user?.id} on ${dateStr}:`, err.message);
    });
}

/**
 * Nightly sweep: for every user with a location, fill any missing WeatherDay
 * rows for dates they actually checked in on in the last week.
 */
async function runWeatherBackfill() {
  const since = new Date();
  since.setDate(since.getDate() - BACKFILL_DAYS);
  const sinceStr = since.toLocaleDateString("en-CA");

  const users = await User.findAll({
    where: { weatherLat: { [Op.ne]: null }, weatherLon: { [Op.ne]: null } },
    attributes: ["id", "weatherLat", "weatherLon"],
  });

  let created = 0, checked = 0, failed = 0;

  for (const user of users) {
    try {
      const checkIns = await CheckIn.findAll({
        where: { userId: user.id, date: { [Op.gte]: sinceStr } },
        attributes: ["date"],
        group: ["date"],
        raw: true,
      });
      const dates = [...new Set(checkIns.map((c) => c.date))];
      if (dates.length === 0) continue;

      const have = await WeatherDay.findAll({
        where: { userId: user.id, date: { [Op.in]: dates } },
        attributes: ["date"],
        raw: true,
      });
      const haveSet = new Set(have.map((w) => w.date));

      for (const date of dates) {
        if (haveSet.has(date)) continue;
        checked += 1;
        try {
          if ((await ensureWeatherDay(user, date)) === "created") created += 1;
        } catch (err) {
          failed += 1;
          console.error(`Weather backfill failed for user ${user.id} on ${date}:`, err.message);
        }
        await sleep(PER_USER_DELAY_MS);
      }
    } catch (err) {
      failed += 1;
      console.error(`Weather backfill failed for user ${user.id}:`, err.message);
    }
  }

  return { users: users.length, missing: checked, created, failed };
}

// Nightly, off-peak. Nothing here is urgent — it only repairs days the
// check-in path already tried and missed.
const BACKFILL_CRON = "30 3 * * *";

let task = null;

function startWeatherBackfill() {
  if (task) return task;
  task = cron.schedule(BACKFILL_CRON, async () => {
    try {
      const result = await runWeatherBackfill();
      if (result.created || result.failed) console.log("Weather backfill:", result);
    } catch (err) {
      console.error("Weather backfill failed:", err);
    }
  });
  console.log(`Weather backfill scheduled (${BACKFILL_CRON})`);
  return task;
}

module.exports = {
  BACKFILL_DAYS,
  BACKFILL_CRON,
  startWeatherBackfill,
  ensureWeatherDay,
  captureWeatherInBackground,
  runWeatherBackfill,
};
