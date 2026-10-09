const {
  NOTE_MAX, isYmd, daysBetween, durationDays, isDateInFlare,
  rangesOverlap, validateFlare, cleanNote, noteTooLong, todayFor,
} = require("./flares");

const flare = (startDate, endDate = null, note = null) => ({ startDate, endDate, note });

describe("isYmd", () => {
  test("accepts real dates", () => {
    for (const s of ["2026-01-01", "2026-12-31", "2028-02-29", "2026-10-09"]) {
      expect(isYmd(s)).toBe(true);
    }
  });

  test("rejects malformed strings", () => {
    for (const s of ["2026-1-1", "26-01-01", "2026/01/01", "2026-01-01T00:00:00Z",
      "", "today", null, undefined, 20261009, {}]) {
      expect(isYmd(s)).toBe(false);
    }
  });

  test("rejects days that do not exist", () => {
    for (const s of ["2026-02-30", "2026-13-01", "2026-00-10", "2026-04-31", "2027-02-29"]) {
      expect(isYmd(s)).toBe(false);
    }
  });
});

describe("daysBetween", () => {
  test("counts whole days forwards and backwards", () => {
    expect(daysBetween("2026-10-01", "2026-10-01")).toBe(0);
    expect(daysBetween("2026-10-01", "2026-10-02")).toBe(1);
    expect(daysBetween("2026-10-02", "2026-10-01")).toBe(-1);
    expect(daysBetween("2026-10-01", "2026-11-01")).toBe(31);
  });

  test("a clock change cannot add or drop a day", () => {
    // US fall-back is 2026-11-01; a local-midnight subtraction would give 24.04
    expect(daysBetween("2026-10-25", "2026-11-18")).toBe(24);
    // US spring-forward 2027-03-14
    expect(daysBetween("2027-03-08", "2027-03-20")).toBe(12);
  });
});

describe("durationDays", () => {
  test("a flare started today is on day 1", () => {
    expect(durationDays(flare("2026-10-09"), "2026-10-09")).toBe(1);
  });

  test("an ended three-day flare is 3 days", () => {
    expect(durationDays(flare("2026-10-01", "2026-10-03"), "2026-10-09")).toBe(3);
  });

  test("a same-day flare is 1 day", () => {
    expect(durationDays(flare("2026-10-01", "2026-10-01"), "2026-10-09")).toBe(1);
  });

  test("an ongoing flare counts up to today, across a month boundary", () => {
    expect(durationDays(flare("2026-09-28"), "2026-10-02")).toBe(5);
  });

  test("the count matches naive day counting across both DST changes", () => {
    // 25 Oct to 5 Nov inclusive = 12 days, whatever the clocks did on 1 Nov
    expect(durationDays(flare("2026-10-25", "2026-11-05"), "2026-11-09")).toBe(12);
    // 8 Mar to 20 Mar inclusive = 13 days, across spring-forward on 14 Mar
    expect(durationDays(flare("2027-03-08", "2027-03-20"), "2027-03-25")).toBe(13);
  });
});

describe("isDateInFlare", () => {
  const ended = flare("2026-10-02", "2026-10-06");

  test("includes both edges", () => {
    expect(isDateInFlare("2026-10-02", ended, "2026-10-09")).toBe(true);
    expect(isDateInFlare("2026-10-06", ended, "2026-10-09")).toBe(true);
  });

  test("excludes the days either side", () => {
    expect(isDateInFlare("2026-10-01", ended, "2026-10-09")).toBe(false);
    expect(isDateInFlare("2026-10-07", ended, "2026-10-09")).toBe(false);
  });

  test("an ongoing flare runs to today and no further", () => {
    const going = flare("2026-10-05");
    expect(isDateInFlare("2026-10-05", going, "2026-10-09")).toBe(true);
    expect(isDateInFlare("2026-10-09", going, "2026-10-09")).toBe(true);
    expect(isDateInFlare("2026-10-10", going, "2026-10-09")).toBe(false);
    expect(isDateInFlare("2026-10-04", going, "2026-10-09")).toBe(false);
  });
});

