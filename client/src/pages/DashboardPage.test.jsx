import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, within, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import axios from "axios";
import DashboardPage from "./DashboardPage";
import { exportDoctorReport } from "../utils/exportReport";
import { SECTION_KEYS } from "../utils/reportOptions";

// ── a fake API: just the reads the dashboard makes on load ──────────────────
const api = vi.hoisted(() => ({ checkIns: [], flares: [], failFlares: false, appointments: [] }));

vi.mock("axios", () => ({
  default: {
    get: vi.fn(async (url) => {
      if (url.endsWith("/api/checkins")) {
        api.loadedCheckIns = true;
        return { data: { checkIns: api.checkIns, weather: [] } };
      }
      if (url.endsWith("/api/flares")) {
        if (api.failFlares) throw new Error("network down");
        return { data: { flares: api.flares } };
      }
      if (url.endsWith("/api/appointments")) return { data: { appointments: api.appointments } };
      if (url.endsWith("/api/announcements")) return { data: { announcement: null } };
      return { data: {} };
    }),
    put: vi.fn(async () => ({ data: {} })),
    post: vi.fn(async () => ({ data: {} })),
    delete: vi.fn(async () => ({ data: {} })),
  },
}));
vi.mock("../hooks/useAuth", () => ({
  useAuth: () => ({
    token: "t",
    // welcome seen and every milestone celebrated, so no modal covers the page
    user: { id: 1, username: "Megan", hasSeenWelcome: true, celebratedMilestones: [7, 30, 90, 180, 365] },
    updateUser: vi.fn(),
    logout: vi.fn(),
  }),
}));
vi.mock("../utils/exportReport", () => ({ exportDoctorReport: vi.fn(async () => {}) }));

const NOW = new Date("2026-10-09T12:00:00"); // local time, in the pinned zone
const HOUR = 60 * 60 * 1000;

const checkInAgo = (ms) => ({
  id: 1,
  painLevel: 3, moodLevel: 3, energyLevel: 3, anxietyLevel: 3, appetiteLevel: 3,
  sleepLevel: null, symptoms: [], note: null,
  createdAt: new Date(NOW.getTime() - ms).toISOString(),
});
const ONGOING_FLARE = { id: 5, startDate: "2026-10-07", endDate: null, note: null };

async function open() {
  render(<MemoryRouter><DashboardPage /></MemoryRouter>);
  // the check-in list loads first; wait for it so states are not read mid-load
  await vi.waitFor(() => expect(api.loadedCheckIns).toBe(true));
}
const flareLinks = () => screen.queryAllByRole("button", { name: "Having a flare?" });
const prompt = () => screen.queryByText("How are you feeling right now?")?.parentElement;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  Object.assign(api, { checkIns: [], flares: [], failFlares: false, loadedCheckIns: false, appointments: [] });
  localStorage.clear();
  exportDoctorReport.mockClear();
});
afterEach(() => vi.useRealTimers());

