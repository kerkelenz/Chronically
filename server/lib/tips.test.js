const fs = require("fs");
const path = require("path");
const T = require("./tips");

describe("normalizeTipsSeen", () => {
  test("null and undefined stay null: not enrolled", () => {
    expect(T.normalizeTipsSeen(null)).toBeNull();
    expect(T.normalizeTipsSeen(undefined)).toBeNull();
  });
  test("junk becomes an empty, enrolled state", () => {
    for (const junk of ["x", 3, true, [], ["dashboard"]]) expect(T.normalizeTipsSeen(junk)).toEqual({});
  });
  test("only known screens and tip ids marked true survive", () => {
    expect(T.normalizeTipsSeen({
      dashboard: true, trends: false, bogus: true, spoons: "yes", profile: true,
      "trends.chart": true, "trends.range": false, "trends.bogus": true,
    })).toEqual({ dashboard: true, profile: true, "trends.chart": true });
  });
});

describe("marking and resetting", () => {
  test("marking a screen adds it, keeping the rest", () => {
    expect(T.markScreenSeen({ dashboard: true }, "trends")).toEqual({ dashboard: true, trends: true });
    expect(T.markScreenSeen({}, "checkin")).toEqual({ checkin: true });
  });
  test("marking never enrols: null stays null", () => {
    expect(T.markScreenSeen(null, "trends")).toBeNull();
    expect(T.markScreenSeen(undefined, "trends")).toBeNull();
    expect(T.markTipIdsSeen(null, ["trends.chart"])).toBeNull();
  });
  test("an unknown screen changes nothing, and stored junk keys are stripped", () => {
    expect(T.markScreenSeen({ dashboard: true, junk: true }, "bogus")).toEqual({ dashboard: true });
  });
  test("reset is an empty, enrolled state", () => {
    expect(T.resetTips()).toEqual({});
    expect(T.isEnrolled(T.resetTips())).toBe(true);
    expect(T.isEnrolled(null)).toBe(false);
  });
});

describe("markTipIdsSeen", () => {
  test("marks known ids, ignores unknown ones and non-arrays", () => {
    expect(T.markTipIdsSeen({}, ["trends.chart", "nope", 4])).toEqual({ "trends.chart": true });
    expect(T.markTipIdsSeen({ "trends.chart": true }, "trends.range")).toEqual({ "trends.chart": true });
  });
  test("a screen closes once every one of its tips is marked — not before", () => {
    const [first, ...rest] = T.TIP_IDS.dashboard;
    const partial = T.markTipIdsSeen({}, [first]);
    expect(partial.dashboard).toBeUndefined();
    const all = T.markTipIdsSeen(partial, rest);
    expect(all.dashboard).toBe(true);
  });
  test("a closed screen stays closed — a tip added later doesn't reopen it", () => {
    expect(T.markTipIdsSeen({ dashboard: true }, ["trends.chart"]))
      .toEqual({ dashboard: true, "trends.chart": true });
  });
});

describe("TIP_IDS", () => {
  test("covers every screen, with ids unique across the app", () => {
    expect(Object.keys(T.TIP_IDS)).toEqual(T.TIP_SCREENS);
    const ids = Object.values(T.TIP_IDS).flat();
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(T.TIP_SCREENS).not.toContain(id);
  });
});

