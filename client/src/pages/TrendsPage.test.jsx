import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import TrendsPage from "./TrendsPage";

// ── a fake API that answers per window, and can hold a response back ────────
const api = vi.hoisted(() => ({ calls: [], hold: null, release: null }));

const summaryFor = (startDate, endDate) => {
  const days = startDate === "2026-10-03"
    ? [{ date: "2026-10-04", energy: 3, mood: 4, pain: null, anxiety: null, appetite: null, sleep: null },
      { date: "2026-10-08", energy: 4, mood: 3, pain: null, anxiety: null, appetite: null, sleep: null }]
    : [{ date: "2026-10-01", energy: 3, mood: 3, pain: null, anxiety: null, appetite: null, sleep: null },
      { date: "2026-10-09", energy: 4, mood: 4, pain: null, anxiety: null, appetite: null, sleep: null }];
  const row = (cur, prev, cd, pd) => ({ current: { mean: cur, days: cd }, previous: { mean: prev, days: pd }, comparable: cd >= 5 && pd >= 5 });
  return {
    window: { startDate, endDate },
    days,
    comparison: {
      energy: row(3.7, 2.8, 6, 5), mood: row(3.5, 3, 6, 5), pain: row(null, null, 0, 0),
      anxiety: row(3.4, 3.1, 6, 4), appetite: row(null, null, 0, 0), sleep: row(3.2, 3.3, 4, 5),
    },
    minDays: 5,
    everLogged: true,
  };
};

vi.mock("axios", () => ({
  default: {
    get: vi.fn(async (url) => {
      api.calls.push(url);
      const q = new URLSearchParams(url.split("?")[1] || "");
      const s = q.get("startDate");
      const e = q.get("endDate");
      if (url.includes("/api/trends/summary")) {
        const body = { data: summaryFor(s, e) };
        if (api.hold && s === api.hold) return new Promise((resolve) => { api.release = () => resolve(body); });
        return body;
      }
      if (url.includes("/api/flares?")) return { data: { flares: [{ id: 1, startDate: "2026-10-02", endDate: null, note: null }] } };
      if (url.endsWith("/api/flares")) return { data: { flares: [] } };
      if (url.includes("/api/medications/changes")) {
        return { data: { changes: [{ id: 2, medicationId: 10, medicationName: "Tecfidera", kind: "changed", changedAt: "2026-10-05T06:30:00Z", changes: [{ field: "dosage", from: "120 mg", to: "240 mg" }] }] } };
      }
      if (url.includes("/api/medications/logs")) return { data: { logs: [] } };
      if (url.endsWith("/api/medications")) return { data: { medications: [] } };
      if (url.endsWith("/api/appointments")) {
        return { data: { appointments: [
          { id: 1, doctorName: "Dr. Lee", specialty: "Rheumatology", status: "completed", date: "2026-10-04T17:00:00Z", notesAfter: "private" },
          { id: 2, doctorName: "Dr. Reyes", status: "cancelled", date: "2026-10-06T17:00:00Z" },
        ] } };
      }
      if (url.endsWith("/api/insights")) return { data: { cards: [], meta: { message: "Keep going", sleepHint: false } } };
      return { data: {} };
    }),
  },
}));
vi.mock("../hooks/useAuth", () => ({ useAuth: () => ({ token: "t", user: { id: 1, username: "Megan" }, logout: vi.fn() }) }));

const NOW = new Date("2026-10-09T12:00:00"); // local, in the pinned zone (America/Los_Angeles)
const ranged = (path) => api.calls.filter((u) => u.includes(path) && u.includes("startDate="));
const pill = (name) => screen.getByRole("button", { name });

async function open() {
  render(<MemoryRouter><TrendsPage /></MemoryRouter>);
  await screen.findByText("Compared with the 30 days before");
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  Object.assign(api, { calls: [], hold: null, release: null });
});
afterEach(() => vi.useRealTimers());

