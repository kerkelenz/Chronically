const {
  isMonthKey,
  monthOf,
  monthRange,
  shiftDate,
  shiftMonth,
  summarizeMonth,
} = require("./spoonCalendar");

describe("isMonthKey", () => {
  test("accepts well-formed month keys", () => {
    expect(isMonthKey("2026-01")).toBe(true);
    expect(isMonthKey("2026-12")).toBe(true);
  });

  test("rejects anything else", () => {
    for (const bad of ["2026-00", "2026-13", "2026-1", "26-01", "2026-01-05", "", null, 202601]) {
      expect(isMonthKey(bad)).toBe(false);
    }
  });
});

describe("monthRange", () => {
  test("covers the whole month", () => {
    expect(monthRange("2026-09")).toEqual({
      start: "2026-09-01",
      end: "2026-09-30",
      days: 30,
    });
  });

  test("handles 31-day months and leap Februaries", () => {
    expect(monthRange("2026-01").end).toBe("2026-01-31");
    expect(monthRange("2026-02").end).toBe("2026-02-28");
    expect(monthRange("2024-02").end).toBe("2024-02-29");
    expect(monthRange("2000-02").days).toBe(29); // divisible by 400 - still a leap year
    expect(monthRange("1900-02").days).toBe(28); // divisible by 100 but not 400
  });

  test("throws on a malformed month", () => {
    expect(() => monthRange("2026-13")).toThrow();
  });
});

describe("monthOf", () => {
  test("extracts the month key from a date", () => {
    expect(monthOf("2026-09-16")).toBe("2026-09");
  });
});

describe("shiftDate", () => {
  test("steps forwards and backwards", () => {
    expect(shiftDate("2026-09-16", 1)).toBe("2026-09-17");
    expect(shiftDate("2026-09-16", -1)).toBe("2026-09-15");
  });

  test("crosses month and year boundaries", () => {
    expect(shiftDate("2026-09-30", 1)).toBe("2026-10-01");
    expect(shiftDate("2026-03-01", -1)).toBe("2026-02-28");
    expect(shiftDate("2024-03-01", -1)).toBe("2024-02-29");
    expect(shiftDate("2025-12-31", 1)).toBe("2026-01-01");
  });
});

describe("shiftMonth", () => {
  test("steps forwards and backwards across years", () => {
    expect(shiftMonth("2026-09", 1)).toBe("2026-10");
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftMonth("2026-06", -6)).toBe("2025-12");
  });
});

describe("summarizeMonth", () => {
  const days = [
    { id: 2, date: "2026-09-02", budget: 12, budgetEdited: false },
    { id: 1, date: "2026-09-01", budget: 10, budgetEdited: true },
    { id: 3, date: "2026-09-05", budget: 14, budgetEdited: false },
  ];
  const entries = [
    { spoonDayId: 1, cost: 6, completed: true },
    { spoonDayId: 1, cost: 5, completed: false },
    { spoonDayId: 2, cost: 4, completed: true },
  ];

  test("rolls entries up per day and sorts by date", () => {
    const result = summarizeMonth({ days, entries });
    expect(result.map((d) => d.date)).toEqual([
      "2026-09-01",
      "2026-09-02",
      "2026-09-05",
    ]);
    expect(result[0]).toEqual({
      date: "2026-09-01",
      budget: 10,
      budgetEdited: true,
      spent: 11, // over its 10-spoon budget
      planned: 2,
      completed: 1,
      reflection: null,
      hasNote: false,
    });
    expect(result[1]).toMatchObject({ spent: 4, planned: 1, completed: 1 });
  });

  test("a day with no entries still reports its budget", () => {
    const result = summarizeMonth({ days, entries });
    expect(result[2]).toEqual({
      date: "2026-09-05",
      budget: 14,
      budgetEdited: false,
      spent: 0,
      planned: 0,
      completed: 0,
      reflection: null,
      hasNote: false,
    });
  });

  test("dates come back as strings even when the driver hands back Dates", () => {
    const result = summarizeMonth({
      days: [{ id: 9, date: "2026-09-07", budget: 8, budgetEdited: false }],
      entries: [],
    });
    expect(typeof result[0].date).toBe("string");
  });

  test("empty input gives an empty month", () => {
    expect(summarizeMonth()).toEqual([]);
    expect(summarizeMonth({ days: [], entries: [] })).toEqual([]);
  });
});

