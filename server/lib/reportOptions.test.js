// The report-options helper lives on the clients (web and phone), not here —
// but it decides what a doctor sees, so it is tested where the rest of the pure
// logic is. Reads the client file as text and evaluates it, the technique of
// flares.test.js, after checking the phone's copy is byte-identical.
const fs = require("fs");
const path = require("path");

const WEB = path.join(__dirname, "../../client/src/utils/reportOptions.js");
const MOBILE = path.join(__dirname, "../../mobile/theme/reportOptions.js");
const NAMES = [
  "REPORT_SECTIONS", "SECTION_KEYS", "RANGE_PRESETS", "DEFAULT_PRESET", "MAX_RANGE_DAYS", "CHECKIN_FETCH_CAP",
  "isYmd", "addDays", "dayCount", "eachDay", "resolveReportOptions", "rangeTitles", "describeRange",
  "chartLabelStep", "flaresInRange", "flareSummaryLine", "flareReportLine", "medChangesInRange",
  "helpedRows", "helpedReportLine", "truncationNote", "normalizeReportPrefs", "isDefaultPrefs", "prefsSummary",
];
const load = (file) => {
  const src = fs.readFileSync(file, "utf8").replace(/^export /gm, "");
  // eslint-disable-next-line no-new-func
  return new Function(`${src}; return { ${NAMES.join(", ")} };`)();
};
const R = load(WEB);
const TODAY = "2026-10-09";

describe("reportOptions pair", () => {
  test("the client file was actually parsed", () => {
    for (const n of NAMES) expect(R[n]).toBeDefined();
    expect(typeof R.resolveReportOptions).toBe("function");
  });

  test("the mobile copy is byte-identical to the web one", () => {
    expect(fs.readFileSync(MOBILE, "utf8")).toBe(fs.readFileSync(WEB, "utf8"));
  });

  test("seventeen sections, in print order", () => {
    expect(R.SECTION_KEYS).toEqual([
      "glance", "trend", "averages", "notable", "flares", "symptoms", "patterns",
      "medications", "medChanges", "adherence", "helped", "skipReasons", "appointments",
      "dailyLog", "weather", "notes", "medLog",
    ]);
  });
});

describe("resolveReportOptions", () => {
  test("nothing passed is today's report: today − 30 … today, every section", () => {
    for (const opts of [undefined, {}, { from: "nope", to: 42 }]) {
      const r = R.resolveReportOptions(opts, TODAY);
      expect(r.from).toBe("2026-09-09");
      expect(r.to).toBe(TODAY);
      expect(r.days).toBe(31);
      expect(r.presetDays).toBe(30);
      expect([...r.sections]).toEqual(R.SECTION_KEYS);
      expect(r.heading).toBeNull();
    }
  });

  test("the 90-day preset", () => {
    const r = R.resolveReportOptions({ from: "2026-07-11", to: TODAY }, TODAY);
    expect(r.presetDays).toBe(90);
    expect(r.days).toBe(91);
  });

  test("a custom pick of exactly a preset's dates reads as the preset; anything else doesn't", () => {
    expect(R.resolveReportOptions({ from: "2026-09-09", to: TODAY }, TODAY).presetDays).toBe(30);
    expect(R.resolveReportOptions({ from: "2026-09-10", to: TODAY }, TODAY).presetDays).toBeNull();
    // the right length but not ending today is not the preset
    expect(R.resolveReportOptions({ from: "2026-09-08", to: "2026-10-08" }, TODAY).presetDays).toBeNull();
  });

  test("a future end is clamped to today", () => {
    const r = R.resolveReportOptions({ from: "2026-10-01", to: "2027-01-01" }, TODAY);
    expect(r.to).toBe(TODAY);
    expect(r.days).toBe(9);
  });

  test("a 400-day span is clamped to 366 days ending on `to`", () => {
    const r = R.resolveReportOptions({ from: R.addDays(TODAY, -400), to: TODAY }, TODAY);
    expect(r.from).toBe(R.addDays(TODAY, -365));
    expect(r.days).toBe(366);
  });

  test("from after to becomes a single day", () => {
    const r = R.resolveReportOptions({ from: "2026-10-05", to: "2026-10-01" }, TODAY);
    expect(r.from).toBe("2026-10-01");
    expect(r.to).toBe("2026-10-01");
    expect(r.days).toBe(1);
  });

  test("unknown sections are dropped; none recognised means all", () => {
    expect([...R.resolveReportOptions({ sections: ["dailyLog", "bogus"] }, TODAY).sections]).toEqual(["dailyLog"]);
    expect([...R.resolveReportOptions({ sections: [] }, TODAY).sections]).toEqual(R.SECTION_KEYS);
    expect([...R.resolveReportOptions({ sections: ["bogus"] }, TODAY).sections]).toEqual(R.SECTION_KEYS);
    expect(R.resolveReportOptions({ sections: new Set(["notes"]) }, TODAY).sections.has("notes")).toBe(true);
  });

  test("heading: trimmed, narrow no-break space made plain, capped at 120, empty → null", () => {
    expect(R.resolveReportOptions({ heading: "  Since your visit\u202fwith Dr. Lee  " }, TODAY).heading)
      .toBe("Since your visit with Dr. Lee");
    expect(R.resolveReportOptions({ heading: "x".repeat(200) }, TODAY).heading).toHaveLength(120);
    expect(R.resolveReportOptions({ heading: "   " }, TODAY).heading).toBeNull();
    expect(R.resolveReportOptions({ heading: 7 }, TODAY).heading).toBeNull();
  });
});