describe("rangesOverlap", () => {
  const T = "2026-10-20";

  test("disjoint ranges do not overlap", () => {
    expect(rangesOverlap(flare("2026-10-01", "2026-10-05"), flare("2026-10-06", "2026-10-07"), T)).toBe(false);
    expect(rangesOverlap(flare("2026-10-06", "2026-10-07"), flare("2026-10-01", "2026-10-05"), T)).toBe(false);
  });

  test("touching on the same day overlaps", () => {
    expect(rangesOverlap(flare("2026-10-01", "2026-10-10"), flare("2026-10-10", "2026-10-12"), T)).toBe(true);
    expect(rangesOverlap(flare("2026-10-10", "2026-10-12"), flare("2026-10-01", "2026-10-10"), T)).toBe(true);
  });

  test("a nested range overlaps", () => {
    expect(rangesOverlap(flare("2026-10-01", "2026-10-10"), flare("2026-10-03", "2026-10-04"), T)).toBe(true);
    expect(rangesOverlap(flare("2026-10-03", "2026-10-04"), flare("2026-10-01", "2026-10-10"), T)).toBe(true);
  });

  test("an ongoing flare swallows anything at or after its start", () => {
    const going = flare("2026-10-03");
    expect(rangesOverlap(flare("2026-10-04", "2026-10-04"), going, T)).toBe(true);
    expect(rangesOverlap(flare("2026-10-03", "2026-10-03"), going, T)).toBe(true);
    expect(rangesOverlap(flare("2026-10-10", "2026-10-12"), going, T)).toBe(true);
  });

  test("a past flare entirely before an ongoing one is allowed", () => {
    const going = flare("2026-10-03");
    expect(rangesOverlap(flare("2026-09-20", "2026-09-25"), going, T)).toBe(false);
    // ending the day before it starts is still clear
    expect(rangesOverlap(flare("2026-09-20", "2026-10-02"), going, T)).toBe(false);
  });

  test("two ongoing flares always overlap", () => {
    expect(rangesOverlap(flare("2026-10-03"), flare("2026-09-01"), T)).toBe(true);
  });
});

describe("validateFlare", () => {
  const T = "2026-10-09";

  test("a plain ongoing flare today is fine", () => {
    expect(validateFlare({ startDate: T, endDate: null }, [], T)).toEqual({ ok: true });
  });

  test("1. a missing or malformed start date", () => {
    for (const bad of [undefined, null, "", "nope", "2026-02-30"]) {
      expect(validateFlare({ startDate: bad }, [], T))
        .toEqual({ ok: false, status: 400, error: "Please choose a start date." });
    }
  });

  test("2. an end date that is present but unreadable", () => {
    expect(validateFlare({ startDate: "2026-10-01", endDate: "2026-02-30" }, [], T))
      .toEqual({ ok: false, status: 400, error: "Please choose a valid end date." });
    expect(validateFlare({ startDate: "2026-10-01", endDate: "soon" }, [], T))
      .toEqual({ ok: false, status: 400, error: "Please choose a valid end date." });
  });

  test("3. a start in the future", () => {
    expect(validateFlare({ startDate: "2026-10-10", endDate: null }, [], T))
      .toEqual({ ok: false, status: 400, error: "A flare can't start in the future." });
  });

  test("4. an end in the future", () => {
    expect(validateFlare({ startDate: "2026-10-01", endDate: "2026-10-10" }, [], T))
      .toEqual({ ok: false, status: 400, error: "A flare can't end in the future." });
  });

  test("5. an end before the start", () => {
    expect(validateFlare({ startDate: "2026-10-05", endDate: "2026-10-01" }, [], T))
      .toEqual({ ok: false, status: 400, error: "The end date can't be before the start." });
  });

  test("6. a second ongoing flare", () => {
    expect(validateFlare({ startDate: "2026-10-08", endDate: null }, [flare("2026-10-01")], T))
      .toEqual({ ok: false, status: 409, error: "You already have a flare going. End that one first." });
  });

  test("7. an overlap with an existing flare", () => {
    expect(validateFlare({ startDate: "2026-10-05", endDate: "2026-10-07" },
      [flare("2026-10-01", "2026-10-05")], T))
      .toEqual({ ok: false, status: 409, error: "That overlaps another flare you've logged." });
  });

  test("the order of the checks: an unreadable start beats every other problem", () => {
    const res = validateFlare({ startDate: "bad", endDate: "2099-01-01" }, [flare("2026-10-01")], T);
    expect(res.error).toBe("Please choose a start date.");
  });

  test("a future start beats an overlap", () => {
    const res = validateFlare({ startDate: "2026-10-20", endDate: null }, [flare("2026-10-01")], T);
    expect(res.error).toBe("A flare can't start in the future.");
  });

  test("a past flare before an ongoing one is accepted", () => {
    expect(validateFlare({ startDate: "2026-09-20", endDate: "2026-09-25" },
      [flare("2026-10-03")], T)).toEqual({ ok: true });
  });

  test("a flare does not collide with itself, because the caller excludes it", () => {
    const mine = flare("2026-10-01", "2026-10-05");
    // editing `mine` to end a day later, with `others` not containing it
    expect(validateFlare({ startDate: "2026-10-01", endDate: "2026-10-06" }, [], T)).toEqual({ ok: true });
    // and it WOULD collide if the caller forgot to filter it out
    expect(validateFlare({ startDate: "2026-10-01", endDate: "2026-10-06" }, [mine], T).ok).toBe(false);
  });

  test("an absent endDate key means ongoing, like an explicit null", () => {
    expect(validateFlare({ startDate: T }, [], T)).toEqual({ ok: true });
    expect(validateFlare({ startDate: T }, [flare("2026-10-01")], T).status).toBe(409);
  });

  test("tolerates a non-array `others`", () => {
    expect(validateFlare({ startDate: T, endDate: null }, null, T)).toEqual({ ok: true });
  });
});

