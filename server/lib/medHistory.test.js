const { projectMedication, diffMedication, snapshotChanges } = require("./medHistory");

// 2026-03-04 is a Wednesday (day 3) — the anchor legacy "weekly" resolves from.
const WED = "2026-03-04";

const med = (over = {}) => ({
  type: "pill",
  dosage: "10 mg",
  frequency: "daily",
  frequencyWeeks: null,
  daysOfWeek: null,
  startDate: null,
  intervalDays: null,
  scheduledTimes: ["08:00"],
  createdAt: new Date(`${WED}T12:00:00Z`),
  ...over,
});

describe("projectMedication", () => {
  test("a daily medication", () => {
    expect(projectMedication(med())).toEqual({
      type: "pill", dosage: "10 mg", frequency: "daily",
      daysOfWeek: null, intervalDays: null, startDate: null, scheduledTimes: ["08:00"],
    });
  });

  test("dosage is trimmed, and blank becomes null", () => {
    expect(projectMedication(med({ dosage: "  20 mg  " })).dosage).toBe("20 mg");
    expect(projectMedication(med({ dosage: "" })).dosage).toBeNull();
    expect(projectMedication(med({ dosage: "   " })).dosage).toBeNull();
    expect(projectMedication(med({ dosage: null })).dosage).toBeNull();
  });

  test("times are sorted, and invalid ones dropped", () => {
    expect(projectMedication(med({ scheduledTimes: ["20:00", "08:00"] })).scheduledTimes)
      .toEqual(["08:00", "20:00"]);
    expect(projectMedication(med({ scheduledTimes: ["08:00", "nope"] })).scheduledTimes)
      .toEqual(["08:00"]);
  });

  test("no times at all is null, however it was stored", () => {
    expect(projectMedication(med({ scheduledTimes: [] })).scheduledTimes).toBeNull();
    expect(projectMedication(med({ scheduledTimes: null })).scheduledTimes).toBeNull();
  });

  test("fields that do not apply to the pattern are null, not stale", () => {
    // a daily medication with a leftover startDate and days
    const p = projectMedication(med({ startDate: WED, daysOfWeek: [1, 2] }));
    expect(p.startDate).toBeNull();
    expect(p.daysOfWeek).toBeNull();
    expect(p.intervalDays).toBeNull();
  });

  test("as-needed has no times", () => {
    expect(projectMedication(med({ frequency: "as_needed", scheduledTimes: ["08:00"] })).scheduledTimes)
      .toBeNull();
  });

  test("specific days are sorted", () => {
    expect(projectMedication(med({ frequency: "specific_days", daysOfWeek: [5, 1, 3] })).daysOfWeek)
      .toEqual([1, 3, 5]);
  });

  test("every_n_days keeps its interval and anchor", () => {
    const p = projectMedication(med({ frequency: "every_n_days", intervalDays: 14, startDate: WED }));
    expect(p.intervalDays).toBe(14);
    expect(p.startDate).toBe(WED);
  });
});

describe("diffMedication — the legacy rewrites must not look like changes", () => {
  test("legacy weekly becomes specific_days on the same weekday: no diff", () => {
    const before = med({ frequency: "weekly", startDate: WED, daysOfWeek: null });
    // what the edit form submits after the user opens and saves without changes
    const after = med({ frequency: "specific_days", daysOfWeek: [3], startDate: null });
    expect(diffMedication(projectMedication(before), projectMedication(after))).toEqual([]);
  });

  test("legacy every_x_weeks x2 becomes every_n_days 14: no diff", () => {
    const before = med({ frequency: "every_x_weeks", frequencyWeeks: 2, startDate: WED });
    const after = med({ frequency: "every_n_days", intervalDays: 14, startDate: WED });
    expect(diffMedication(projectMedication(before), projectMedication(after))).toEqual([]);
  });

  test("legacy biweekly becomes every_n_days 14: no diff", () => {
    const before = med({ frequency: "biweekly", startDate: WED });
    const after = med({ frequency: "every_n_days", intervalDays: 14, startDate: WED });
    expect(diffMedication(projectMedication(before), projectMedication(after))).toEqual([]);
  });

  test("legacy every_other_day becomes every_n_days 2: no diff", () => {
    const before = med({ frequency: "every_other_day", startDate: WED });
    const after = med({ frequency: "every_n_days", intervalDays: 2, startDate: WED });
    expect(diffMedication(projectMedication(before), projectMedication(after))).toEqual([]);
  });

  test("twice_daily becomes daily with the same times: no diff", () => {
    const before = med({ frequency: "twice_daily", scheduledTimes: ["08:00", "20:00"] });
    const after = med({ frequency: "daily", scheduledTimes: ["08:00", "20:00"] });
    expect(diffMedication(projectMedication(before), projectMedication(after))).toEqual([]);
  });

  test("reordered times: no diff", () => {
    const before = med({ scheduledTimes: ["08:00", "20:00"] });
    const after = med({ scheduledTimes: ["20:00", "08:00"] });
    expect(diffMedication(projectMedication(before), projectMedication(after))).toEqual([]);
  });

  test("[] versus null times: no diff", () => {
    const before = med({ scheduledTimes: [] });
    const after = med({ scheduledTimes: null });
    expect(diffMedication(projectMedication(before), projectMedication(after))).toEqual([]);
  });

  test("a startDate change on a daily medication: no diff", () => {
    const before = med({ startDate: null });
    const after = med({ startDate: "2026-04-01" });
    expect(diffMedication(projectMedication(before), projectMedication(after))).toEqual([]);
  });

  test("an identical medication: no diff", () => {
    expect(diffMedication(projectMedication(med()), projectMedication(med()))).toEqual([]);
  });
});

