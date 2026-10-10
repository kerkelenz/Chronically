import { describe, it, expect } from "vitest";

// Every date-sensitive test assumes this. If the pin stops applying, fail here
// with a clear message rather than as a confusing date mismatch elsewhere.
describe("the test environment", () => {
  it("runs in a pinned, negative-offset time zone", () => {
    expect(Intl.DateTimeFormat().resolvedOptions().timeZone).toBe("America/Los_Angeles");
    // midnight UTC on a date-only string is still the previous day here
    expect(new Date("2026-10-09").getDate()).toBe(8);
  });
});
