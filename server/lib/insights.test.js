const { computeInsights } = require("./insights");

// ── fixtures helpers ──────────────────────────────────────────────────────────
const ymd = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
// i days after a base YYYY-MM-DD (noon avoids TZ shifts — mirrors the engine)
const dayStr = (base, i) => {
  const d = new Date(base + "T12:00:00");
  d.setDate(d.getDate() + i);
  return ymd(d);
};
const weekdayOf = (dateStr) => new Date(dateStr + "T12:00:00").getDay();

// a check-in row; only the metrics you name are set, the rest are null
const ci = (date, o = {}) => ({
  date,
  painLevel: o.pain ?? null,
  moodLevel: o.mood ?? null,
  energyLevel: o.energy ?? null,
  anxietyLevel: o.anxiety ?? null,
  appetiteLevel: o.appetite ?? null,
  sleepLevel: o.sleep ?? null,
  symptoms: o.symptoms ?? [],
});

const B = "2026-06-01";
const cardById = (res, id) => res.cards.find((c) => c.id === id);
const familyCount = (res, family) => res.cards.filter((c) => c.family === family).length;

// ── F1: symptom ↔ metric ──────────────────────────────────────────────────────
describe("F1 symptom ↔ metric", () => {
  test("symptom-day vs non-symptom-day means give the expected one-decimal effect", () => {
    const checkIns = [];
    for (let i = 0; i < 6; i++) checkIns.push(ci(dayStr(B, i), { energy: 2, symptoms: ["Fog"] }));
    for (let i = 6; i < 12; i++) checkIns.push(ci(dayStr(B, i), { energy: 4 }));

    const res = computeInsights({ checkIns });
    const card = cardById(res, "f1-fog-energy");
    expect(card).toBeTruthy();
    expect(card.effect).toBe(2);
    expect(card.headline).toBe("Fog costs you energy");
    expect(card.body).toContain("2.0 lower");
    expect(card.evidence).toBe("Across 6 days with Fog");
  });

  test("a 4-day bucket produces no card; 5 days does", () => {
    const four = [];
    for (let i = 0; i < 4; i++) four.push(ci(dayStr(B, i), { energy: 2, symptoms: ["Fog"] }));
    for (let i = 4; i < 10; i++) four.push(ci(dayStr(B, i), { energy: 4 }));
    expect(cardById(computeInsights({ checkIns: four }), "f1-fog-energy")).toBeUndefined();

    const five = [];
    for (let i = 0; i < 5; i++) five.push(ci(dayStr(B, i), { energy: 2, symptoms: ["Fog"] }));
    for (let i = 5; i < 11; i++) five.push(ci(dayStr(B, i), { energy: 4 }));
    expect(cardById(computeInsights({ checkIns: five }), "f1-fog-energy")).toBeTruthy();
  });

  test("an effect of 0.4 produces no card; 0.6 does", () => {
    const build = (nonEnergy) => {
      const rows = [];
      for (let i = 0; i < 5; i++) rows.push(ci(dayStr(B, i), { energy: 3.0, symptoms: ["Fog"] }));
      for (let i = 5; i < 10; i++) rows.push(ci(dayStr(B, i), { energy: nonEnergy }));
      return computeInsights({ checkIns: rows });
    };
    expect(cardById(build(3.4), "f1-fog-energy")).toBeUndefined(); // effect 0.4 < 0.5
    expect(cardById(build(3.6), "f1-fog-energy")).toBeTruthy();    // effect 0.6 ≥ 0.5
  });

  test("a symptom correlating with BETTER metrics is suppressed", () => {
    const rows = [];
    for (let i = 0; i < 5; i++) rows.push(ci(dayStr(B, i), { energy: 5, symptoms: ["Fog"] }));
    for (let i = 5; i < 11; i++) rows.push(ci(dayStr(B, i), { energy: 3 }));
    const res = computeInsights({ checkIns: rows });
    expect(cardById(res, "f1-fog-energy")).toBeUndefined();
    expect(familyCount(res, "symptom")).toBe(0);
  });

  test("multi-check-in days average into a single day before comparison", () => {
    const rows = [];
    // one Fog date with three check-ins → day avg (1+3+5)/3 = 3
    rows.push(ci(dayStr(B, 0), { energy: 1, symptoms: ["Fog"] }));
    rows.push(ci(dayStr(B, 0), { energy: 3, symptoms: ["Fog"] }));
    rows.push(ci(dayStr(B, 0), { energy: 5, symptoms: ["Fog"] }));
    // four more single-check-in Fog days at 4 → sym per-day mean = (3+4+4+4+4)/5 = 3.8
    for (let i = 1; i < 5; i++) rows.push(ci(dayStr(B, i), { energy: 4, symptoms: ["Fog"] }));
    // five non-Fog days at 5
    for (let i = 5; i < 10; i++) rows.push(ci(dayStr(B, i), { energy: 5 }));

    const res = computeInsights({ checkIns: rows });
    expect(res.meta.days).toBe(10); // distinct dates, not 12 check-in rows
    const card = cardById(res, "f1-fog-energy");
    expect(card).toBeTruthy();
    // per-DAY: 5 - 3.8 = 1.2 (per-CHECK-IN would be 5 - 25/7 ≈ 1.4)
    expect(card.effect).toBe(1.2);
    expect(card.body).toContain("1.2 lower");
  });
});

