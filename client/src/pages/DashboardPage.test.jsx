import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
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

describe("check-in prompt and the flare link", () => {
  it("a first-time user gets the flare link inside the prompt, once", async () => {
    await open();
    await vi.waitFor(() => expect(flareLinks()).toHaveLength(1));
    expect(within(prompt()).getByRole("button", { name: "Having a flare?" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Same as last time" })).toBeNull();
  });

  it("with a recent check-in, both quiet links share one line in the prompt", async () => {
    api.checkIns = [checkInAgo(30 * HOUR)];
    await open();
    await vi.waitFor(() => expect(flareLinks()).toHaveLength(1));
    const same = within(prompt()).getByRole("button", { name: "Same as last time" });
    const flare = within(prompt()).getByRole("button", { name: "Having a flare?" });
    expect(same.parentElement).toBe(flare.parentElement);
    // the separator is decoration, not something a screen reader announces
    expect(same.parentElement.querySelector('[aria-hidden="true"]')?.textContent).toBe("·");
  });

  it("the flare link in the prompt opens the start-a-flare form", async () => {
    await open();
    await vi.waitFor(() => expect(flareLinks()).toHaveLength(1));
    await userEvent.click(flareLinks()[0]);
    expect(await screen.findByText("Start a flare")).toBeTruthy();
  });

  it("once today's check-in is done, the prompt goes and the flare link stands alone", async () => {
    api.checkIns = [checkInAgo(1 * HOUR)];
    await open();
    await vi.waitFor(() => expect(flareLinks()).toHaveLength(1));
    expect(prompt()).toBeUndefined();
    expect(screen.queryByRole("button", { name: "Same as last time" })).toBeNull();
  });

  it("an ongoing flare means no link anywhere — the prompt shows without it", async () => {
    api.checkIns = [checkInAgo(30 * HOUR)];
    api.flares = [ONGOING_FLARE];
    await open();
    // wait for the flare card, or "no link" would pass before flares even load
    await screen.findByText(/^Flare since/);
    expect(flareLinks()).toHaveLength(0);
    expect(within(prompt()).getByRole("button", { name: "Same as last time" })).toBeTruthy();
    expect(prompt().querySelector('[aria-hidden="true"]')).toBeNull();
  });

  it("if flares fail to load, no flare link is offered at all", async () => {
    api.checkIns = [checkInAgo(30 * HOUR)];
    api.failFlares = true;
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    await open();
    await screen.findByRole("button", { name: "Same as last time" });
    // the failure has to have landed, or "no link" proves nothing
    await vi.waitFor(() => expect(logged).toHaveBeenCalledWith("Failed to fetch flares:", expect.any(Error)));
    expect(flareLinks()).toHaveLength(0);
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