describe("Trends range picker", () => {
  it("reads 7 days / 30 days / 90 days / 1 year, with 30 selected on open", async () => {
    await open();
    expect(["7 days", "30 days", "90 days", "1 year"].map((n) => pill(n).getAttribute("aria-pressed")))
      .toEqual(["false", "true", "false", "false"]);
    // one request each, for the 30 days ending today
    for (const path of ["/api/trends/summary", "/api/flares?", "/api/medications/changes", "/api/medications/logs"]) {
      expect(ranged(path)).toEqual([expect.stringContaining("startDate=2026-09-10&endDate=2026-10-09")]);
    }
  });

  it("7 days on Oct 9 asks for Oct 3 – Oct 9, not 8 days", async () => {
    await open();
    api.calls = [];
    await userEvent.click(pill("7 days"));
    await screen.findByText("Compared with the 7 days before");
    expect(pill("7 days").getAttribute("aria-pressed")).toBe("true");
    for (const path of ["/api/trends/summary", "/api/flares?", "/api/medications/changes", "/api/medications/logs"]) {
      expect(ranged(path)).toEqual([expect.stringContaining("startDate=2026-10-03&endDate=2026-10-09")]);
    }
  });

  it("a rapid 7 → 1 year → 7 ends on 7-day data, even when the year answers last", async () => {
    await open();
    api.hold = "2025-10-10"; // the 1-year request's start date
    await userEvent.click(pill("7 days"));
    await screen.findByText("Compared with the 7 days before");
    await userEvent.click(pill("1 year"));
    await userEvent.click(pill("7 days"));
    await waitFor(() => expect(pill("7 days").getAttribute("aria-pressed")).toBe("true"));
    api.release(); // the stale year finally lands
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.getByText("Compared with the 7 days before")).toBeTruthy();
    expect(screen.queryByText("Compared with the year before")).toBeNull();
  });
});

describe("annotations", () => {
  it("a dose change and an appointment on the same day share one marker, labelled with both", async () => {
    await open();
    // 06:30Z on Oct 5 is still Oct 4 in Los Angeles
    const marker = screen.getByRole("button", {
      name: "Dosage 120 mg → 240 mg · Tecfidera · Oct 4; Appointment · Dr. Lee (Rheumatology) · Oct 4",
    });
    expect(within(marker).getByText("2")).toBeTruthy(); // the count badge
    expect(screen.queryByText(/Dr\. Reyes/)).toBeNull(); // cancelled: never shown
    expect(screen.queryByText(/private/)).toBeNull(); // notes: never shown
  });

  it("the chart is described in one sentence for a screen reader", async () => {
    await open();
    expect(screen.getByRole("group", {
      name: "Last 30 days. 1 flare: Since Oct 2 · ongoing. 1 medication change. 1 appointment.",
    })).toBeTruthy();
  });

  it("tapping a marker opens its list; Escape closes it", async () => {
    await open();
    await userEvent.click(screen.getByRole("button", { name: /Tecfidera/ }));
    const pop = screen.getByRole("dialog", { name: "Annotations for this day" });
    expect(within(pop).getByText("Appointment · Dr. Lee (Rheumatology) · Oct 4")).toBeTruthy();
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("dialog", { name: "Annotations for this day" })).toBeNull();
  });

  it("turning Appointments off leaves a single dose-change marker", async () => {
    await open();
    const toggle = screen.getByRole("button", { name: "Appointments" });
    expect(toggle.getAttribute("aria-pressed")).toBe("true");
    await userEvent.click(toggle);
    expect(toggle.getAttribute("aria-pressed")).toBe("false");
    expect(screen.getByRole("button", { name: "Dosage 120 mg → 240 mg · Tecfidera · Oct 4" })).toBeTruthy();
  });
});

describe("period comparison", () => {
  it("rows for comparable metrics only, then one line for the rest", async () => {
    await open();
    expect(screen.getByText("Energy averaged 3.7 these 30 days vs 2.8 the 30 days before (6 vs 5 days logged)")).toBeTruthy();
    expect(screen.getByText("Mood averaged 3.5 these 30 days vs 3.0 the 30 days before (6 vs 5 days logged)")).toBeTruthy();
    expect(screen.getByText("Not enough days to compare yet for pain, anxiety, appetite, and sleep.")).toBeTruthy();
    expect(screen.getByText("Averages on the 1–5 scale, where 5 is best for every metric.")).toBeTruthy();
  });
});