// ── F2: sleep ↔ same-day metrics ──────────────────────────────────────────────
describe("F2 sleep ↔ metrics", () => {
  test("null-sleep days are excluded from the buckets", () => {
    const rows = [];
    for (let i = 0; i < 5; i++) rows.push(ci(dayStr(B, i), { sleep: 1, energy: 2 }));  // low bucket
    for (let i = 5; i < 10; i++) rows.push(ci(dayStr(B, i), { sleep: 5, energy: 4 })); // high bucket
    // null-sleep days with extreme energy: if they leaked into the low bucket
    // (a naive `sleep <= 2` treats null as 0), the effect would grow past 2.0
    for (let i = 10; i < 13; i++) rows.push(ci(dayStr(B, i), { energy: 1 }));

    const card = cardById(computeInsights({ checkIns: rows }), "f2-energy");
    expect(card).toBeTruthy();
    expect(card.effect).toBe(2); // strictly the 2-vs-4 buckets
    expect(card.body).toContain("2.0 lower");
  });
});

// ── F3: skipped doses ↔ that day's metrics ────────────────────────────────────
describe("F3 skipped doses ↔ metrics", () => {
  test("buckets split on skipped vs fully-logged; a mixed day counts as skipped", () => {
    const checkIns = [];
    const medLogs = [];
    // 5 skipped-only days at energy 2
    for (let i = 0; i < 5; i++) {
      checkIns.push(ci(dayStr(B, i), { energy: 2 }));
      medLogs.push({ date: dayStr(B, i), status: "skipped" });
    }
    // 5 taken-only days at energy 4
    for (let i = 5; i < 10; i++) {
      checkIns.push(ci(dayStr(B, i), { energy: 4 }));
      medLogs.push({ date: dayStr(B, i), status: "taken" });
    }
    // 1 mixed day (taken AND skipped) at energy 2 → belongs in the skipped bucket.
    // If it wrongly counted as "fully logged", bucket B's mean would drop and the
    // effect would fall below 2.0.
    checkIns.push(ci(dayStr(B, 10), { energy: 2 }));
    medLogs.push({ date: dayStr(B, 10), status: "taken" });
    medLogs.push({ date: dayStr(B, 10), status: "skipped" });

    const card = cardById(computeInsights({ checkIns, medLogs }), "f3-energy");
    expect(card).toBeTruthy();
    expect(card.family).toBe("adherence");
    expect(card.headline).toBe("Skipped doses land on harder days");
    expect(card.effect).toBe(2);
    expect(card.body).toContain("2.0 lower");
  });

  test("F1 behaves identically when medLogs/spoonDays are omitted (Phase 1 parity)", () => {
    const checkIns = [];
    for (let i = 0; i < 6; i++) checkIns.push(ci(dayStr(B, i), { energy: 2, symptoms: ["Fog"] }));
    for (let i = 6; i < 12; i++) checkIns.push(ci(dayStr(B, i), { energy: 4 }));
    const withEmpty = computeInsights({ checkIns, medLogs: [], spoonDays: [] });
    const without = computeInsights({ checkIns });
    expect(withEmpty).toEqual(without);
  });
});

