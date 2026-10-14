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
  test("only known screens marked true survive", () => {
    expect(T.normalizeTipsSeen({ dashboard: true, trends: false, bogus: true, spoons: "yes", profile: true }))
      .toEqual({ dashboard: true, profile: true });
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

// ── parity with the client helper ────────────────────────────────────────────
describe("tips.js pair", () => {
  const WEB = path.join(__dirname, "../../client/src/utils/tips.js");
  const MOBILE = path.join(__dirname, "../../mobile/theme/tips.js");
  const load = (file) => {
    const src = fs.readFileSync(file, "utf8").replace(/^export /gm, "");
    // eslint-disable-next-line no-new-func
    return new Function(`${src}; return { TIP_SCREENS, TIPS, TIP_WORD_MAX, tipsToShow, tipCountLabel, tipsRowLabel };`)();
  };
  const C = load(WEB);

  test("the client file was actually parsed", () => {
    expect(typeof C.tipsToShow).toBe("function");
    expect(Object.keys(C.TIPS).length).toBeGreaterThan(0);
  });

  test("the clients list the same screens as the server, in the same order", () => {
    expect(C.TIP_SCREENS).toEqual(T.TIP_SCREENS);
    expect(Object.keys(C.TIPS)).toEqual(T.TIP_SCREENS);
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

  test("tipsToShow: nothing unless enrolled and unseen; then present anchors, in order", () => {
    const all = ["trends.range", "trends.insights", "trends.chart"];
    expect(C.tipsToShow("trends", null, all)).toEqual([]);
    expect(C.tipsToShow("trends", { trends: true }, all)).toEqual([]);
    expect(C.tipsToShow("trends", {}, all).map((t) => t.id)).toEqual(all);
    expect(C.tipsToShow("trends", { dashboard: true }, ["trends.chart", "trends.range"]).map((t) => t.id))
      .toEqual(["trends.range", "trends.chart"]);
    expect(C.tipsToShow("trends", {}, [])).toEqual([]);
  });

  test("labels", () => {
    expect(C.tipCountLabel(0, 3)).toBe("Tip 1 of 3");
    expect(C.tipsRowLabel(null)).toBe("Show tips");
    expect(C.tipsRowLabel({})).toBe("Show tips");
    expect(C.tipsRowLabel({ trends: true })).toBe("Show tips again");
  });
});