describe("cleanNote / noteTooLong", () => {
  test("non-strings and blanks become null", () => {
    for (const v of [null, undefined, 42, {}, [], "", "   ", "\n"]) {
      expect(cleanNote(v)).toBeNull();
    }
  });

  test("trims", () => {
    expect(cleanNote("  weather turned  ")).toBe("weather turned");
  });

  test("the limit is 280 measured after trimming", () => {
    expect(NOTE_MAX).toBe(280);
    expect(noteTooLong("a".repeat(280))).toBe(false);
    expect(noteTooLong(`  ${"a".repeat(280)}  `)).toBe(false);
    expect(noteTooLong("a".repeat(281))).toBe(true);
    expect(noteTooLong(null)).toBe(false);
  });

  test("an over-long note is never silently shortened", () => {
    expect(cleanNote("a".repeat(281)).length).toBe(281);
  });
});

describe("todayFor", () => {
  test("uses the user's zone, not the server's", () => {
    // 23:30 on 8 Oct in Los Angeles
    expect(todayFor("America/Los_Angeles", new Date("2026-10-09T06:30:00Z"))).toBe("2026-10-08");
    // 00:30 on 9 Oct in Los Angeles
    expect(todayFor("America/Los_Angeles", new Date("2026-10-09T07:30:00Z"))).toBe("2026-10-09");
  });

  test("a zone ahead of UTC can already be tomorrow", () => {
    expect(todayFor("Pacific/Auckland", new Date("2026-10-08T22:00:00Z"))).toBe("2026-10-09");
  });

  test("no zone falls back to the latest date on Earth, so nobody is told today is the future", () => {
    // UTC+14: 11:00 UTC on 8 Oct is already 9 Oct in Kiritimati
    expect(todayFor(null, new Date("2026-10-08T11:00:00Z"))).toBe("2026-10-09");
    expect(todayFor(undefined, new Date("2026-10-08T11:00:00Z"))).toBe("2026-10-09");
  });

  test("junk falls back the same way rather than throwing", () => {
    expect(todayFor("Mars/Base", new Date("2026-10-08T11:00:00Z"))).toBe("2026-10-09");
    expect(todayFor(42, new Date("2026-10-08T11:00:00Z"))).toBe("2026-10-09");
  });
});

// ── parity with the client helper ────────────────────────────────────────────
// flareDay on both clients must agree with durationDays here, or a user sees
// "day 4" on screen for a flare the server counts as 5 days long. Reads the
// client file as text and evaluates it, asserting the extraction worked first.
describe("flareHelpers parity with the client", () => {
  const fs = require("fs");
  const path = require("path");
  const WEB = path.join(__dirname, "../../client/src/utils/flareHelpers.js");
  const MOBILE = path.join(__dirname, "../../mobile/theme/flareHelpers.js");

  const load = (file) => {
    const src = fs.readFileSync(file, "utf8").replace(/^export /gm, "");
    // eslint-disable-next-line no-new-func
    return new Function(`${src}; return { flareDay, formatFlareRange, flareSinceLabel, localToday };`)();
  };

  test("the client file was actually parsed", () => {
    const web = load(WEB);
    for (const fn of ["flareDay", "formatFlareRange", "flareSinceLabel", "localToday"]) {
      expect(typeof web[fn]).toBe("function");
    }
  });

  test("the mobile copy is byte-identical to the web one", () => {
    expect(fs.readFileSync(MOBILE, "utf8")).toBe(fs.readFileSync(WEB, "utf8"));
  });

  test("flareDay matches durationDays everywhere, DST included", () => {
    const web = load(WEB);
    const cases = [
      ["2026-10-09", "2026-10-09"],
      ["2026-10-01", "2026-10-03"],
      ["2026-09-28", "2026-10-02"],
      ["2026-10-25", "2026-11-05"], // across fall-back
      ["2027-03-08", "2027-03-20"], // across spring-forward
      ["2026-01-01", "2026-12-31"],
      ["2028-02-28", "2028-03-01"], // leap day
    ];
    for (const [start, today] of cases) {
      expect(web.flareDay(start, today)).toBe(durationDays({ startDate: start, endDate: null }, today));
    }
  });
});