describe("range helpers", () => {
  test("rangeTitles: numbered for presets, plain otherwise", () => {
    const t30 = R.rangeTitles(R.resolveReportOptions({}, TODAY));
    expect(t30).toEqual({
      trend: "30-Day Trend", averages: "30-Day Averages", adherence: "Medication Adherence (30 Days)",
      recentAppts: "Recent Appointments (Last 30 Days)", glanceDays: 30,
    });
    expect(R.rangeTitles(R.resolveReportOptions({ from: "2026-07-11", to: TODAY }, TODAY)).trend).toBe("90-Day Trend");
    const custom = R.rangeTitles(R.resolveReportOptions({ from: "2026-01-01", to: "2026-01-31" }, TODAY));
    expect(custom).toEqual({
      trend: "Trend", averages: "Averages", adherence: "Medication Adherence",
      recentAppts: "Appointments in This Period", glanceDays: 31,
    });
  });

  test("dayCount and eachDay hold across both US daylight-saving changes", () => {
    expect(R.dayCount("2026-03-07", "2026-03-09")).toBe(3); // spring forward Mar 8
    expect(R.dayCount("2026-10-31", "2026-11-02")).toBe(3); // fall back Nov 1
    expect(R.eachDay("2026-03-07", "2026-03-09")).toEqual(["2026-03-07", "2026-03-08", "2026-03-09"]);
    expect(R.eachDay("2026-10-31", "2026-11-02")).toEqual(["2026-10-31", "2026-11-01", "2026-11-02"]);
    expect(R.dayCount("2026-10-09", "2026-10-09")).toBe(1);
    expect(R.addDays("2026-03-08", 1)).toBe("2026-03-09");
    expect(R.addDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  test("isYmd rejects impossible dates", () => {
    expect(R.isYmd("2026-02-30")).toBe(false);
    expect(R.isYmd("2026-2-3")).toBe(false);
    expect(R.isYmd("2026-02-28")).toBe(true);
  });

  test("chartLabelStep: 31 points → every 5th, as today", () => {
    expect(R.chartLabelStep(31)).toBe(5);
    expect(R.chartLabelStep(91)).toBe(15);
    expect(R.chartLabelStep(1)).toBe(1);
  });

  test("describeRange", () => {
    expect(R.describeRange(R.resolveReportOptions({ from: "2026-03-04", to: TODAY }, TODAY)))
      .toBe("Mar 4 – Oct 9, 2026 · 220 days");
    expect(R.describeRange(R.resolveReportOptions({ from: TODAY, to: TODAY }, TODAY))).toBe("Oct 9, 2026 · 1 day");
    expect(R.describeRange(R.resolveReportOptions({ from: "2025-12-01", to: "2026-01-02" }, TODAY)))
      .toBe("Dec 1, 2025 – Jan 2, 2026 · 33 days");
  });
});

describe("flares", () => {
  const F = (startDate, endDate = null, note = null) => ({ id: startDate, startDate, endDate, note });

  test("in range means touching it at all; oldest first", () => {
    const list = [F("2026-03-20", "2026-03-23"), F("2026-02-25", "2026-03-02"), F("2026-04-10"), F("2026-01-01", "2026-01-05")];
    expect(R.flaresInRange(list, "2026-03-01", "2026-04-30").map((f) => f.startDate))
      .toEqual(["2026-02-25", "2026-03-20", "2026-04-10"]);
    expect(R.flaresInRange(undefined, "2026-03-01", "2026-04-30")).toEqual([]);
  });

  test("every summary branch", () => {
    expect(R.flareSummaryLine([F("2026-03-02", "2026-03-06")])).toBe("1 flare in this period · 5 days");
    expect(R.flareSummaryLine([F("2026-03-02", "2026-03-02")])).toBe("1 flare in this period · 1 day");
    expect(R.flareSummaryLine([F("2026-04-10")])).toBe("1 flare in this period · ongoing");
    expect(R.flareSummaryLine([F("2026-03-01", "2026-03-04"), F("2026-03-10", "2026-03-13"), F("2026-03-20", "2026-03-23")]))
      .toBe("3 flares in this period · about 4 days each");
    // 5 and 4 days → 4.5 → 5
    expect(R.flareSummaryLine([F("2026-03-02", "2026-03-06"), F("2026-03-20", "2026-03-23"), F("2026-04-10")]))
      .toBe("3 flares in this period · the 2 that ended lasted about 5 days each");
    expect(R.flareSummaryLine([F("2026-03-02", "2026-03-06"), F("2026-04-10")]))
      .toBe("2 flares in this period · the 1 that ended lasted 5 days");
    expect(R.flareSummaryLine([])).toBe("");
  });

  test("a flare that began before the range counts its whole length", () => {
    expect(R.flareSummaryLine(R.flaresInRange([F("2026-02-27", "2026-03-03")], "2026-03-01", "2026-03-31")))
      .toBe("1 flare in this period · 5 days");
  });

  test("report lines", () => {
    expect(R.flareReportLine(F("2026-03-02", "2026-03-06"), TODAY)).toBe("Mar 2 – Mar 6 · 5 days");
    expect(R.flareReportLine(F("2026-03-02", "2026-03-02"), TODAY)).toBe("Mar 2 · 1 day");
    expect(R.flareReportLine(F("2026-04-10"), TODAY)).toBe("Since Apr 10 (ongoing)");
    expect(R.flareReportLine(F("2025-12-30", "2026-01-02"), TODAY)).toBe("Dec 30, 2025 – Jan 2 · 4 days");
  });
});

describe("medication changes", () => {
  // built from local times, so the local-date rule holds in any zone
  const at = (y, m, d, h, min = 0) => new Date(y, m - 1, d, h, min).toISOString();
  const meds = [{ id: 1, name: "Propranolol" }, { id: 2, name: "Amitriptyline" }];
  const history = {
    1: [
      { id: 3, kind: "changed", changedAt: at(2026, 10, 5, 18), changes: [{ field: "dosage", from: "10 mg", to: "20 mg" }] },
      { id: 2, kind: "changed", changedAt: at(2026, 10, 1, 23, 30), changes: [] }, // the night before the range
      { id: 1, kind: "created", changedAt: at(2026, 10, 3, 9), changes: [], derived: true },
    ],
    2: [{ id: 4, kind: "deactivated", changedAt: at(2026, 10, 5, 18), changes: [] }],
    9: [{ id: 5, kind: "deactivated", changedAt: at(2026, 10, 4, 12), changes: [] }], // no longer a medication
  };

  test("filtered by local date, sorted by time then name, derived entries kept", () => {
    const rows = R.medChangesInRange(history, meds, "2026-10-02", "2026-10-09");
    expect(rows.map((r) => [r.medName, r.entry.id])).toEqual([
      ["Propranolol", 1],
      ["Amitriptyline", 4],
      ["Propranolol", 3],
    ]);
    expect(rows[0].entry.derived).toBe(true);
  });

  test("absent history is no rows", () => {
    expect(R.medChangesInRange(undefined, meds, "2026-10-02", "2026-10-09")).toEqual([]);
  });
});

describe("as-needed ratings", () => {
  const meds = [{ id: 1, name: "Sumatriptan", prn: true }, { id: 2, name: "Ibuprofen", prn: true }, { id: 3, name: "Daily", prn: false }];
  const log = (medicationId, date, helped, status = "taken") => ({ medicationId, date, status, helped });
  const isPrn = (m) => m.prn;

  test("counts per medication, only taken doses in range", () => {
    const logs = [
      ...["yes", "yes", "a_little", "yes", "no", "yes", null, null].map((h, i) => log(1, `2026-10-0${i + 1}`, h)),
      log(1, "2026-08-01", "yes"), // out of range
      log(1, "2026-10-02", null, "skipped"),
      log(2, "2026-10-03", "yes"),
      log(3, "2026-10-03", "yes"), // not as-needed
    ];
    const rows = R.helpedRows(meds, logs, "2026-10-01", "2026-10-09", isPrn);
    expect(rows).toEqual([
      { name: "Ibuprofen", taken: 1, counts: { rated: 1, yes: 1, a_little: 0, no: 0 } },
      { name: "Sumatriptan", taken: 8, counts: { rated: 6, yes: 4, a_little: 1, no: 1 } },
    ]);
    expect(R.helpedReportLine(rows[1].counts)).toBe("Rated 6 times: helped 4 · a little 1 · not really 1");
    expect(R.helpedReportLine(rows[0].counts)).toBe("Rated 1 time: helped 1");
  });

  test("taken but never rated", () => {
    const rows = R.helpedRows(meds, [log(1, "2026-10-01", null)], "2026-10-01", "2026-10-09", isPrn);
    expect(rows[0].taken).toBe(1);
    expect(R.helpedReportLine(rows[0].counts)).toBe("Not rated");
  });

  test("no as-needed doses, no rows", () => {
    expect(R.helpedRows(meds, [], "2026-10-01", "2026-10-09", isPrn)).toEqual([]);
  });
});

describe("truncationNote", () => {
  const rows = (n, oldest) => Array.from({ length: n }, (_, i) => ({ date: i === n - 1 ? oldest : "2026-10-01" }));

  test("said only when the cap was hit before reaching the start", () => {
    expect(R.truncationNote(rows(1000, "2026-03-04"), "2026-01-01", TODAY))
      .toBe("Only the most recent 1,000 check-ins could be included, so days before Mar 5 may be incomplete.");
    expect(R.truncationNote(rows(999, "2026-03-04"), "2026-01-01", TODAY)).toBe("");
    expect(R.truncationNote(rows(1000, "2026-01-01"), "2026-01-01", TODAY)).toBe("");
  });
});

describe("remembered choices", () => {
  test("normalize: unknown keys and presets dropped, nothing left → defaults, print order kept", () => {
    expect(R.normalizeReportPrefs(null)).toEqual({ preset: "last30", sections: R.SECTION_KEYS });
    expect(R.normalizeReportPrefs({ preset: "last7", sections: ["bogus"] })).toEqual({ preset: "last30", sections: R.SECTION_KEYS });
    expect(R.normalizeReportPrefs({ preset: "last90", sections: ["medLog", "glance", "x"] }))
      .toEqual({ preset: "last90", sections: ["glance", "medLog"] });
    expect(R.normalizeReportPrefs("garbage")).toEqual({ preset: "last30", sections: R.SECTION_KEYS });
  });

  test("summary: nothing for the default, the preset and sections off otherwise", () => {
    expect(R.prefsSummary({ preset: "last30", sections: R.SECTION_KEYS })).toBe("");
    expect(R.isDefaultPrefs(undefined)).toBe(true);
    expect(R.prefsSummary({ preset: "last90", sections: R.SECTION_KEYS })).toBe("Last 90 days");
    expect(R.prefsSummary({ preset: "last90", sections: R.SECTION_KEYS.slice(2) })).toBe("Last 90 days · 2 sections off");
    expect(R.prefsSummary({ preset: "last30", sections: R.SECTION_KEYS.slice(1) })).toBe("Last 30 days · 1 section off");
  });
});