// ── isDateKey ────────────────────────────────────────────────────────────────
describe("isDateKey", () => {
  const { isDateKey } = require("./spoonCalendar");

  test("accepts real dates", () => {
    for (const d of ["2026-01-01", "2026-12-31", "2026-10-08", "2028-02-29"]) {
      expect(isDateKey(d)).toBe(true);
    }
  });

  test("rejects a February 29 that does not exist", () => {
    expect(isDateKey("2027-02-29")).toBe(false);
    expect(isDateKey("2026-02-29")).toBe(false);
  });

  test("rejects days that do not exist", () => {
    for (const d of ["2026-02-30", "2026-04-31", "2026-13-01", "2026-00-10"]) {
      expect(isDateKey(d)).toBe(false);
    }
  });

  test("rejects junk", () => {
    for (const d of ["2026-1-1", "26-01-01", "2026/01/01", "2026-01", "", null, undefined, 20261008, {}]) {
      expect(isDateKey(d)).toBe(false);
    }
  });
});

// ── weekRange ────────────────────────────────────────────────────────────────
describe("weekRange", () => {
  const { weekRange } = require("./spoonCalendar");

  const spanDays = (start, end) => {
    const u = (d) => {
      const [y, m, dd] = d.split("-").map(Number);
      return Date.UTC(y, m - 1, dd);
    };
    return Math.round((u(end) - u(start)) / 86400000);
  };

  test("a Wednesday lands in its Sunday-to-Saturday week", () => {
    expect(weekRange("2026-10-07")).toEqual({ start: "2026-10-04", end: "2026-10-10" });
  });

  test("a Sunday is its own week start", () => {
    expect(weekRange("2026-10-04")).toEqual({ start: "2026-10-04", end: "2026-10-10" });
  });

  test("a Saturday looks back to the previous Sunday", () => {
    expect(weekRange("2026-10-10")).toEqual({ start: "2026-10-04", end: "2026-10-10" });
  });

  test("a week spanning two months", () => {
    expect(weekRange("2026-09-30")).toEqual({ start: "2026-09-27", end: "2026-10-03" });
  });

  test("a week spanning two years", () => {
    expect(weekRange("2027-01-01")).toEqual({ start: "2026-12-27", end: "2027-01-02" });
  });

  test("a daylight-saving week is still seven days", () => {
    // US spring forward 2026-03-08, fall back 2026-11-01
    for (const d of ["2026-03-08", "2026-03-11", "2026-11-01", "2026-11-04"]) {
      const { start, end } = weekRange(d);
      expect(spanDays(start, end)).toBe(6);
    }
  });

  test("every day of one week maps to the same range", () => {
    const week = weekRange("2026-10-04");
    for (let i = 0; i < 7; i++) {
      const d = new Date(Date.UTC(2026, 9, 4 + i)).toISOString().slice(0, 10);
      expect(weekRange(d)).toEqual(week);
    }
  });

  test("throws on an invalid date key", () => {
    expect(() => weekRange("2026-02-30")).toThrow();
    expect(() => weekRange("nope")).toThrow();
  });
});

// ── summarizeDays: the reflection fields ─────────────────────────────────────
describe("summarizeDays reflections", () => {
  const { summarizeDays } = require("./spoonCalendar");

  test("carries the reflection through", () => {
    const out = summarizeDays({
      days: [{ id: 1, date: "2026-10-05", budget: 10, reflection: "heavier", reflectionNote: "long day" }],
      entries: [],
    });
    expect(out[0].reflection).toBe("heavier");
    expect(out[0].hasNote).toBe(true);
  });

  test("a whitespace-only note does not count as a note", () => {
    const out = summarizeDays({
      days: [{ id: 1, date: "2026-10-05", budget: 10, reflection: "lighter", reflectionNote: "   " }],
      entries: [],
    });
    expect(out[0].hasNote).toBe(false);
  });

  test("a day without the fields reports null and false", () => {
    const out = summarizeDays({ days: [{ id: 1, date: "2026-10-05", budget: 10 }], entries: [] });
    expect(out[0].reflection).toBeNull();
    expect(out[0].hasNote).toBe(false);
  });

  test("the note text never appears in a summary", () => {
    const out = summarizeDays({
      days: [{ id: 1, date: "2026-10-05", budget: 10, reflection: "heavier", reflectionNote: "secret" }],
      entries: [],
    });
    expect(JSON.stringify(out)).not.toContain("secret");
  });

  test("summarizeMonth is still exported, as the same function", () => {
    const mod = require("./spoonCalendar");
    expect(mod.summarizeMonth).toBe(mod.summarizeDays);
  });
});