// ── parity with the client helper ────────────────────────────────────────────
describe("tips.js pair", () => {
  const WEB = path.join(__dirname, "../../client/src/utils/tips.js");
  const MOBILE = path.join(__dirname, "../../mobile/theme/tips.js");
  const load = (file) => {
    const src = fs.readFileSync(file, "utf8").replace(/^export /gm, "");
    // eslint-disable-next-line no-new-func
    return new Function(`${src}; return { TIP_SCREENS, TIPS, TIP_WORD_MAX, tipsToShow, withTipsMarked, tipCountLabel, tipsRowLabel, WELCOME_STEPS, WELCOME_FEATURES, welcomeStepLabel };`)();
  };
  const C = load(WEB);

  test("the client file was actually parsed", () => {
    expect(typeof C.tipsToShow).toBe("function");
    expect(Object.keys(C.TIPS).length).toBeGreaterThan(0);
  });

  test("the clients list the same screens and tips as the server, in the same order", () => {
    expect(C.TIP_SCREENS).toEqual(T.TIP_SCREENS);
    expect(Object.keys(C.TIPS)).toEqual(T.TIP_SCREENS);
    for (const screen of T.TIP_SCREENS) {
      expect(C.TIPS[screen].map((t) => t.id)).toEqual(T.TIP_IDS[screen]);
    }
  });

  test("the mobile copy is byte-identical to the web one", () => {
    expect(fs.readFileSync(MOBILE, "utf8")).toBe(fs.readFileSync(WEB, "utf8"));
  });

  test("every tip is short, and Support never has one", () => {
    for (const tips of Object.values(C.TIPS)) {
      for (const t of tips) {
        expect(t.text.split(/\s+/).length).toBeLessThanOrEqual(C.TIP_WORD_MAX);
        expect(t.anchor).not.toMatch(/support/i);
      }
    }
  });

  test("no tip or welcome step uses causal or pressure language", () => {
    const copy = [
      ...Object.values(C.TIPS).flat().map((t) => t.text),
      ...C.WELCOME_STEPS.flatMap((s) => [s.title, s.body, s.note || ""]),
    ].join(" ");
    // "a pattern, not a cause" is the one sanctioned use of the word
    expect(copy.replace(/not a cause/gi, "")).not.toMatch(/\b(causes?|caused|because of|leads? to|streak|don't forget|you should|must)\b/i);
  });

  test("tipsToShow: nothing unless enrolled and the screen is open; then unseen present anchors, in order", () => {
    const all = C.TIPS.trends.map((t) => t.anchor);
    const ids = C.TIPS.trends.map((t) => t.id);
    expect(C.tipsToShow("trends", null, all)).toEqual([]);
    expect(C.tipsToShow("trends", { trends: true }, all)).toEqual([]);
    expect(C.tipsToShow("trends", {}, all).map((t) => t.id)).toEqual(ids);
    expect(C.tipsToShow("trends", { dashboard: true }, ["trends.chart", "trends.range"]).map((t) => t.id))
      .toEqual(["trends.range", "trends.chart"]);
    expect(C.tipsToShow("trends", {}, [])).toEqual([]);
  });

  test("tipsToShow: a tip already shown stays away; one whose feature just appeared comes through alone", () => {
    const seen = { "dashboard.checkin": true, "dashboard.flare": true };
    expect(C.tipsToShow("dashboard", seen, ["dashboard.checkin", "dashboard.flare"])).toEqual([]);
    expect(C.tipsToShow("dashboard", seen, ["dashboard.checkin", "dashboard.flare", "dashboard.dials"]).map((t) => t.id))
      .toEqual(["dashboard.dials"]);
  });

  test("withTipsMarked agrees with the server's markTipIdsSeen", () => {
    const cases = [
      [{}, ["trends.chart"]],
      [{}, T.TIP_IDS.dashboard],
      [{ dashboard: true }, ["trends.range", "trends.insights"]],
      [{ "meds.add": true }, T.TIP_IDS.medications.slice(1)],
    ];
    for (const [state, ids] of cases) expect(C.withTipsMarked(state, ids)).toEqual(T.markTipIdsSeen(state, ids));
    expect(C.withTipsMarked(null, ["trends.chart"])).toBeNull();
  });

  test("labels", () => {
    expect(C.tipCountLabel(0, 3)).toBe("Tip 1 of 3");
    expect(C.tipCountLabel(0, 1)).toBe("");
    expect(C.tipsRowLabel(null)).toBe("Show tips");
    expect(C.tipsRowLabel({})).toBe("Show tips");
    expect(C.tipsRowLabel({ trends: true })).toBe("Show tips again");
    expect(C.tipsRowLabel({ "trends.chart": true })).toBe("Show tips again");
    expect(C.welcomeStepLabel(0)).toBe(`Step 1 of ${C.WELCOME_STEPS.length}`);
  });

  test("the welcome is short: three steps, one being the tracking question", () => {
    expect(C.WELCOME_STEPS.map((s) => s.id)).toEqual(["hello", "focus", "pace"]);
    expect(C.WELCOME_FEATURES.length).toBeGreaterThan(0);
  });
});
