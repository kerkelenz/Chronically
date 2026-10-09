const {
  unitsRate, countTakenUnits, supplyStatus, summarizeHelped, HELPED_WINDOW_DAYS,
} = require("./medStats");

const NOW = new Date("2026-10-09T12:00:00Z");
const ago = (days, hours = 0) =>
  new Date(NOW.getTime() - days * 86400000 - hours * 3600000);

const med = (over = {}) => ({
  frequency: "daily",
  scheduledTimes: ["08:00"],
  unitsPerDose: 1,
  supplyCount: null,
  supplyUpdatedAt: null,
  refillReminderDays: 7,
  createdAt: new Date("2026-01-01T00:00:00Z"),
  ...over,
});

const taken = (daysAgo, scheduledTime = "08:00", over = {}) => ({
  status: "taken",
  date: new Date(NOW.getTime() - daysAgo * 86400000).toISOString().slice(0, 10),
  scheduledTime,
  takenAt: ago(daysAgo),
  createdAt: ago(daysAgo),
  ...over,
});

describe("unitsRate", () => {
  test("daily with two times", () => {
    expect(unitsRate(med({ scheduledTimes: ["08:00", "20:00"] }))).toEqual({ units: 2, cycleDays: 1 });
  });

  test("an anytime daily dose counts as one", () => {
    expect(unitsRate(med({ scheduledTimes: [] }))).toEqual({ units: 1, cycleDays: 1 });
    expect(unitsRate(med({ scheduledTimes: null }))).toEqual({ units: 1, cycleDays: 1 });
  });

  test("invalid times are ignored, and all-invalid falls back to one", () => {
    expect(unitsRate(med({ scheduledTimes: ["08:00", "nope", "25:00"] }))).toEqual({ units: 1, cycleDays: 1 });
    expect(unitsRate(med({ scheduledTimes: ["nope"] }))).toEqual({ units: 1, cycleDays: 1 });
  });

  test("specific days is expressed per week, not per day", () => {
    expect(unitsRate(med({ frequency: "specific_days", daysOfWeek: [1, 3, 5] })))
      .toEqual({ units: 3, cycleDays: 7 });
  });

  test("specific days with nothing selected never comes due", () => {
    expect(unitsRate(med({ frequency: "specific_days", daysOfWeek: [] }))).toBeNull();
  });

  test("every n days", () => {
    expect(unitsRate(med({ frequency: "every_n_days", intervalDays: 14 })))
      .toEqual({ units: 1, cycleDays: 14 });
  });

  test("monthly is treated as a 30-day cycle", () => {
    expect(unitsRate(med({ frequency: "monthly" }))).toEqual({ units: 1, cycleDays: 30 });
  });

  test("as-needed and unknown patterns have no rate", () => {
    expect(unitsRate(med({ frequency: "as_needed" }))).toBeNull();
    expect(unitsRate(med({ frequency: "whatever" }))).toBeNull();
  });

  test("legacy frequencies resolve through resolvePattern", () => {
    expect(unitsRate(med({ frequency: "twice_daily", scheduledTimes: ["08:00", "20:00"] })))
      .toEqual({ units: 2, cycleDays: 1 });
    expect(unitsRate(med({ frequency: "every_other_day" }))).toEqual({ units: 1, cycleDays: 2 });
    expect(unitsRate(med({ frequency: "biweekly" }))).toEqual({ units: 1, cycleDays: 14 });
    expect(unitsRate(med({ frequency: "every_x_weeks", frequencyWeeks: 3 })))
      .toEqual({ units: 1, cycleDays: 21 });
  });

  test("unitsPerDose multiplies the rate", () => {
    expect(unitsRate(med({ unitsPerDose: 2, scheduledTimes: ["08:00", "20:00"] })))
      .toEqual({ units: 4, cycleDays: 1 });
    expect(unitsRate(med({ unitsPerDose: 0.5 }))).toEqual({ units: 0.5, cycleDays: 1 });
  });
});

