const {
  isValidTimezone,
  localPartsIn,
  instantForLocal,
  isMedicationDueOn,
  dueTimesInWindow,
  removalsInWindow,
} = require("./medSchedule");

describe("timezone helpers", () => {
  test("rejects junk zone names", () => {
    expect(isValidTimezone("America/New_York")).toBe(true);
    expect(isValidTimezone("UTC")).toBe(true);
    expect(isValidTimezone("Not/AZone")).toBe(false);
    expect(isValidTimezone("")).toBe(false);
    expect(isValidTimezone(null)).toBe(false);
    expect(isValidTimezone(undefined)).toBe(false);
  });

  test("reads the wall clock in a zone", () => {
    // 2026-01-15T17:30Z is 12:30 in New York (EST, UTC-5)
    const p = localPartsIn(new Date("2026-01-15T17:30:00Z"), "America/New_York");
    expect(p.date).toBe("2026-01-15");
    expect(p.hour).toBe(12);
    expect(p.minute).toBe(30);
    expect(p.minutes).toBe(12 * 60 + 30);
  });

  test("a zone can be on the previous local day", () => {
    // 03:00Z on the 15th is still 22:00 on the 14th in New York
    const p = localPartsIn(new Date("2026-01-15T03:00:00Z"), "America/New_York");
    expect(p.date).toBe("2026-01-14");
    expect(p.hour).toBe(22);
  });

  test("local midnight normalises to hour 0, not 24", () => {
    const p = localPartsIn(new Date("2026-01-15T05:00:00Z"), "America/New_York");
    expect(p.date).toBe("2026-01-15");
    expect(p.hour).toBe(0);
    expect(p.minutes).toBe(0);
  });

  test("an unknown zone falls back to UTC rather than throwing", () => {
    const p = localPartsIn(new Date("2026-01-15T17:30:00Z"), "Nope/Nope");
    expect(p.hour).toBe(17);
  });

  test("instantForLocal round-trips through localPartsIn", () => {
    for (const tz of ["America/New_York", "Europe/Madrid", "Asia/Kolkata", "UTC"]) {
      const at = instantForLocal("2026-03-04", "08:00", tz);
      const back = localPartsIn(at, tz);
      expect(back.date).toBe("2026-03-04");
      expect(back.hour).toBe(8);
      expect(back.minute).toBe(0);
    }
  });

  test("instantForLocal handles a half-hour offset zone", () => {
    // Kolkata is UTC+5:30, so local 08:00 is 02:30Z
    expect(instantForLocal("2026-03-04", "08:00", "Asia/Kolkata").toISOString())
      .toBe("2026-03-04T02:30:00.000Z");
  });

  test("instantForLocal is correct on both sides of a DST change", () => {
    // US DST began 2026-03-08. 08:00 local is 13:00Z before, 12:00Z after.
    expect(instantForLocal("2026-03-07", "08:00", "America/New_York").toISOString())
      .toBe("2026-03-07T13:00:00.000Z");
    expect(instantForLocal("2026-03-09", "08:00", "America/New_York").toISOString())
      .toBe("2026-03-09T12:00:00.000Z");
  });

  test("the same wall time on the same day is one stable key", () => {
    // the dedupe index depends on this being deterministic
    const a = instantForLocal("2026-06-01", "20:00", "America/New_York");
    const b = instantForLocal("2026-06-01", "20:00", "America/New_York");
    expect(a.getTime()).toBe(b.getTime());
  });
});

describe("isMedicationDueOn", () => {
  const daily = { frequency: "daily", startDate: "2026-01-01" };

  test("daily is due every day", () => {
    expect(isMedicationDueOn(daily, "2026-03-04")).toBe(true);
  });

  test("as_needed is never due", () => {
    expect(isMedicationDueOn({ frequency: "as_needed" }, "2026-03-04")).toBe(false);
  });

  test("specific_days matches the weekday", () => {
    // 2026-03-04 is a Wednesday (3)
    expect(isMedicationDueOn({ frequency: "specific_days", daysOfWeek: [3] }, "2026-03-04")).toBe(true);
    expect(isMedicationDueOn({ frequency: "specific_days", daysOfWeek: [1, 5] }, "2026-03-04")).toBe(false);
  });

  test("every_n_days counts from the anchor and never fires before it", () => {
    const med = { frequency: "every_n_days", intervalDays: 14, startDate: "2026-03-04" };
    expect(isMedicationDueOn(med, "2026-03-04")).toBe(true);
    expect(isMedicationDueOn(med, "2026-03-18")).toBe(true);
    expect(isMedicationDueOn(med, "2026-03-11")).toBe(false);
    expect(isMedicationDueOn(med, "2026-02-18")).toBe(false);
  });

  test("legacy enums resolve like the client does", () => {
    expect(isMedicationDueOn({ frequency: "twice_daily" }, "2026-03-04")).toBe(true);
    expect(isMedicationDueOn({ frequency: "every_other_day", startDate: "2026-03-04" }, "2026-03-06")).toBe(true);
    expect(isMedicationDueOn({ frequency: "every_other_day", startDate: "2026-03-04" }, "2026-03-05")).toBe(false);
    expect(isMedicationDueOn({ frequency: "biweekly", startDate: "2026-03-04" }, "2026-03-18")).toBe(true);
  });

  test("monthly matches the anchor day of month", () => {
    const med = { frequency: "monthly", startDate: "2026-01-12" };
    expect(isMedicationDueOn(med, "2026-03-12")).toBe(true);
    expect(isMedicationDueOn(med, "2026-03-11")).toBe(false);
  });
});

