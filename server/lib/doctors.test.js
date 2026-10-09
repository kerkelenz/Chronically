const {
  normalizeName,
  mergeDoctorSuggestions,
  HISTORY_LIMIT,
} = require("./doctors");

// Appointment dates only ever matter relative to each other here.
const at = (iso) => new Date(iso + "T12:00:00Z").toISOString();
const appt = (doctorName, date, specialty = null, location = null) => ({
  doctorName, date: at(date), specialty, location,
});
const savedDoc = (id, name, specialty = null, location = null) => ({
  id, name, nameKey: normalizeName(name), specialty, location,
});

describe("normalizeName", () => {
  test("lower-cases and trims", () => {
    expect(normalizeName("Dr. Rivera")).toBe("dr. rivera");
    expect(normalizeName("  Dr. Rivera  ")).toBe("dr. rivera");
    expect(normalizeName("DR. RIVERA")).toBe("dr. rivera");
  });

  test("collapses internal whitespace", () => {
    expect(normalizeName("Dr.   Rivera")).toBe("dr. rivera");
    expect(normalizeName("Dr.\tRivera")).toBe("dr. rivera");
    expect(normalizeName("Dr.\n Rivera")).toBe("dr. rivera");
    expect(normalizeName(" Dr.  Maria   Rivera ")).toBe("dr. maria rivera");
  });

  test("the case and spacing differences a user actually types all collapse together", () => {
    const forms = ["Dr. Rivera", "dr. rivera ", " DR.  Rivera", "dr.    RIVERA"];
    expect(new Set(forms.map(normalizeName)).size).toBe(1);
  });

  test("keeps punctuation, so two different people stay different", () => {
    expect(normalizeName("Dr. Lee")).not.toBe(normalizeName("Dr Lee"));
  });

  test("tolerates anything that is not a string", () => {
    for (const bad of [null, undefined, 42, {}, []]) {
      expect(normalizeName(bad)).toBe("");
    }
  });
});

