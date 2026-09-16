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