describe("dueTimesInWindow", () => {
  const med = {
    active: true, frequency: "daily", startDate: "2026-01-01",
    scheduledTimes: ["08:00", "12:30", "20:00"],
  };
  const at = (hhmm) => { const [h, m] = hhmm.split(":").map(Number); return h * 60 + m; };

  test("picks only the dose inside the window", () => {
    expect(dueTimesInWindow(med, "2026-03-04", at("08:00"), 5)).toEqual(["08:00"]);
    expect(dueTimesInWindow(med, "2026-03-04", at("12:30"), 5)).toEqual(["12:30"]);
  });

  test("window is half-open, so two ticks never claim one dose", () => {
    // 07:55–08:00 must not include 08:00; 08:00–08:05 must
    expect(dueTimesInWindow(med, "2026-03-04", at("07:55"), 5)).toEqual([]);
    expect(dueTimesInWindow(med, "2026-03-04", at("08:00"), 5)).toEqual(["08:00"]);
  });

  test("a quiet window yields nothing", () => {
    expect(dueTimesInWindow(med, "2026-03-04", at("09:00"), 5)).toEqual([]);
  });

  test("inactive medications are skipped", () => {
    expect(dueTimesInWindow({ ...med, active: false }, "2026-03-04", at("08:00"), 5)).toEqual([]);
  });

  test("a day the med isn't due yields nothing", () => {
    const weekly = { ...med, frequency: "specific_days", daysOfWeek: [1] };
    expect(dueTimesInWindow(weekly, "2026-03-04", at("08:00"), 5)).toEqual([]);
  });

  test("medications with no usable time are skipped rather than guessed at", () => {
    expect(dueTimesInWindow({ ...med, scheduledTimes: [] }, "2026-03-04", at("08:00"), 5)).toEqual([]);
    expect(dueTimesInWindow({ ...med, scheduledTimes: null }, "2026-03-04", at("08:00"), 5)).toEqual([]);
    expect(dueTimesInWindow({ ...med, scheduledTimes: ["nonsense", "25:00"] }, "2026-03-04", at("08:00"), 5)).toEqual([]);
  });

  test("several doses can land in one window", () => {
    const m = { ...med, scheduledTimes: ["08:00", "08:03"] };
    expect(dueTimesInWindow(m, "2026-03-04", at("08:00"), 5)).toEqual(["08:00", "08:03"]);
  });
});

describe("removalsInWindow", () => {
  const patch = { type: "patch", removalOffsetHours: 12 };
  const win = (from, to) => [new Date(from), new Date(to)];

  test("fires when the offset elapses inside the window", () => {
    const [s, e] = win("2026-03-04T20:00:00Z", "2026-03-04T20:05:00Z");
    const logs = [{ takenAt: "2026-03-04T08:00:00Z" }];
    expect(removalsInWindow(patch, logs, s, e)).toHaveLength(1);
  });

  test("does not fire before or after the window", () => {
    const logs = [{ takenAt: "2026-03-04T08:00:00Z" }];
    expect(removalsInWindow(patch, logs, ...win("2026-03-04T19:00:00Z", "2026-03-04T19:05:00Z"))).toHaveLength(0);
    expect(removalsInWindow(patch, logs, ...win("2026-03-04T21:00:00Z", "2026-03-04T21:05:00Z"))).toHaveLength(0);
  });

  test("a patch applied days ago never back-fires", () => {
    const [s, e] = win("2026-03-04T20:00:00Z", "2026-03-04T20:05:00Z");
    expect(removalsInWindow(patch, [{ takenAt: "2026-02-20T08:00:00Z" }], s, e)).toHaveLength(0);
  });

  test("only patches, and only with an offset set", () => {
    const [s, e] = win("2026-03-04T20:00:00Z", "2026-03-04T20:05:00Z");
    const logs = [{ takenAt: "2026-03-04T08:00:00Z" }];
    expect(removalsInWindow({ type: "pill", removalOffsetHours: 12 }, logs, s, e)).toHaveLength(0);
    expect(removalsInWindow({ type: "patch", removalOffsetHours: null }, logs, s, e)).toHaveLength(0);
    expect(removalsInWindow({ type: "patch", removalOffsetHours: 0 }, logs, s, e)).toHaveLength(0);
  });

  test("a dose with no takenAt is ignored — nothing to count from", () => {
    const [s, e] = win("2026-03-04T20:00:00Z", "2026-03-04T20:05:00Z");
    expect(removalsInWindow(patch, [{ takenAt: null }], s, e)).toHaveLength(0);
  });
});
