const fs = require("fs");
const path = require("path");
const T = require("./trends");

// a check-in row with the four metrics the fixture uses; pain and appetite null
const row = (date, energy, mood, anxiety, sleep) => ({
  date, energyLevel: energy, moodLevel: mood, anxietyLevel: anxiety, sleepLevel: sleep,
  painLevel: null, appetiteLevel: null,
});

// The hand-checked fixture from the spec, exactly.
const FIXTURE = [
  row("2026-09-25", 5, 5, 5, 5), // outside both windows
  row("2026-09-26", 2, 3, 3, 3),
  row("2026-09-28", 3, 3, 3, 3),
  row("2026-09-30", 3, 4, null, 3),
  row("2026-10-01", 2, 2, 2, 4),
  row("2026-10-02", 4, 3, 3, 2),
  row("2026-10-03", 3, 4, 4, 4),
  row("2026-10-04", 4, 4, 4, null),
  row("2026-10-05", 2, 3, 3, 3), // check-in A
  row("2026-10-05", 4, 5, 3, null), // check-in B
  row("2026-10-06", 5, 3, 4, null),
  row("2026-10-08", 3, 2, 4, 4),
  row("2026-10-09", 4, 4, 4, 5),
];
const WINDOW = { startDate: "2026-10-03", endDate: "2026-10-09" };

describe("comparePeriods — the hand-checked fixture", () => {
  const { window, metrics } = T.comparePeriods(FIXTURE, WINDOW);

  test("the previous window is the 7 days before", () => {
    expect(window).toEqual({
      startDate: "2026-10-03", endDate: "2026-10-09", prevStartDate: "2026-09-26", prevEndDate: "2026-10-02",
    });
  });

  test("energy: 3.7 over 6 days vs 2.8 over 5 — daily means, not per check-in", () => {
    expect(metrics.energy).toEqual({ current: { mean: 3.7, days: 6 }, previous: { mean: 2.8, days: 5 }, comparable: true });
    // averaging every check-in would give 25/7 = 3.6: the wrong method
    expect(metrics.energy.current.mean).not.toBe(3.6);
  });

  test("mood: 3.5 over 6 days vs 3.0 over 5", () => {
    expect(metrics.mood).toEqual({ current: { mean: 3.5, days: 6 }, previous: { mean: 3, days: 5 }, comparable: true });
  });

  test("anxiety: previous has only 4 days (09-30 is null) → not comparable", () => {
    expect(metrics.anxiety.current.days).toBe(6);
    expect(metrics.anxiety.previous.days).toBe(4);
    expect(metrics.anxiety.comparable).toBe(false);
  });

  test("sleep: current has only 4 days → not comparable", () => {
    expect(metrics.sleep.current.days).toBe(4);
    expect(metrics.sleep.previous.days).toBe(5);
    expect(metrics.sleep.comparable).toBe(false);
  });

  test("pain and appetite: no days, no mean, not comparable", () => {
    for (const m of ["pain", "appetite"]) {
      expect(metrics[m]).toEqual({ current: { mean: null, days: 0 }, previous: { mean: null, days: 0 }, comparable: false });
    }
  });

  test("the 09-25 row affects nothing", () => {
    const without = T.comparePeriods(FIXTURE.slice(1), WINDOW);
    expect(without.metrics).toEqual(metrics);
  });
});

describe("previousWindow", () => {
  test("across the end of US daylight saving", () => {
    expect(T.previousWindow("2026-11-01", "2026-11-07")).toEqual({ prevStartDate: "2026-10-25", prevEndDate: "2026-10-31" });
  });
  test("365 days", () => {
    expect(T.previousWindow("2025-10-10", "2026-10-09")).toEqual({ prevStartDate: "2024-10-10", prevEndDate: "2025-10-09" });
    expect(T.dayCount("2024-10-10", "2025-10-09")).toBe(365);
  });
});