// ── F4: over-budget spoon day ↔ the NEXT day ──────────────────────────────────
describe("F4 spoons ↔ next day", () => {
  test("uses the PREVIOUS day's budget against TODAY's metrics (fails if inverted)", () => {
    const checkIns = [];
    const spoonDays = [];
    // 20 consecutive days. Even days carry the spoon record; odd days are the
    // "next" days whose metrics we read. Same-day energy is FLAT (all 4) so an
    // off-by-one impl that compares a day's own budget to its own metrics finds
    // nothing; only the NEXT-day energy differs.
    const over = new Set([0, 2, 4, 6, 8]);      // → next days 1,3,5,7,9 are low
    const within = new Set([10, 12, 14, 16, 18]); // → next days 11,13,15,17,19 high
    const lowNext = new Set([1, 3, 5, 7, 9]);
    const highNext = new Set([11, 13, 15, 17, 19]);
    for (let i = 0; i < 20; i++) {
      let energy = 4;
      if (lowNext.has(i)) energy = 2;
      else if (highNext.has(i)) energy = 4;
      checkIns.push(ci(dayStr(B, i), { energy }));
      if (over.has(i)) spoonDays.push({ date: dayStr(B, i), budget: 10, spent: 15, entries: 3 });
      else if (within.has(i)) spoonDays.push({ date: dayStr(B, i), budget: 10, spent: 5, entries: 3 });
    }

    const res = computeInsights({ checkIns, spoonDays });
    const card = cardById(res, "f4-energy");
    expect(card).toBeTruthy();
    expect(card.family).toBe("spoons");
    expect(card.headline).toBe("Overspending spoons echoes into tomorrow");
    expect(card.effect).toBe(2); // day-after energy 4 (within) − 2 (over)
    expect(card.body).toContain("2.0 lower");
    expect(card.evidence).toBe("Across 5 days after going over budget");
  });

  test("a same-day-only correlation does NOT create an F4 card", () => {
    // over-budget days are themselves low-energy, but the day AFTER is normal →
    // the (correct) next-day comparison finds nothing.
    const checkIns = [];
    const spoonDays = [];
    const over = new Set([0, 2, 4, 6, 8]);
    const within = new Set([10, 12, 14, 16, 18]);
    for (let i = 0; i < 20; i++) {
      const energy = over.has(i) ? 2 : 4; // low ON the over-budget day itself
      checkIns.push(ci(dayStr(B, i), { energy }));
      if (over.has(i)) spoonDays.push({ date: dayStr(B, i), budget: 10, spent: 15, entries: 3 });
      else if (within.has(i)) spoonDays.push({ date: dayStr(B, i), budget: 10, spent: 5, entries: 3 });
    }
    expect(cardById(computeInsights({ checkIns, spoonDays }), "f4-energy")).toBeUndefined();
  });
});

