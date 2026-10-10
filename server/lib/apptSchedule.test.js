const A = require("./apptSchedule");

const LA = "America/Los_Angeles";
const iso = (d) => (d ? d.toISOString() : d);
const Z = (s) => new Date(s);
const appt = (date, extra = {}) => ({ id: 1, doctorName: "Dr. Lee", status: "upcoming", date, notesBefore: null, ...extra });

describe("reminderInstants", () => {
  test("LA, 09:30 visit: 18:00 the evening before, no morning one", () => {
    const r = A.reminderInstants(Z("2026-10-15T16:30:00Z"), LA); // 09:30 PDT
    expect(iso(r.evening)).toBe("2026-10-15T01:00:00.000Z"); // 18:00 PDT on the 14th
    expect(r.morning).toBeNull();
  });

  test("across the end of US daylight saving (Sun 2026-11-01)", () => {
    // 14:00 PST Nov 2 → 18:00 PST Nov 1
    expect(iso(A.reminderInstants(Z("2026-11-02T22:00:00Z"), LA).evening)).toBe("2026-11-02T02:00:00.000Z");
    // 10:00 PST Nov 1 → 18:00 PDT Oct 31, and 08:00 PST that morning
    const r = A.reminderInstants(Z("2026-11-01T18:00:00Z"), LA);
    expect(iso(r.evening)).toBe("2026-11-01T01:00:00.000Z");
    expect(iso(r.morning)).toBe("2026-11-01T16:00:00.000Z");
  });

  test("across the start of US daylight saving (Sun 2027-03-14)", () => {
    const r = A.reminderInstants(Z("2027-03-14T18:00:00Z"), LA); // 11:00 PDT
    expect(iso(r.evening)).toBe("2027-03-14T02:00:00.000Z"); // 18:00 PST on the 13th
    expect(iso(r.morning)).toBe("2027-03-14T15:00:00.000Z"); // 08:00 PDT
  });

  test("Europe/London across 2026-10-25", () => {
    // 12:00 GMT on the 25th: the evening before is still BST
    const r = A.reminderInstants(Z("2026-10-25T12:00:00Z"), "Europe/London");
    expect(iso(r.evening)).toBe("2026-10-24T17:00:00.000Z");
    expect(iso(r.morning)).toBe("2026-10-25T08:00:00.000Z");
    expect(iso(A.reminderInstants(Z("2026-10-26T09:00:00Z"), "Europe/London").evening)).toBe("2026-10-25T18:00:00.000Z");
  });

  test("Asia/Kolkata, a half-hour offset", () => {
    const r = A.reminderInstants(Z("2026-10-15T03:30:00Z"), "Asia/Kolkata"); // 09:00 IST
    expect(iso(r.evening)).toBe("2026-10-14T12:30:00.000Z");
    expect(r.morning).toBeNull();
  });

  test("Pacific/Auckland: the local day is not the UTC day", () => {
    // 08:30 NZDT on the 15th is still the 14th in UTC
    const r = A.reminderInstants(Z("2026-10-14T19:30:00Z"), "Pacific/Auckland");
    expect(iso(r.evening)).toBe("2026-10-14T05:00:00.000Z"); // 18:00 NZDT on the 14th
  });

  test("month and year boundary", () => {
    expect(A.localDayBefore("2027-01-01")).toBe("2026-12-31");
    expect(A.localDayBefore("2026-03-01")).toBe("2026-02-28");
    expect(iso(A.reminderInstants(Z("2027-01-01T18:00:00Z"), LA).evening)).toBe("2027-01-01T02:00:00.000Z");
  });

  test("a 10:00 visit gets a morning instant; 09:59 doesn't", () => {
    expect(A.reminderInstants(Z("2026-10-15T17:00:00Z"), LA).morning).not.toBeNull();
    expect(A.reminderInstants(Z("2026-10-15T16:59:00Z"), LA).morning).toBeNull();
  });

  test("unknown zone → null", () => {
    expect(A.reminderInstants(Z("2026-10-15T16:30:00Z"), null)).toBeNull();
    expect(A.reminderInstants(Z("2026-10-15T16:30:00Z"), "Mars/Base")).toBeNull();
  });
});

describe("followupInstant", () => {
  const at = (pdt) => Z(`${pdt}-07:00`);
  test("two hours later in the daytime", () => {
    expect(iso(A.followupInstant(at("2026-10-15T14:00:00"), LA))).toBe("2026-10-15T23:00:00.000Z"); // 16:00 PDT
  });
  test("19:30 → 21:30 is quiet → 09:00 next day", () => {
    expect(iso(A.followupInstant(at("2026-10-15T19:30:00"), LA))).toBe("2026-10-16T16:00:00.000Z");
  });
  test("23:30 → 01:30 → 09:00 that (next) day", () => {
    expect(iso(A.followupInstant(at("2026-10-15T23:30:00"), LA))).toBe("2026-10-16T16:00:00.000Z");
  });
  test("06:00 → 08:00 → 09:00 the same day", () => {
    expect(iso(A.followupInstant(at("2026-10-15T06:00:00"), LA))).toBe("2026-10-15T16:00:00.000Z");
  });
  test("deferred across the DST change: Oct 31 20:00 PDT → Nov 1 09:00 PST", () => {
    expect(iso(A.followupInstant(at("2026-10-31T20:00:00"), LA))).toBe("2026-11-01T17:00:00.000Z");
  });
  test("unknown zone → null", () => {
    expect(A.followupInstant(at("2026-10-15T14:00:00"), "")).toBeNull();
  });
});