describe("dailyMeans", () => {
  test("a null is never averaged or counted; a doubled day counts once", () => {
    const days = T.dailyMeans(FIXTURE, "2026-10-03", "2026-10-09");
    expect(days.map((d) => d.date)).toEqual(["2026-10-03", "2026-10-04", "2026-10-05", "2026-10-06", "2026-10-08", "2026-10-09"]);
    const oct5 = days.find((d) => d.date === "2026-10-05");
    expect(oct5.energy).toBe(3);
    expect(oct5.sleep).toBe(3); // B's null is not a 0
    expect(days.find((d) => d.date === "2026-10-04").sleep).toBeNull();
  });
  test("never 0, even from a stray 0 reading", () => {
    const [d] = T.dailyMeans([row("2026-10-05", 0, 4, null, 0)], "2026-10-01", "2026-10-09");
    expect(d.energy).toBeNull();
    expect(d.sleep).toBeNull();
    expect(d.mood).toBe(4);
  });
  test("empty input", () => {
    expect(T.dailyMeans([], "2026-10-01", "2026-10-09")).toEqual([]);
    const { metrics } = T.comparePeriods([], WINDOW);
    expect(Object.values(metrics).every((m) => m.current.days === 0 && m.current.mean === null && !m.comparable)).toBe(true);
  });
  test("an all-null metric: days 0, mean null, not comparable", () => {
    expect(T.comparePeriods(FIXTURE, WINDOW).metrics.pain.current).toEqual({ mean: null, days: 0 });
  });
  test("the response rows are rounded to one decimal", () => {
    const [d] = T.roundedDays(T.dailyMeans([row("2026-10-05", 2, 3, 3, 3), row("2026-10-05", 3, 3, 3, 3), row("2026-10-05", 3, 3, 3, 3)], "2026-10-05", "2026-10-05"));
    expect(d.energy).toBe(2.7);
  });
});

