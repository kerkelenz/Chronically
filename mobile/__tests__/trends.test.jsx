import { render, screen, fireEvent, waitFor, within } from "@testing-library/react-native";
import TrendsScreen from "../app/(tabs)/trends";

// ── a fake API that answers per window ──────────────────────────────────────
const mockApi = { calls: [] };

const mockSummary = (startDate, endDate) => {
  const row = (cur, prev, cd, pd) => ({ current: { mean: cur, days: cd }, previous: { mean: prev, days: pd }, comparable: cd >= 5 && pd >= 5 });
  return {
    window: { startDate, endDate },
    days: [
      { date: "2026-10-01", energy: 3, mood: 3, pain: null, anxiety: null, appetite: null, sleep: null },
      { date: "2026-10-09", energy: 4, mood: 4, pain: null, anxiety: null, appetite: null, sleep: null },
    ],
    comparison: {
      energy: row(3.7, 2.8, 6, 5), mood: row(3.5, 3, 6, 5), pain: row(null, null, 0, 0),
      anxiety: row(3.4, 3.1, 6, 4), appetite: row(null, null, 0, 0), sleep: row(3.2, 3.3, 4, 5),
    },
    minDays: 5,
    everLogged: true,
  };
};

jest.mock("../lib/api", () => ({
  __esModule: true,
  default: {
    get: jest.fn(async (url) => {
      mockApi.calls.push(url);
      const q = new URLSearchParams(url.split("?")[1] || "");
      if (url.includes("/api/trends/summary")) return { data: mockSummary(q.get("startDate"), q.get("endDate")) };
      if (url.includes("/api/flares?")) return { data: { flares: [{ id: 1, startDate: "2026-10-02", endDate: null, note: null }] } };
      if (url === "/api/flares") return { data: { flares: [] } };
      if (url.includes("/api/medications/changes")) {
        return { data: { changes: [{ id: 2, medicationId: 10, medicationName: "Tecfidera", kind: "changed", changedAt: "2026-10-05T06:30:00Z", changes: [{ field: "dosage", from: "120 mg", to: "240 mg" }] }] } };
      }
      if (url.includes("/api/medications/logs")) return { data: { logs: [] } };
      if (url === "/api/medications") return { data: { medications: [] } };
      if (url === "/api/appointments") {
        return { data: { appointments: [
          { id: 1, doctorName: "Dr. Lee", specialty: "Rheumatology", status: "completed", date: "2026-10-04T17:00:00Z" },
          { id: 2, doctorName: "Dr. Reyes", status: "cancelled", date: "2026-10-06T17:00:00Z" },
        ] } };
      }
      if (url === "/api/insights") return { data: { cards: [], meta: { message: "Keep going", sleepHint: false } } };
      return { data: {} };
    }),
  },
}));
jest.mock("../lib/analytics", () => ({ track: jest.fn() }));

const NOW = new Date("2026-10-09T12:00:00"); // local, in the pinned zone (America/Los_Angeles)
const ranged = (path) => mockApi.calls.filter((u) => u.includes(path) && u.includes("startDate="));
const selected = (name) => screen.getByRole("button", { name }).props.accessibilityState.selected;

beforeEach(() => {
  // fake only the clock; everything that schedules work stays real
  jest.useFakeTimers({
    doNotFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "setImmediate",
      "clearImmediate", "nextTick", "queueMicrotask", "requestAnimationFrame",
      "cancelAnimationFrame", "hrtime", "performance"],
  });
  jest.setSystemTime(NOW);
  mockApi.calls = [];
});
afterEach(() => jest.useRealTimers());

async function open() {
  render(<TrendsScreen />);
  await screen.findByText("Compared with the 30 days before");
}

describe("Trends range picker", () => {
  test("7 days / 30 days / 90 days / 1 year, with 30 selected and one ranged fetch each", async () => {
    await open();
    expect(["7 days", "30 days", "90 days", "1 year"].map(selected)).toEqual([false, true, false, false]);
    for (const path of ["/api/trends/summary", "/api/flares?", "/api/medications/changes", "/api/medications/logs"]) {
      expect(ranged(path)).toEqual([expect.stringContaining("startDate=2026-09-10&endDate=2026-10-09")]);
    }
  });

  test("7 days asks for Oct 3 – Oct 9 and becomes the selected pill", async () => {
    await open();
    mockApi.calls = [];
    fireEvent.press(screen.getByRole("button", { name: "7 days" }));
    await screen.findByText("Compared with the 7 days before");
    expect(selected("7 days")).toBe(true);
    expect(selected("30 days")).toBe(false);
    for (const path of ["/api/trends/summary", "/api/flares?", "/api/medications/changes", "/api/medications/logs"]) {
      expect(ranged(path)).toEqual([expect.stringContaining("startDate=2026-10-03&endDate=2026-10-09")]);
    }
  });

  test("1 year words the comparison as a year", async () => {
    await open();
    fireEvent.press(screen.getByRole("button", { name: "1 year" }));
    expect(await screen.findByText("Compared with the year before")).toBeTruthy();
    expect(screen.getByText("Energy averaged 3.7 this year vs 2.8 the year before (6 vs 5 days logged)")).toBeTruthy();
  });
});

describe("annotations", () => {
  test("a same-day dose change and appointment share one 44pt marker, labelled with both", async () => {
    await open();
    const marker = screen.getByRole("button", {
      name: "Dosage 120 mg → 240 mg · Tecfidera · Oct 4; Appointment · Dr. Lee (Rheumatology) · Oct 4",
    });
    expect(within(marker).getByText("2")).toBeTruthy();
    expect(marker.props.style).toEqual(expect.arrayContaining([expect.objectContaining({ width: 44 })]));
    expect(screen.queryByText(/Dr\. Reyes/)).toBeNull();
  });

  test("the chart's summary sentence is its accessible label", async () => {
    await open();
    expect(screen.getByLabelText("Last 30 days. 1 flare: Since Oct 2 · ongoing. 1 medication change. 1 appointment.")).toBeTruthy();
  });

  test("tapping the marker lists both; toggling Appointments off leaves a single diamond", async () => {
    await open();
    fireEvent.press(screen.getByRole("button", { name: /Tecfidera/ }));
    expect(screen.getByText("Appointment · Dr. Lee (Rheumatology) · Oct 4")).toBeTruthy();
    const toggle = screen.getByRole("switch", { name: "Appointments" });
    expect(toggle.props.accessibilityState.checked).toBe(true);
    fireEvent.press(toggle);
    await waitFor(() => expect(screen.getByRole("switch", { name: "Appointments" }).props.accessibilityState.checked).toBe(false));
    expect(screen.getByRole("button", { name: "Dosage 120 mg → 240 mg · Tecfidera · Oct 4" })).toBeTruthy();
  });
});

describe("period comparison", () => {
  test("rows for comparable metrics only, then one line for the rest", async () => {
    await open();
    expect(screen.getByText("Energy averaged 3.7 these 30 days vs 2.8 the 30 days before (6 vs 5 days logged)")).toBeTruthy();
    expect(screen.getByText("Mood averaged 3.5 these 30 days vs 3.0 the 30 days before (6 vs 5 days logged)")).toBeTruthy();
    expect(screen.getByText("Not enough days to compare yet for pain, anxiety, appetite, and sleep.")).toBeTruthy();
  });
});
