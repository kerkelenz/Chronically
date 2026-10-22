import { render, screen, fireEvent, waitFor } from "@testing-library/react-native";
import { router } from "expo-router";
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

describe("flares on the dashboard", () => {
  // every load lands in one Promise.all, so open() returns with flares loaded

  test("a first-time user: the check-in prompt, and no flare link", async () => {
    await open();
    expect(promptShown()).toBe(true);
    expect(flareLinks()).toHaveLength(0);
    expect(screen.queryByRole("button", { name: "Same as last time" })).toBeNull();
  });

  test("with a recent check-in: Same as last time stays, on its own", async () => {
    mockApi.checkIns = [checkInAgo(30 * HOUR)];
    await open();
    expect(screen.getByRole("button", { name: "Same as last time" })).toBeTruthy();
    expect(flareLinks()).toHaveLength(0);
    expect(screen.queryByText("·", { includeHiddenElements: true })).toBeNull(); // no separator dot
  });

  test("Same as last time still opens the check-in with the last answers", async () => {
    mockApi.checkIns = [checkInAgo(30 * HOUR)];
    await open();
    fireEvent.press(screen.getByRole("button", { name: "Same as last time" }));
    expect(router.push).toHaveBeenCalledWith(expect.objectContaining({
      pathname: "/checkin",
      params: expect.objectContaining({ prefill: expect.any(String) }),
    }));
  });

  test("after today's check-in: no prompt and still no flare link", async () => {
    mockApi.checkIns = [checkInAgo(1 * HOUR)];
    await open();
    expect(promptShown()).toBe(false);
    expect(flareLinks()).toHaveLength(0);
  });

  test("an ongoing flare: the card, with It's eased working", async () => {
    mockApi.checkIns = [checkInAgo(30 * HOUR)];
    mockApi.flares = [ONGOING_FLARE];
    await open();
    expect(screen.getByText(/^Flare since/)).toBeTruthy();
    expect(flareLinks()).toHaveLength(0);
    fireEvent.press(screen.getByRole("button", { name: "End this flare" }));
    expect(await screen.findByText("Glad it's easing")).toBeTruthy();
  });

  test("if flares fail to load, nothing flare-related renders", async () => {
    mockApi.checkIns = [checkInAgo(30 * HOUR)];
    mockApi.failFlares = true;
    await open();
    expect(flareLinks()).toHaveLength(0);
    expect(screen.queryByText(/^Flare since/)).toBeNull();
    expect(screen.getByRole("button", { name: "Same as last time" })).toBeTruthy();
  });
});