describe("mergeDoctorSuggestions", () => {
  test("empty inputs give an empty list", () => {
    expect(mergeDoctorSuggestions([], [])).toEqual([]);
    expect(mergeDoctorSuggestions()).toEqual([]);
    expect(mergeDoctorSuggestions(null, null)).toEqual([]);
  });

  test("a saved doctor with no appointments appears with lastSeen null", () => {
    const out = mergeDoctorSuggestions([savedDoc(1, "Dr. Novak", "Rheumatology", "Eastside")], []);
    expect(out).toEqual([{
      id: 1, name: "Dr. Novak", specialty: "Rheumatology",
      location: "Eastside", saved: true, lastSeen: null,
    }]);
  });

  test("a saved doctor picks up lastSeen from a case-and-space-different appointment", () => {
    const out = mergeDoctorSuggestions(
      [savedDoc(1, "Dr. Rivera")],
      [appt("dr.   RIVERA ", "2026-03-04"), appt("Dr. Rivera", "2026-01-02")],
    );
    expect(out).toHaveLength(1);
    expect(out[0].saved).toBe(true);
    expect(out[0].lastSeen).toBe(at("2026-03-04"));
  });

  test("a saved doctor is not duplicated by its own appointments", () => {
    const out = mergeDoctorSuggestions(
      [savedDoc(1, "Dr. Rivera", "Neurology", "Harbor Clinic")],
      [appt("Dr. Rivera", "2026-03-04", "Cardiology", "Other Place")],
    );
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe(1);
    // the saved record's own fields win — editing a saved doctor is the way to
    // change them, and history must not quietly override the user's choice
    expect(out[0].specialty).toBe("Neurology");
    expect(out[0].location).toBe("Harbor Clinic");
  });

  test("an unsaved doctor from history appears unsaved, with no id", () => {
    const out = mergeDoctorSuggestions([], [appt("Dr. Lee", "2026-02-02", "Oncology", "Mercy")]);
    expect(out).toEqual([{
      id: null, name: "Dr. Lee", specialty: "Oncology",
      location: "Mercy", saved: false, lastSeen: at("2026-02-02"),
    }]);
  });

  test("history fields come from the most recent appointment", () => {
    const out = mergeDoctorSuggestions([], [
      appt("Dr. Lee", "2026-01-01", "Oncology", "Mercy"),
      appt("Dr. Lee", "2026-05-01", "Haematology", "Riverside"),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].specialty).toBe("Haematology");
    expect(out[0].location).toBe("Riverside");
  });

  test("an empty field on the latest appointment falls back to an earlier non-empty one", () => {
    const out = mergeDoctorSuggestions([], [
      appt("Dr. Lee", "2026-01-01", "Oncology", "Mercy"),
      appt("Dr. Lee", "2026-05-01", "", null),
    ]);
    expect(out[0].specialty).toBe("Oncology");
    expect(out[0].location).toBe("Mercy");
    // the latest appointment still sets the date and the display spelling
    expect(out[0].lastSeen).toBe(at("2026-05-01"));
  });

  test("whitespace-only fields count as empty", () => {
    const out = mergeDoctorSuggestions([], [
      appt("Dr. Lee", "2026-01-01", "Oncology", "Mercy"),
      appt("Dr. Lee", "2026-05-01", "   ", "  "),
    ]);
    expect(out[0].specialty).toBe("Oncology");
    expect(out[0].location).toBe("Mercy");
  });

  test("the display spelling is the one from the most recent appointment", () => {
    const out = mergeDoctorSuggestions([], [
      appt("dr. lee", "2026-01-01"),
      appt("Dr. Lee", "2026-05-01"),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].name).toBe("Dr. Lee");
  });

  test("appointments with no usable doctor name are ignored", () => {
    const out = mergeDoctorSuggestions([], [
      appt("", "2026-01-01"), appt("   ", "2026-01-02"),
      { date: at("2026-01-03") }, { doctorName: null, date: at("2026-01-04") },
    ]);
    expect(out).toEqual([]);
  });

  test("orders by most recent, with never-seen saved doctors last", () => {
    const out = mergeDoctorSuggestions(
      [savedDoc(1, "Dr. Novak"), savedDoc(2, "Dr. Rivera")],
      [appt("Dr. Rivera", "2026-04-01"), appt("Dr. Lee", "2026-06-01")],
    );
    expect(out.map((d) => d.name)).toEqual(["Dr. Lee", "Dr. Rivera", "Dr. Novak"]);
    expect(out.map((d) => d.saved)).toEqual([false, true, true]);
  });

  test("doctors with no appointments sort among themselves by name", () => {
    const out = mergeDoctorSuggestions(
      [savedDoc(1, "Dr. Zhao"), savedDoc(2, "Dr. Abbott"), savedDoc(3, "dr. mills")],
      [],
    );
    expect(out.map((d) => d.name)).toEqual(["Dr. Abbott", "dr. mills", "Dr. Zhao"]);
  });

  test("ordering is total, so repeated runs cannot disagree", () => {
    const saved = [savedDoc(1, "Dr. B"), savedDoc(2, "Dr. A"), savedDoc(3, "Dr. C")];
    const appts = [
      appt("Dr. A", "2026-01-01"), appt("Dr. B", "2026-01-01"),
      appt("Dr. D", "2026-01-01"), appt("Dr. E", "2026-01-01"),
    ];
    const first = mergeDoctorSuggestions(saved, appts).map((d) => d.name);
    for (let i = 0; i < 20; i++) {
      // shuffled input must not change the output order
      const s = [...saved].reverse();
      const a = [...appts].sort(() => Math.random() - 0.5);
      expect(mergeDoctorSuggestions(s, a).map((d) => d.name)).toEqual(first);
    }
  });

  test(`history is capped at ${HISTORY_LIMIT}, keeping the most recent`, () => {
    const appts = [];
    for (let i = 1; i <= 30; i++) {
      appts.push(appt(`Dr. ${String(i).padStart(2, "0")}`, `2026-01-${String(i).padStart(2, "0")}`));
    }
    const out = mergeDoctorSuggestions([], appts);
    expect(out).toHaveLength(HISTORY_LIMIT);
    // 30 down to 11 — the twenty most recent
    expect(out[0].name).toBe("Dr. 30");
    expect(out[out.length - 1].name).toBe("Dr. 11");
  });

  test("the cap never drops a saved doctor", () => {
    const appts = [];
    for (let i = 1; i <= 30; i++) {
      appts.push(appt(`Dr. ${String(i).padStart(2, "0")}`, `2026-01-${String(i).padStart(2, "0")}`));
    }
    const saved = [];
    for (let i = 1; i <= 25; i++) saved.push(savedDoc(i, `Saved ${i}`));

    const out = mergeDoctorSuggestions(saved, appts);
    expect(out.filter((d) => d.saved)).toHaveLength(25);
    expect(out.filter((d) => !d.saved)).toHaveLength(HISTORY_LIMIT);
  });

  test("a saved doctor is excluded from the history cap's competition", () => {
    // 30 distinct names in history, 5 of which the user has saved. Those 5
    // leave the history pool, so 20 of the remaining 25 still come through.
    const appts = [];
    for (let i = 1; i <= 30; i++) {
      appts.push(appt(`Dr. ${String(i).padStart(2, "0")}`, `2026-01-${String(i).padStart(2, "0")}`));
    }
    const saved = [26, 27, 28, 29, 30].map((i, n) => savedDoc(n + 1, `Dr. ${i}`));
    const out = mergeDoctorSuggestions(saved, appts);
    expect(out.filter((d) => d.saved)).toHaveLength(5);
    expect(out.filter((d) => !d.saved)).toHaveLength(HISTORY_LIMIT);
    // no name appears twice
    expect(new Set(out.map((d) => normalizeName(d.name))).size).toBe(out.length);
  });

  test("a row's own nameKey is used when present, and computed when not", () => {
    const withKey = mergeDoctorSuggestions(
      [{ id: 1, name: "Dr. Rivera", nameKey: "dr. rivera" }],
      [appt("DR. RIVERA", "2026-02-02")],
    );
    const withoutKey = mergeDoctorSuggestions(
      [{ id: 1, name: "Dr. Rivera" }],
      [appt("DR. RIVERA", "2026-02-02")],
    );
    expect(withKey).toEqual(withoutKey);
    expect(withKey[0].lastSeen).toBe(at("2026-02-02"));
  });

  test("an unparseable appointment date does not crash or claim a lastSeen", () => {
    const out = mergeDoctorSuggestions([], [
      { doctorName: "Dr. Lee", date: "not a date", specialty: "Oncology" },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].lastSeen).toBeNull();
    expect(out[0].specialty).toBe("Oncology");
  });

  test("saved rows report null rather than empty strings for blank fields", () => {
    const out = mergeDoctorSuggestions([savedDoc(1, "Dr. Novak", "", "   ")], []);
    expect(out[0].specialty).toBeNull();
    expect(out[0].location).toBeNull();
  });

  test("the result never leaks internal sort fields", () => {
    const out = mergeDoctorSuggestions(
      [savedDoc(1, "Dr. Rivera")],
      [appt("Dr. Lee", "2026-01-01")],
    );
    for (const entry of out) {
      expect(Object.keys(entry).sort()).toEqual(
        ["id", "lastSeen", "location", "name", "saved", "specialty"],
      );
    }
  });
});