// ── localToday ───────────────────────────────────────────────────────────────
describe("localToday", () => {
  const { localToday } = require("./spoonCalendar");

  test("uses the stored zone", () => {
    expect(localToday(new Date("2026-10-09T03:00:00Z"), "America/Los_Angeles")).toBe("2026-10-08");
    expect(localToday(new Date("2026-10-08T12:00:00Z"), "Pacific/Auckland")).toBe("2026-10-09");
  });

  test("with no zone it is generous by a day, so nobody is told their today is the future", () => {
    expect(localToday(new Date("2026-10-09T03:00:00Z"), null)).toBe("2026-10-10");
    expect(localToday(new Date("2026-10-09T03:00:00Z"), undefined)).toBe("2026-10-10");
    expect(localToday(new Date("2026-10-09T03:00:00Z"), "Mars/Base")).toBe("2026-10-10");
    expect(localToday(new Date("2026-10-09T03:00:00Z"), 42)).toBe("2026-10-10");
  });

  test("the fallback covers the furthest zone ahead of UTC", () => {
    // Kiritimati is UTC+14, the most anyone is ever ahead
    const now = new Date("2026-10-09T23:00:00Z");
    expect(localToday(now, null) >= localToday(now, "Pacific/Kiritimati")).toBe(true);
  });
});

// ── normalizeReflection ──────────────────────────────────────────────────────
describe("normalizeReflection", () => {
  const { normalizeReflection, REFLECTIONS } = require("./spoonCalendar");

  test("each value is accepted", () => {
    expect(REFLECTIONS).toEqual(["lighter", "about_right", "heavier"]);
    for (const r of REFLECTIONS) {
      expect(normalizeReflection({ reflection: r })).toEqual({ reflection: r, reflectionNote: null });
    }
  });

  test("a bad or missing value is refused", () => {
    for (const bad of [{}, { reflection: "nope" }, { reflection: 1 }, { reflection: undefined }]) {
      expect(normalizeReflection(bad)).toEqual({ error: "Choose lighter, about right or heavier." });
    }
  });

  test("clearing the reflection clears the note, whatever was sent", () => {
    expect(normalizeReflection({ reflection: null, reflectionNote: "keep me" }, "old"))
      .toEqual({ reflection: null, reflectionNote: null });
    expect(normalizeReflection({ reflection: null }, "old"))
      .toEqual({ reflection: null, reflectionNote: null });
  });

  test("an absent note key keeps whatever was written before", () => {
    expect(normalizeReflection({ reflection: "heavier" }, "words from before"))
      .toEqual({ reflection: "heavier", reflectionNote: "words from before" });
    expect(normalizeReflection({ reflection: "heavier" }, null))
      .toEqual({ reflection: "heavier", reflectionNote: null });
  });

  test("an explicit null or an empty note removes it", () => {
    expect(normalizeReflection({ reflection: "heavier", reflectionNote: null }, "old").reflectionNote).toBeNull();
    expect(normalizeReflection({ reflection: "heavier", reflectionNote: "" }, "old").reflectionNote).toBeNull();
    expect(normalizeReflection({ reflection: "heavier", reflectionNote: "   " }, "old").reflectionNote).toBeNull();
  });

  test("a note is trimmed", () => {
    expect(normalizeReflection({ reflection: "lighter", reflectionNote: "  rested  " }).reflectionNote)
      .toBe("rested");
  });

  test("280 characters passes, 281 does not", () => {
    const at = "a".repeat(280);
    expect(normalizeReflection({ reflection: "lighter", reflectionNote: at }).reflectionNote).toBe(at);
    expect(normalizeReflection({ reflection: "lighter", reflectionNote: `  ${at}  ` }).reflectionNote).toBe(at);
    expect(normalizeReflection({ reflection: "lighter", reflectionNote: "a".repeat(281) }))
      .toEqual({ error: "Notes can be up to 280 characters." });
  });

  test("a non-string note is refused rather than coerced", () => {
    expect(normalizeReflection({ reflection: "lighter", reflectionNote: 42 }).error).toBeTruthy();
    expect(normalizeReflection({ reflection: "lighter", reflectionNote: {} }).error).toBeTruthy();
  });

  test("a note always has a reflection to belong to", () => {
    // the invariant: reflectionNote != null implies reflection != null
    const cases = [
      { reflection: null, reflectionNote: "x" },
      { reflection: "heavier", reflectionNote: "x" },
      { reflection: "heavier" },
    ];
    for (const body of cases) {
      const out = normalizeReflection(body, "existing");
      if (out.error) continue;
      if (out.reflectionNote !== null) expect(out.reflection).not.toBeNull();
    }
  });
});