// ── Caps ──────────────────────────────────────────────────────────────────────
describe("caps", () => {
  test("MAX_PER_FAMILY holds — many F1 candidates yield at most two symptom cards", () => {
    const checkIns = [];
    const symptoms = ["S1", "S2", "S3", "S4"];
    let d = 0;
    // each symptom worsens energy on its own 6 days
    for (const s of symptoms) {
      for (let k = 0; k < 6; k++) checkIns.push(ci(dayStr(B, d++), { energy: 1, symptoms: [s] }));
    }
    // clean high-energy days
    for (let k = 0; k < 8; k++) checkIns.push(ci(dayStr(B, d++), { energy: 5 }));

    const res = computeInsights({ checkIns });
    expect(familyCount(res, "symptom")).toBe(2);
    expect(res.cards.length).toBe(2);
  });

  test("MAX_CARDS holds — 6 qualifying candidates across families trim to 5", () => {
    const N = 84; // 12 weeks → plenty of every weekday for F5
    const day = (i) => dayStr(B, i);
    const M = {};
    for (let i = 0; i < N; i++) M[i] = { pain: 3, mood: 3, energy: 3, anxiety: 3, appetite: 3, sleep: 3, symptoms: [] };

    // F5: Thursdays dip (all metrics 2) — the weakest effect, should be trimmed
    for (let i = 0; i < N; i++) {
      if (weekdayOf(day(i)) === 4) { M[i].pain = 2; M[i].mood = 2; M[i].energy = 2; M[i].anxiety = 2; M[i].appetite = 2; }
    }

    const used = new Set();
    const takeNonThu = (k) => {
      const out = [];
      for (let i = 0; i < N && out.length < k; i++) {
        if (weekdayOf(day(i)) === 4 || used.has(i)) continue;
        out.push(i); used.add(i);
      }
      return out;
    };

    for (const i of takeNonThu(6)) { M[i].symptoms = ["Fog"]; M[i].energy = 1; }   // F1 #1
    for (const i of takeNonThu(6)) { M[i].symptoms = ["Ache"]; M[i].pain = 1; }     // F1 #2
    for (const i of takeNonThu(5)) { M[i].sleep = 1; M[i].energy = 1; }             // F2 low
    for (const i of takeNonThu(5)) { M[i].sleep = 5; M[i].energy = 5; }             // F2 high

    const medLogs = [];
    for (const i of takeNonThu(5)) { M[i].energy = 1; medLogs.push({ date: day(i), status: "skipped" }); } // F3 A
    for (const i of takeNonThu(5)) { M[i].energy = 5; medLogs.push({ date: day(i), status: "taken" }); }   // F3 B

    // F4: 5 over→next-low pairs, 5 within→next-high pairs (adjacent, non-Thursday)
    const spoonDays = [];
    const pairs = [];
    for (let i = 0; i < N - 1 && pairs.length < 10; i++) {
      if (weekdayOf(day(i)) === 4 || weekdayOf(day(i + 1)) === 4) continue;
      if (used.has(i) || used.has(i + 1)) continue;
      pairs.push([i, i + 1]); used.add(i); used.add(i + 1); i++;
    }
    pairs.slice(0, 5).forEach(([p, nx]) => { spoonDays.push({ date: day(p), budget: 10, spent: 15, entries: 3 }); M[nx].energy = 1; });
    pairs.slice(5, 10).forEach(([p, nx]) => { spoonDays.push({ date: day(p), budget: 10, spent: 5, entries: 3 }); M[nx].energy = 5; });

    const checkIns = [];
    for (let i = 0; i < N; i++) {
      const m = M[i];
      checkIns.push(ci(day(i), m));
    }

    const res = computeInsights({ checkIns, medLogs, spoonDays });
    expect(res.cards.length).toBe(5);                 // trimmed from 6
    expect(familyCount(res, "symptom")).toBeLessThanOrEqual(2); // per-family cap
    res.cards.forEach((c) => expect(c.family).not.toBe("undefined"));
    // the four strong families all survive; the weak weekday card is the one cut
    expect(familyCount(res, "sleep")).toBe(1);
    expect(familyCount(res, "adherence")).toBe(1);
    expect(familyCount(res, "spoons")).toBe(1);
    expect(familyCount(res, "weekday")).toBe(0);
  });
});

// ── meta empty-state ──────────────────────────────────────────────────────────
describe("meta", () => {
  test("a fresh account is told how many more days until insights", () => {
    const checkIns = [];
    for (let i = 0; i < 3; i++) checkIns.push(ci(dayStr(B, i), { pain: 3, mood: 3 }));
    const res = computeInsights({ checkIns });
    expect(res.cards.length).toBe(0);
    expect(res.meta.message).toBe("Insights unlock as patterns emerge — about 11 more check-in days to go.");
  });
});
