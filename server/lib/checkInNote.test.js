const { parseNote, NOTE_MAX } = require("./checkInNote");

describe("NOTE_MAX", () => {
  test("is 280, the limit both clients enforce", () => {
    expect(NOTE_MAX).toBe(280);
  });
});

describe("parseNote — what was sent", () => {
  test("undefined means not sent, which is not the same as cleared", () => {
    expect(parseNote(undefined)).toEqual({ value: undefined });
    expect(parseNote()).toEqual({ value: undefined });
  });

  test("null means clear it", () => {
    expect(parseNote(null)).toEqual({ value: null });
  });

  test("an empty or whitespace-only note is stored as null, never as \"\"", () => {
    expect(parseNote("")).toEqual({ value: null });
    expect(parseNote("   ")).toEqual({ value: null });
    expect(parseNote("\n")).toEqual({ value: null });
    expect(parseNote(" \t \r\n ")).toEqual({ value: null });
  });
});

describe("parseNote — tidying", () => {
  test("trims surrounding whitespace", () => {
    expect(parseNote("  hi  ")).toEqual({ value: "hi" });
  });

  test("collapses newlines to a single space, so a note stays one line", () => {
    expect(parseNote("a\n\nb")).toEqual({ value: "a b" });
    expect(parseNote("a\r\nb")).toEqual({ value: "a b" });
    expect(parseNote("a \n  b")).toEqual({ value: "a b" });
    expect(parseNote("first day back\nat work")).toEqual({ value: "first day back at work" });
  });

  test("leaves internal single spaces alone", () => {
    expect(parseNote("storm rolled in this afternoon")).toEqual({
      value: "storm rolled in this afternoon",
    });
  });

  test("keeps punctuation and emoji untouched", () => {
    expect(parseNote("  rough one — didn't sleep 😞 ")).toEqual({
      value: "rough one — didn't sleep 😞",
    });
  });
});

describe("parseNote — length", () => {
  test("exactly 280 characters is accepted", () => {
    const note = "a".repeat(280);
    expect(parseNote(note)).toEqual({ value: note });
  });

  test("281 characters is rejected", () => {
    expect(parseNote("a".repeat(281))).toEqual({
      error: "Notes can be up to 280 characters.",
    });
  });

  test("280 characters padded with whitespace still fits, because length is measured after trimming", () => {
    const note = "a".repeat(280);
    expect(parseNote(`   ${note}   `)).toEqual({ value: note });
    expect(parseNote(`\n\n${note}\n`)).toEqual({ value: note });
  });

  test("a long note whose newlines collapse under the limit is accepted", () => {
    // 200 + 1 collapsed space + 79 = 280
    const raw = `${"a".repeat(200)}\n\n\n${"b".repeat(79)}`;
    const parsed = parseNote(raw);
    expect(parsed.error).toBeUndefined();
    expect(parsed.value.length).toBe(280);
  });

  test("the error names the real limit", () => {
    expect(parseNote("a".repeat(500)).error).toContain(String(NOTE_MAX));
  });
});

describe("parseNote — anything that is not text", () => {
  test("rejects numbers, objects, arrays and booleans", () => {
    for (const bad of [42, 0, { note: "hi" }, ["hi"], true, false]) {
      expect(parseNote(bad)).toEqual({ error: "Note must be text." });
    }
  });

  test("a number is never coerced into the user's own words", () => {
    expect(parseNote(42).value).toBeUndefined();
  });
});

describe("parseNote — the shape of the result", () => {
  test("a success never carries an error, and an error never carries a value", () => {
    const good = parseNote("fine");
    expect(good.error).toBeUndefined();
    expect(good.value).toBe("fine");

    const bad = parseNote("a".repeat(400));
    expect(bad.value).toBeUndefined();
    expect(typeof bad.error).toBe("string");
  });
});