describe("flares on the dashboard", () => {
  // "no link" proves nothing until the flares response has landed
  const flaresLoaded = () => vi.waitFor(() =>
    expect(axios.get.mock.calls.some(([url]) => url.endsWith("/api/flares"))).toBe(true));

  it("a first-time user: the check-in prompt, and no flare link", async () => {
    await open();
    await flaresLoaded();
    await act(async () => {});
    expect(prompt()).toBeTruthy();
    expect(flareLinks()).toHaveLength(0);
    expect(screen.queryByRole("button", { name: "Same as last time" })).toBeNull();
  });

  it("with a recent check-in: Same as last time stays, on its own", async () => {
    api.checkIns = [checkInAgo(30 * HOUR)];
    await open();
    await flaresLoaded();
    await act(async () => {});
    expect(within(prompt()).getByRole("button", { name: "Same as last time" })).toBeTruthy();
    expect(flareLinks()).toHaveLength(0);
    expect(prompt().querySelector('[aria-hidden="true"]')).toBeNull(); // no separator dot
  });

  it("Same as last time still opens the check-in on its review step", async () => {
    api.checkIns = [checkInAgo(30 * HOUR)];
    await open();
    await userEvent.click(await screen.findByRole("button", { name: "Same as last time" }));
    expect(await screen.findByRole("button", { name: "Submit Check-in" })).toBeTruthy();
  });

  it("after today's check-in: no prompt and still no flare link", async () => {
    api.checkIns = [checkInAgo(1 * HOUR)];
    await open();
    await flaresLoaded();
    await act(async () => {});
    expect(prompt()).toBeUndefined();
    expect(flareLinks()).toHaveLength(0);
  });

  it("an ongoing flare: the card, with It's eased and Edit working", async () => {
    api.checkIns = [checkInAgo(30 * HOUR)];
    api.flares = [ONGOING_FLARE];
    await open();
    await screen.findByText(/^Flare since/);
    expect(flareLinks()).toHaveLength(0);
    await userEvent.click(screen.getByRole("button", { name: "End this flare" }));
    expect(await screen.findByText("Glad it's easing")).toBeTruthy();
  });

  it("if flares fail to load, nothing flare-related renders", async () => {
    api.checkIns = [checkInAgo(30 * HOUR)];
    api.failFlares = true;
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    await open();
    await vi.waitFor(() => expect(logged).toHaveBeenCalledWith("Failed to fetch flares:", expect.any(Error)));
    expect(flareLinks()).toHaveLength(0);
    expect(screen.queryByText(/^Flare since/)).toBeNull();
    logged.mockRestore();
  });
});

describe("doctor report", () => {
  // the report button sits on the upcoming-appointments card
  const soon = { id: 1, doctorName: "Dr. Lee", specialty: "Rheumatology", status: "upcoming", date: new Date(NOW.getTime() + 2 * 24 * HOUR).toISOString() };
  const lastOptions = () => exportDoctorReport.mock.calls.at(-1)[0].options;

  it("one tap exports the default when nothing is remembered", async () => {
    api.appointments = [soon];
    api.checkIns = [checkInAgo(30 * HOUR)];
    await open();
    await userEvent.click(await screen.findByRole("button", { name: /Prepare doctor report/ }));
    expect(lastOptions()).toEqual({ from: "2026-09-09", to: "2026-10-09", sections: undefined });
    expect(screen.queryByText(/sections? off/)).toBeNull();
  });

  it("one tap uses the remembered choice, and the card says what it is", async () => {
    localStorage.setItem("reportPrefs.v1", JSON.stringify({
      preset: "last90", sections: SECTION_KEYS.filter((k) => k !== "weather" && k !== "patterns"),
    }));
    api.appointments = [soon];
    api.checkIns = [checkInAgo(30 * HOUR)];
    await open();
    expect(await screen.findByText("Last 90 days · 2 sections off")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: /Prepare doctor report/ }));
    expect(lastOptions()).toEqual({
      from: "2026-07-11", to: "2026-10-09",
      sections: SECTION_KEYS.filter((k) => k !== "weather" && k !== "patterns"),
    });
  });

  it("Customize passes its choice to the export and updates the card", async () => {
    api.appointments = [soon];
    api.checkIns = [checkInAgo(30 * HOUR)];
    await open();
    await userEvent.click(await screen.findByRole("button", { name: "Customize doctor report" }));
    await userEvent.click(screen.getByRole("radio", { name: "Last 90 days" }));
    await userEvent.click(screen.getByRole("checkbox", { name: "Observed patterns" }));
    await userEvent.click(screen.getByRole("button", { name: "Export" }));
    expect(lastOptions()).toEqual({
      from: "2026-07-11", to: "2026-10-09", sections: SECTION_KEYS.filter((k) => k !== "patterns"),
    });
    expect(await screen.findByText("Last 90 days · 1 section off")).toBeTruthy();
  });
});