describe("countTakenUnits", () => {
  test("counts taken doses since the cutoff", () => {
    const logs = [taken(1), taken(2), taken(3)];
    expect(countTakenUnits(med(), logs, ago(5))).toBe(3);
  });

  test("a duplicate row for one slot counts once", () => {
    const logs = [taken(1), { ...taken(1), takenAt: ago(1, 1) }];
    expect(countTakenUnits(med(), logs, ago(5))).toBe(1);
  });

  test("two slots on the same day both count", () => {
    const logs = [taken(1, "08:00"), taken(1, "20:00")];
    expect(countTakenUnits(med({ scheduledTimes: ["08:00", "20:00"] }), logs, ago(5))).toBe(2);
  });

  test("two as-needed doses on one day both count", () => {
    const prn = med({ frequency: "as_needed", scheduledTimes: [] });
    const logs = [taken(1, null), { ...taken(1, null), takenAt: ago(1, 3) }];
    expect(countTakenUnits(prn, logs, ago(5))).toBe(2);
  });

  test("a dose at or before the cutoff does not count", () => {
    const cutoff = ago(2);
    expect(countTakenUnits(med(), [{ ...taken(2), takenAt: cutoff }], cutoff)).toBe(0);
    expect(countTakenUnits(med(), [taken(3)], cutoff)).toBe(0);
    expect(countTakenUnits(med(), [taken(1)], cutoff)).toBe(1);
  });

  test("skipped rows never count", () => {
    expect(countTakenUnits(med(), [{ ...taken(1), status: "skipped" }], ago(5))).toBe(0);
    expect(countTakenUnits(med(), [{ ...taken(1), status: "missed" }], ago(5))).toBe(0);
  });

  test("takenAt null falls back to createdAt", () => {
    const logs = [{ ...taken(1), takenAt: null }];
    expect(countTakenUnits(med(), logs, ago(5))).toBe(1);
    expect(countTakenUnits(med(), logs, ago(0))).toBe(0);
  });

  test("unitsPerDose multiplies", () => {
    expect(countTakenUnits(med({ unitsPerDose: 2 }), [taken(1), taken(2)], ago(5))).toBe(4);
    expect(countTakenUnits(med({ unitsPerDose: 0.5 }), [taken(1)], ago(5))).toBe(0.5);
  });

  test("a null cutoff counts everything", () => {
    expect(countTakenUnits(med(), [taken(400)], null)).toBe(1);
  });

  test("tolerates junk", () => {
    expect(countTakenUnits(med(), null, ago(5))).toBe(0);
    expect(countTakenUnits(med(), [{ status: "taken", takenAt: "not a date" }], ago(5))).toBe(0);
  });
});