// ── parity with the client helper ────────────────────────────────────────────
// trendHelpers.js lives on both clients, byte-identical. Read it as text and
// evaluate it, asserting the extraction worked first, as flares.test.js does.
describe("trendHelpers pair", () => {
  const WEB = path.join(__dirname, "../../client/src/utils/trendHelpers.js");
  const MOBILE = path.join(__dirname, "../../mobile/theme/trendHelpers.js");
  const NAMES = [
    "TREND_RANGES", "DEFAULT_RANGE_DAYS", "COMPARE_METRICS", "rangeWindow", "dayIndex", "localYmdOf", "axisTicks",
    "buildAnnotations", "clusterMarkers", "annotationSummary", "formatComparison",
    "comparisonTitle", "comparisonFootnote", "emptyRangeText",
  ];
  const load = (file) => {
    const src = fs.readFileSync(file, "utf8").replace(/^export /gm, "");
    // eslint-disable-next-line no-new-func
    return new Function(`${src}; return { ${NAMES.join(", ")} };`)();
  };
  const H = load(WEB);
  const TODAY = "2026-10-09";

  test("the client file was actually parsed", () => {
    for (const n of NAMES) expect(H[n]).toBeDefined();
    expect(H.TREND_RANGES.map((r) => r.days)).toEqual([7, 30, 90, 365]);
    expect(H.DEFAULT_RANGE_DAYS).toBe(30);
    // the clients list comparison rows in the server's metric order
    expect(H.COMPARE_METRICS).toEqual(T.METRICS);
  });

  test("the mobile copy is byte-identical to the web one", () => {
    expect(fs.readFileSync(MOBILE, "utf8")).toBe(fs.readFileSync(WEB, "utf8"));
  });

  test("rangeWindow agrees with previousWindow for every preset", () => {
    expect(H.rangeWindow(TODAY, 7)).toEqual({ startDate: "2026-10-03", endDate: TODAY, days: 7 });
    for (const n of [7, 30, 90, 365]) {
      const w = H.rangeWindow(TODAY, n);
      expect(T.dayCount(w.startDate, w.endDate)).toBe(n);
      const prev = T.previousWindow(w.startDate, w.endDate);
      expect(T.dayCount(prev.prevStartDate, prev.prevEndDate)).toBe(n);
      expect(H.dayIndex(prev.prevEndDate, w.startDate)).toBe(1); // ends the day before
    }
  });

  test("clusterMarkers: same day merges; near neighbours merge at 300px / 44px / 365 days; far ones don't", () => {
    const m = (dayIdx, type) => ({ dayIdx, date: `d${dayIdx}`, type, text: `${type}${dayIdx}` });
    const opts = { days: 365, plotWidth: 300, minGapPx: 44 };
    // 300px over 364 gaps ≈ 0.82px a day, so 44px ≈ 53 days
    const same = H.clusterMarkers([m(100, "appt"), m(100, "med")], opts);
    expect(same).toHaveLength(1);
    expect(same[0].items.map((i) => i.type)).toEqual(["med", "appt"]);
    expect(H.clusterMarkers([m(100, "med"), m(140, "appt")], opts)).toHaveLength(1);
    const far = H.clusterMarkers([m(100, "med"), m(160, "appt")], opts);
    expect(far.map((c) => c.dayIdx)).toEqual([100, 160]);
  });

  test("bands: an ongoing flare ends at days − 1; one that began earlier is clipped to 0", () => {
    const win = H.rangeWindow(TODAY, 30); // 2026-09-10 .. 2026-10-09
    const { bands } = H.buildAnnotations({
      window: win, todayYmd: TODAY, changes: [], appointments: [],
      describeChange: () => [], formatFlareRange: (f) => `${f.startDate}…`,
      flares: [
        { startDate: "2026-10-02", endDate: null },
        { startDate: "2026-09-01", endDate: "2026-09-12" },
        { startDate: "2026-08-01", endDate: "2026-08-05" }, // entirely before
      ],
    });
    expect(bands).toEqual([
      { startIdx: 22, endIdx: 29, ongoing: true, startDate: "2026-10-02", label: "2026-10-02…" },
      { startIdx: 0, endIdx: 2, ongoing: false, startDate: "2026-09-01", label: "2026-09-01…" },
    ]);
  });

  test("markers: med and appointment text; cancelled and out-of-range dropped", () => {
    const win = H.rangeWindow(TODAY, 30);
    // built from local wall times, so the local-date rule holds in any zone
    const local = (y, mo, d, h) => new Date(y, mo - 1, d, h).toISOString();
    const { markers } = H.buildAnnotations({
      window: win, todayYmd: TODAY, flares: [],
      describeChange: () => ["Dosage 120 mg → 240 mg"], formatFlareRange: () => "",
      changes: [
        { medicationName: "Tecfidera", changedAt: local(2026, 10, 4, 23) },
        { medicationName: "Old", changedAt: local(2026, 8, 1, 12) },
      ],
      appointments: [
        { doctorName: "Dr. Lee", specialty: "Rheumatology", status: "completed", date: local(2026, 10, 4, 9) },
        { doctorName: "Dr. Reyes", status: "cancelled", date: local(2026, 10, 5, 9) },
        { doctorName: "Dr. Chen", status: "upcoming", date: local(2026, 10, 7, 9) },
      ],
    });
    expect(markers.map((x) => x.text)).toEqual([
      "Dosage 120 mg → 240 mg · Tecfidera · Oct 4",
      "Appointment · Dr. Lee (Rheumatology) · Oct 4",
      "Appointment · Dr. Chen · Oct 7",
    ]);
    expect(markers[0].dayIdx).toBe(24);
  });

  test("copy", () => {
    const row2 = { current: { mean: 3.7, days: 6 }, previous: { mean: 3, days: 5 } };
    expect(H.formatComparison("Energy", row2, 7)).toBe("Energy averaged 3.7 these 7 days vs 3.0 the 7 days before (6 vs 5 days logged)");
    expect(H.formatComparison("Energy", row2, 365)).toBe("Energy averaged 3.7 this year vs 3.0 the year before (6 vs 5 days logged)");
    expect(H.comparisonFootnote(["anxiety", "sleep"])).toBe("Not enough days to compare yet for anxiety and sleep.");
    expect(H.comparisonFootnote(["pain", "anxiety", "sleep"])).toBe("Not enough days to compare yet for pain, anxiety, and sleep.");
    expect(H.comparisonTitle(30)).toBe("Compared with the 30 days before");
    expect(H.comparisonTitle(365)).toBe("Compared with the year before");
    expect(H.annotationSummary({ bands: [{ label: "Since Oct 2 · ongoing" }], markers: [{ type: "med" }, { type: "med" }, { type: "appt" }], days: 30 }))
      .toBe("Last 30 days. 1 flare: Since Oct 2 · ongoing. 2 medication changes. 1 appointment.");
    expect(H.annotationSummary({ bands: [], markers: [], days: 7 }))
      .toBe("Last 7 days. No flares, medication changes or appointments in this range.");
    expect(H.axisTicks(H.rangeWindow(TODAY, 30)).map((t) => t.label)).toEqual(["Sep 10", "Sep 17", "Sep 25", "Oct 2", "Oct 9"]);
    expect(H.axisTicks(H.rangeWindow(TODAY, 7)).map((t) => t.idx)).toEqual([0, 2, 3, 5, 6]);
  });
});