// ── parity with the client ────────────────────────────────────────────────────
// The server decides which saved doctor an appointment belongs to; the form
// decides whether to offer "Save for next time". Those are two copies of
// normalizeName, and a copy of a rule is how drift starts. This reads the
// client helper as text, evaluates it, and compares the two over inputs that
// exercise every branch. It asserts the extraction worked first, so a refactor
// cannot quietly reduce this to comparing a function against itself.
describe("normalizeName parity with the client helper", () => {
  const fs = require("fs");
  const path = require("path");

  const WEB = path.join(__dirname, "../../client/src/utils/doctorHelpers.js");
  const MOBILE = path.join(__dirname, "../../mobile/theme/doctorHelpers.js");

  const loadClient = (file) => {
    const src = fs.readFileSync(file, "utf8").replace(/^export /gm, "");
    // eslint-disable-next-line no-new-func
    return new Function(`${src}; return { normalizeName, MAX_SUGGESTIONS };`)();
  };

  const CASES = [
    "Dr. Rivera", "  Dr. Rivera  ", "DR. RIVERA", "dr.   rivera",
    "Dr.\tRivera", "Dr.\n Rivera", " Dr.  Maria   Rivera ", "Dr Lee",
    "Dr. Lee", "", "   ", "O'Brien", "Dr. Müller", "ドクター",
    "Dr. Smith-Jones", "a", "Z z   z",
  ];

  test("the client file was actually parsed", () => {
    const web = loadClient(WEB);
    expect(typeof web.normalizeName).toBe("function");
    expect(web.MAX_SUGGESTIONS).toBe(6);
    // a different function object, not a re-import of the server's
    expect(web.normalizeName).not.toBe(normalizeName);
  });

  test("web and server agree on every form a user might type", () => {
    const web = loadClient(WEB);
    for (const input of CASES) {
      expect(web.normalizeName(input)).toBe(normalizeName(input));
    }
    for (const bad of [null, undefined, 42, {}, []]) {
      expect(web.normalizeName(bad)).toBe(normalizeName(bad));
    }
  });

  test("the mobile copy is byte-identical to the web one", () => {
    expect(fs.readFileSync(MOBILE, "utf8")).toBe(fs.readFileSync(WEB, "utf8"));
  });
});
