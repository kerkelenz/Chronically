import { render, screen, fireEvent, waitFor, within } from "@testing-library/react-native";
import { StyleSheet } from "react-native";
import DashboardScreen from "../app/(tabs)/index";

// ── a fake API: just the reads the dashboard makes on load ──────────────────
const mockApi = { checkIns: [], flares: [], failFlares: false, loaded: false };

jest.mock("../lib/api", () => ({
  __esModule: true,
  default: {
    get: jest.fn(async (url) => {
      if (url === "/api/checkins") return { data: { checkIns: mockApi.checkIns, weather: [] } };
      if (url === "/api/flares") {
        mockApi.loaded = true;
        if (mockApi.failFlares) throw new Error("network down");
        return { data: { flares: mockApi.flares } };
      }
      if (url === "/api/appointments") return { data: { appointments: [] } };
      if (url === "/api/announcements") return { data: { announcement: null } };
      return { data: {} };
    }),
    put: jest.fn(async () => ({ data: {} })),
    post: jest.fn(async () => ({ data: {} })),
    delete: jest.fn(async () => ({ data: {} })),
  },
}));
jest.mock("../context/AuthContext", () => ({
  // welcome seen and every milestone celebrated, so nothing covers the screen
  useAuth: () => ({
    user: { id: 1, username: "Megan", hasSeenWelcome: true, celebratedMilestones: [7, 30, 90, 180, 365] },
    updateUser: jest.fn(),
  }),
}));
// permission already settled, so the notification primer stays away
jest.mock("../lib/pushNotifications", () => ({ getPermissionState: jest.fn(async () => "granted") }));
jest.mock("../lib/analytics", () => ({ track: jest.fn() }));

const NOW = new Date("2026-10-09T12:00:00"); // local time, in the pinned zone
const HOUR = 60 * 60 * 1000;

const checkInAgo = (ms) => ({
  id: 1,
  painLevel: 3, moodLevel: 3, energyLevel: 3, anxietyLevel: 3, appetiteLevel: 3,
  sleepLevel: null, symptoms: [], note: null,
  date: "2026-10-08",
  createdAt: new Date(NOW.getTime() - ms).toISOString(),
});
const ONGOING_FLARE = { id: 5, startDate: "2026-10-07", endDate: null, note: null };

async function open() {
  render(<DashboardScreen />);
  // every load lands in one Promise.all; wait for the screen to settle on it
  await waitFor(() => expect(mockApi.loaded).toBe(true));
  await waitFor(() => expect(screen.queryByText("Could not load your data. Pull down to try again.")).toBeNull());
  await screen.findByText(/^Good (morning|afternoon|evening),/);
}
const flareLinks = () => screen.queryAllByRole("button", { name: "Having a flare?" });
const promptShown = () => screen.queryByText("How are you feeling right now?") !== null;
// the nearest enclosing row: where the quiet links sit side by side
function rowOf(el) {
  for (let n = el.parent; n; n = n.parent) {
    if (StyleSheet.flatten(n.props?.style)?.flexDirection === "row") return n;
  }
  return null;
}

beforeEach(() => {
  // fake only the clock; everything that schedules work stays real
  jest.useFakeTimers({
    doNotFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "setImmediate",
      "clearImmediate", "nextTick", "queueMicrotask", "requestAnimationFrame",
      "cancelAnimationFrame", "hrtime", "performance"],
  });
  jest.setSystemTime(NOW);
  Object.assign(mockApi, { checkIns: [], flares: [], failFlares: false, loaded: false });
});
afterEach(() => jest.useRealTimers());

describe("check-in prompt and the flare link", () => {
  it("a first-time user gets the flare link inside the prompt, once", async () => {
    await open();
    expect(promptShown()).toBe(true);
    expect(flareLinks()).toHaveLength(1);
    expect(screen.queryByRole("button", { name: "Same as last time" })).toBeNull();
  });

  it("with a recent check-in, both quiet links share one row in the prompt", async () => {
    mockApi.checkIns = [checkInAgo(30 * HOUR)];
    await open();
    const same = screen.getByRole("button", { name: "Same as last time" });
    expect(flareLinks()).toHaveLength(1);
    const row = rowOf(same);
    expect(row).not.toBeNull();
    expect(within(row).getByRole("button", { name: "Having a flare?" })).toBeTruthy();
    // the separator is decoration: hidden from screen readers, present on screen
    expect(screen.queryByText("·")).toBeNull();
    expect(within(row).getByText("·", { includeHiddenElements: true })).toBeTruthy();
  });

  it("both quiet links keep a full 44pt touch target", async () => {
    mockApi.checkIns = [checkInAgo(30 * HOUR)];
    await open();
    for (const name of ["Same as last time", "Having a flare?"]) {
      const btn = screen.getByRole("button", { name });
      expect(StyleSheet.flatten(btn.props.style).minHeight).toBeGreaterThanOrEqual(44);
    }
  });

  it("the flare link in the prompt opens the start-a-flare sheet", async () => {
    await open();
    fireEvent.press(flareLinks()[0]);
    expect(await screen.findByText("Start a flare")).toBeTruthy();
  });

  it("once today's check-in is done, the prompt goes and the flare link stands alone", async () => {
    mockApi.checkIns = [checkInAgo(1 * HOUR)];
    await open();
    expect(promptShown()).toBe(false);
    expect(flareLinks()).toHaveLength(1);
    expect(screen.queryByRole("button", { name: "Same as last time" })).toBeNull();
  });

  it("an ongoing flare means no link anywhere — the prompt shows without it", async () => {
    mockApi.checkIns = [checkInAgo(30 * HOUR)];
    mockApi.flares = [ONGOING_FLARE];
    await open();
    expect(screen.getByText(/^Flare since/)).toBeTruthy();
    expect(flareLinks()).toHaveLength(0);
    expect(screen.getByRole("button", { name: "Same as last time" })).toBeTruthy();
    expect(screen.queryByText("·", { includeHiddenElements: true })).toBeNull();
  });

  it("if flares fail to load, no flare link is offered at all", async () => {
    mockApi.checkIns = [checkInAgo(30 * HOUR)];
    mockApi.failFlares = true;
    await open();
    expect(promptShown()).toBe(true);
    expect(screen.getByRole("button", { name: "Same as last time" })).toBeTruthy();
    expect(flareLinks()).toHaveLength(0);
  });
});