describe("apptNotificationsInWindow", () => {
  const visit = appt("2026-10-15T16:30:00Z"); // 09:30 PDT; evening = 2026-10-15T01:00Z
  const evening = Z("2026-10-15T01:00:00Z");

  test("an instant exactly at windowStart is included; at windowEnd it isn't", () => {
    const start = A.apptNotificationsInWindow([visit], LA, evening, new Date(evening.getTime() + 600000));
    expect(start.map((n) => [n.kind, n.variant, iso(n.scheduledFor)])).toEqual([["appt_reminder", "evening", "2026-10-15T01:00:00.000Z"]]);
    expect(iso(start[0].eveningInstant)).toBe("2026-10-15T01:00:00.000Z");
    expect(A.apptNotificationsInWindow([visit], LA, new Date(evening.getTime() - 600000), evening)).toEqual([]);
  });

  test("the follow-up, in its own window", () => {
    const f = Z("2026-10-15T18:30:00Z"); // 11:30 PDT
    const got = A.apptNotificationsInWindow([visit], LA, f, new Date(f.getTime() + 1));
    expect(got.map((n) => [n.kind, n.variant])).toEqual([["appt_followup", null]]);
  });

  test("both reminder variants come back when both fall in the window", () => {
    const v = appt("2026-10-15T21:00:00Z"); // 14:00 PDT
    const got = A.apptNotificationsInWindow([v], LA, Z("2026-10-14T00:00:00Z"), Z("2026-10-15T20:00:00Z"));
    expect(got.map((n) => n.variant)).toEqual(["evening", "morning"]);
    expect(iso(got[1].eveningInstant)).toBe("2026-10-15T01:00:00.000Z");
  });

  test("cancelled and completed appointments are never returned", () => {
    const wide = [Z("2026-10-01T00:00:00Z"), Z("2026-10-30T00:00:00Z")];
    for (const status of ["cancelled", "completed"]) {
      expect(A.apptNotificationsInWindow([{ ...visit, status }], LA, ...wide)).toEqual([]);
    }
    expect(A.apptNotificationsInWindow([visit], LA, ...wide)).toHaveLength(2);
  });

  test("a reminder at or after the visit is never returned", () => {
    // a visit at 00:00 local: its "evening before" is still before it…
    const midnight = appt("2026-10-15T07:00:00Z");
    const got = A.apptNotificationsInWindow([midnight], LA, Z("2026-10-01T00:00:00Z"), Z("2026-10-30T00:00:00Z"));
    expect(got.filter((n) => n.kind === "appt_reminder").every((n) => n.scheduledFor < Z(midnight.date))).toBe(true);
    // …and a morning reminder needs the visit at 10:00 or later, so 08:00 is always before it
    const ten = appt("2026-10-15T17:00:00Z");
    const all = A.apptNotificationsInWindow([ten], LA, Z("2026-10-01T00:00:00Z"), Z("2026-10-30T00:00:00Z"));
    for (const n of all.filter((x) => x.kind === "appt_reminder")) expect(n.scheduledFor < Z(ten.date)).toBe(true);
  });

  test("unknown zone → nothing", () => {
    expect(A.apptNotificationsInWindow([visit], null, Z("2026-10-01T00:00:00Z"), Z("2026-10-30T00:00:00Z"))).toEqual([]);
  });
});

describe("copy", () => {
  const v = (extra) => appt("2026-10-15T16:30:00Z", extra);

  test("evening and morning titles", () => {
    expect(A.reminderCopy(v(), LA, "evening").title).toBe("Tomorrow: Dr. Lee · 9:30 AM");
    expect(A.reminderCopy(appt("2026-10-15T21:00:00Z"), LA, "morning").title).toBe("Today: Dr. Lee · 2:00 PM");
  });

  test("the first non-blank line of the prep notes", () => {
    expect(A.reminderCopy(v({ notesBefore: "\n\n  Ask about the MRI  \nsecond line" }), LA, "evening").body)
      .toBe("You wanted to ask: Ask about the MRI");
  });

  test("no notes, or only whitespace → the gentle fallback", () => {
    for (const notesBefore of [null, "", "  \n\t \n"]) {
      expect(A.reminderCopy(v({ notesBefore }), LA, "evening").body)
        .toBe("Anything you want to remember to ask? Add it to your prep notes.");
    }
  });

  test("a long note is cut to 120 including the ellipsis; a long name to 40", () => {
    const body = A.reminderCopy(v({ notesBefore: "x".repeat(200) }), LA, "evening").body;
    const line = body.replace("You wanted to ask: ", "");
    expect(line).toHaveLength(120);
    expect(line.endsWith("…")).toBe(true);
    const name = "N".repeat(60);
    const title = A.reminderCopy(v({ doctorName: name }), LA, "evening").title;
    expect(title.split(": ")[1].split(" · ")[0]).toHaveLength(40);
    expect(A.followupCopy(v({ doctorName: name })).title).toBe(`How did it go with ${"N".repeat(39)}…?`);
  });

  test("follow-up copy", () => {
    expect(A.followupCopy(v())).toEqual({
      title: "How did it go with Dr. Lee?",
      body: "Tap to add a note about the visit — only if you want to.",
    });
  });
});