describe("diffMedication — real changes", () => {
  test("a dosage change, with whitespace ignored", () => {
    const out = diffMedication(projectMedication(med({ dosage: "10 mg" })),
      projectMedication(med({ dosage: " 20 mg " })));
    expect(out).toEqual([{ field: "dosage", from: "10 mg", to: "20 mg" }]);
  });

  test("a form change", () => {
    const out = diffMedication(projectMedication(med()), projectMedication(med({ type: "patch" })));
    expect(out).toEqual([{ field: "type", from: "pill", to: "patch" }]);
  });

  test("daily to as_needed reports the frequency and the lost times", () => {
    const out = diffMedication(projectMedication(med()),
      projectMedication(med({ frequency: "as_needed" })));
    expect(out.map((c) => c.field).sort()).toEqual(["frequency", "scheduledTimes"]);
    expect(out.find((c) => c.field === "frequency")).toEqual({ field: "frequency", from: "daily", to: "as_needed" });
    expect(out.find((c) => c.field === "scheduledTimes").to).toBeNull();
  });

  test("adding a dose time", () => {
    const out = diffMedication(projectMedication(med({ scheduledTimes: ["08:00"] })),
      projectMedication(med({ scheduledTimes: ["08:00", "20:00"] })));
    expect(out).toEqual([{ field: "scheduledTimes", from: ["08:00"], to: ["08:00", "20:00"] }]);
  });

  test("changing which days", () => {
    const before = med({ frequency: "specific_days", daysOfWeek: [1, 3] });
    const after = med({ frequency: "specific_days", daysOfWeek: [1, 3, 5] });
    expect(diffMedication(projectMedication(before), projectMedication(after)))
      .toEqual([{ field: "daysOfWeek", from: [1, 3], to: [1, 3, 5] }]);
  });

  test("changing the interval", () => {
    const before = med({ frequency: "every_n_days", intervalDays: 14, startDate: WED });
    const after = med({ frequency: "every_n_days", intervalDays: 21, startDate: WED });
    expect(diffMedication(projectMedication(before), projectMedication(after)))
      .toEqual([{ field: "intervalDays", from: 14, to: 21 }]);
  });

  test("changing the anchor of a pattern that uses one", () => {
    const before = med({ frequency: "every_n_days", intervalDays: 14, startDate: WED });
    const after = med({ frequency: "every_n_days", intervalDays: 14, startDate: "2026-03-11" });
    expect(diffMedication(projectMedication(before), projectMedication(after)))
      .toEqual([{ field: "startDate", from: WED, to: "2026-03-11" }]);
  });

  test("name and notes are never tracked", () => {
    const out = diffMedication(projectMedication(med({ name: "A", notes: "x" })),
      projectMedication(med({ name: "B", notes: "y" })));
    expect(out).toEqual([]);
  });
});

describe("snapshotChanges", () => {
  test("every field that has a value, as from null", () => {
    expect(snapshotChanges(med())).toEqual([
      { field: "type", from: null, to: "pill" },
      { field: "dosage", from: null, to: "10 mg" },
      { field: "frequency", from: null, to: "daily" },
      { field: "scheduledTimes", from: null, to: ["08:00"] },
    ]);
  });

  test("fields with no value are left out entirely", () => {
    const out = snapshotChanges(med({ dosage: null, scheduledTimes: [] }));
    expect(out.map((c) => c.field)).toEqual(["type", "frequency"]);
  });

  test("a specific-days medication records its days", () => {
    const out = snapshotChanges(med({ frequency: "specific_days", daysOfWeek: [1, 5] }));
    expect(out.find((c) => c.field === "daysOfWeek").to).toEqual([1, 5]);
  });

  test("an as-needed medication records no times", () => {
    const out = snapshotChanges(med({ frequency: "as_needed" }));
    expect(out.find((c) => c.field === "scheduledTimes")).toBeUndefined();
    expect(out.find((c) => c.field === "frequency").to).toBe("as_needed");
  });
});