describe("supplyStatus", () => {
  test("not tracking", () => {
    expect(supplyStatus(med({ supplyCount: null }), [], NOW)).toBeNull();
  });

  test("daily 08:00 + 20:00, 60 counted, 19 taken since -> 41 left, 20 days", () => {
    const m = med({
      scheduledTimes: ["08:00", "20:00"], supplyCount: 60, supplyUpdatedAt: ago(30),
    });
    // exactly 19 distinct slots since the count: both doses on days 1-9, then
    // the morning of day 10
    const logs = [];
    for (let i = 1; i <= 9; i++) { logs.push(taken(i, "08:00"), taken(i, "20:00")); }
    logs.push(taken(10, "08:00"));
    expect(logs).toHaveLength(19);
    const res = supplyStatus(m, logs, NOW);
    expect(res.remaining).toBe(41);
    expect(res.daysLeft).toBe(20);
    expect(res.low).toBe(false);
    expect(res.recount).toBe(false);
  });

  test("specific days Mon/Wed/Fri once a day, 6 left -> 14 days", () => {
    const m = med({
      frequency: "specific_days", daysOfWeek: [1, 3, 5],
      supplyCount: 6, supplyUpdatedAt: ago(1),
    });
    expect(supplyStatus(m, [], NOW).daysLeft).toBe(14);
  });

  test("every 14 days, 3 left -> 42 days", () => {
    const m = med({ frequency: "every_n_days", intervalDays: 14, supplyCount: 3, supplyUpdatedAt: ago(1) });
    expect(supplyStatus(m, [], NOW).daysLeft).toBe(42);
  });

  test("monthly, 10 left -> 300 days", () => {
    const m = med({ frequency: "monthly", supplyCount: 10, supplyUpdatedAt: ago(1) });
    expect(supplyStatus(m, [], NOW).daysLeft).toBe(300);
  });

  test("anytime daily, 7 left -> 7 days", () => {
    const m = med({ scheduledTimes: [], supplyCount: 7, supplyUpdatedAt: ago(1) });
    expect(supplyStatus(m, [], NOW).daysLeft).toBe(7);
  });

  test("two units per dose, daily once, 1 left -> 0 days", () => {
    const m = med({ unitsPerDose: 2, supplyCount: 1, supplyUpdatedAt: ago(1) });
    const res = supplyStatus(m, [], NOW);
    expect(res.remaining).toBe(1);
    expect(res.daysLeft).toBe(0);
    expect(res.low).toBe(true);
  });

  test("logging more than was counted invites a recount rather than going negative", () => {
    const m = med({ supplyCount: 2, supplyUpdatedAt: ago(10) });
    const logs = [taken(1), taken(2), taken(3), taken(4)];
    const res = supplyStatus(m, logs, NOW);
    expect(res.remaining).toBe(0);
    expect(res.recount).toBe(true);
  });

  test("reminders off for this med means never low", () => {
    const m = med({ supplyCount: 1, supplyUpdatedAt: ago(1), refillReminderDays: null });
    const res = supplyStatus(m, [], NOW);
    expect(res.daysLeft).toBe(1);
    expect(res.low).toBe(false);
  });

  test("low fires at exactly the threshold", () => {
    const at = med({ supplyCount: 7, supplyUpdatedAt: ago(1), refillReminderDays: 7 });
    expect(supplyStatus(at, [], NOW).low).toBe(true);
    const above = med({ supplyCount: 8, supplyUpdatedAt: ago(1), refillReminderDays: 7 });
    expect(supplyStatus(above, [], NOW).low).toBe(false);
  });

  test("an as-needed med shows a count but never an estimate or a low flag", () => {
    const m = med({ frequency: "as_needed", scheduledTimes: [], supplyCount: 12, supplyUpdatedAt: ago(5) });
    const res = supplyStatus(m, [taken(1, null)], NOW);
    expect(res.remaining).toBe(11);
    expect(res.daysLeft).toBeNull();
    expect(res.low).toBe(false);
  });

  test("the float trap: 6 remaining on a 3-per-7-days rate is exactly 14", () => {
    // 6 * 7 / 3 = 14 exactly; 6 / (3/7) is 14.000000000000002
    const m = med({
      frequency: "specific_days", daysOfWeek: [1, 3, 5], supplyCount: 6, supplyUpdatedAt: ago(1),
    });
    expect(supplyStatus(m, [], NOW).daysLeft).toBe(14);
  });
});

describe("summarizeHelped", () => {
  const rated = (daysAgo, helped) => ({ ...taken(daysAgo, null), helped });

  test("null when nothing is rated", () => {
    expect(summarizeHelped([], NOW)).toBeNull();
    expect(summarizeHelped([taken(1, null)], NOW)).toBeNull();
    expect(summarizeHelped(null, NOW)).toBeNull();
  });

  test("counts each rating", () => {
    const logs = [rated(1, "yes"), rated(2, "yes"), rated(3, "a_little"), rated(4, "no")];
    expect(summarizeHelped(logs, NOW)).toEqual({ rated: 4, yes: 2, a_little: 1, no: 1 });
  });

  test("unrated and skipped rows are ignored", () => {
    const logs = [rated(1, "yes"), taken(2, null), { ...rated(3, "no"), status: "skipped" }];
    expect(summarizeHelped(logs, NOW)).toEqual({ rated: 1, yes: 1, a_little: 0, no: 0 });
  });

  test("a rating outside the 90-day window is ignored", () => {
    expect(summarizeHelped([rated(91, "yes")], NOW)).toBeNull();
    expect(summarizeHelped([rated(89, "yes")], NOW).rated).toBe(1);
    expect(HELPED_WINDOW_DAYS).toBe(90);
  });

  test("a junk rating value is ignored", () => {
    expect(summarizeHelped([rated(1, "maybe"), rated(2, "yes")], NOW))
      .toEqual({ rated: 1, yes: 1, a_little: 0, no: 0 });
  });
});
