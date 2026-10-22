import { render, screen, fireEvent, waitFor, act } from "@testing-library/react-native";
import { useLocalSearchParams } from "expo-router";
import CheckInScreen from "../app/checkin";

// ── a fake API: the flares read, and the two writes in order ────────────────
const mockApi = { flares: [], failFlares: false, failFlarePost: false, posts: [], flaresRead: false };

jest.mock("../lib/api", () => ({
  __esModule: true,
  default: {
    get: jest.fn(async (url) => {
      if (url === "/api/flares") {
        mockApi.flaresRead = true;
        if (mockApi.failFlares) throw new Error("network down");
        return { data: { flares: mockApi.flares } };
      }
      return { data: [] };
    }),
    post: jest.fn(async (url, body) => {
      mockApi.posts.push([url, body]);
      if (url === "/api/flares" && mockApi.failFlarePost) {
        const err = new Error("conflict");
        err.response = { status: 409, data: { error: "A flare is already going." } };
        throw err;
      }
      return { data: {} };
    }),
  },
}));
// the screen only opens when navigated to deliberately
jest.mock("../lib/checkinNav", () => ({ consumeDeliberateOpen: () => true }));
jest.mock("../context/AuthContext", () => ({ useAuth: () => ({ user: { id: 1, username: "Megan" } }) }));
jest.mock("../lib/analytics", () => ({ track: jest.fn() }));

const NOW = new Date("2026-10-09T12:00:00"); // local, in the pinned zone
// "Same as last time" answers: the check-in opens on its review step
const PREFILL = { painLevel: 3, moodLevel: 3, energyLevel: 3, anxietyLevel: 3, appetiteLevel: 3, symptoms: [] };
const LABEL = "This is the start of a flare";

beforeEach(() => {
  // fake only the clock; everything that schedules work stays real
  jest.useFakeTimers({
    doNotFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "setImmediate",
      "clearImmediate", "nextTick", "queueMicrotask", "requestAnimationFrame",
      "cancelAnimationFrame", "hrtime", "performance"],
  });
  jest.setSystemTime(NOW);
  Object.assign(mockApi, { flares: [], failFlares: false, failFlarePost: false, posts: [], flaresRead: false });
  useLocalSearchParams.mockReturnValue({ askSleep: "false", prefill: JSON.stringify(PREFILL) });
});
afterEach(() => jest.useRealTimers());

async function openReview() {
  render(<CheckInScreen />);
  await screen.findByText("Submit Check-in");
  // let the flares read land before asking whether the box is there
  await waitFor(() => expect(mockApi.flaresRead).toBe(true));
  await act(async () => {});
}
const flareBox = () => screen.queryByRole("checkbox", { name: LABEL });

describe("check-in: this is the start of a flare (phone)", () => {
  test("is offered, unchecked, when no flare is going", async () => {
    await openReview();
    expect(flareBox().props.accessibilityState.checked).toBe(false);
    expect(screen.getByText("I'll mark it from today. You can end it whenever it eases.")).toBeTruthy();
  });

  test("left unchecked: only the check-in is saved", async () => {
    await openReview();
    fireEvent.press(screen.getByText("Submit Check-in"));
    await waitFor(() => expect(mockApi.posts).toHaveLength(1));
    expect(mockApi.posts[0][0]).toBe("/api/checkins");
  });

  test("checked: the flare is started after the check-in, from the same date", async () => {
    await openReview();
    fireEvent.press(flareBox());
    expect(flareBox().props.accessibilityState.checked).toBe(true);
    fireEvent.press(screen.getByText("Submit Check-in"));
    await waitFor(() => expect(mockApi.posts).toHaveLength(2));
    const [[first, checkIn], [second, flare]] = mockApi.posts;
    expect(first).toBe("/api/checkins");
    expect(second).toBe("/api/flares");
    expect(flare).toEqual({ startDate: checkIn.date });
    expect(checkIn.date).toBe("2026-10-09");
  });

  test("isn't offered while a flare is ongoing", async () => {
    mockApi.flares = [{ id: 1, startDate: "2026-10-05", endDate: null }];
    await openReview();
    expect(flareBox()).toBeNull();
  });

  test("isn't offered if the flares read fails — and the check-in still works", async () => {
    mockApi.failFlares = true;
    await openReview();
    expect(flareBox()).toBeNull();
    fireEvent.press(screen.getByText("Submit Check-in"));
    await waitFor(() => expect(mockApi.posts.map(([u]) => u)).toEqual(["/api/checkins"]));
    await waitFor(() => expect(screen.queryByText("Submit Check-in")).toBeNull());
  });

  test("a failed flare start (e.g. 409) leaves the check-in successful, with no error shown", async () => {
    mockApi.failFlarePost = true;
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    await openReview();
    fireEvent.press(flareBox());
    fireEvent.press(screen.getByText("Submit Check-in"));
    await waitFor(() => expect(mockApi.posts.map(([u]) => u)).toEqual(["/api/checkins", "/api/flares"]));
    // the review step is gone (celebration), and no error line appeared
    await waitFor(() => expect(screen.queryByText("Submit Check-in")).toBeNull());
    expect(screen.queryByText(/Something went wrong/)).toBeNull();
    expect(screen.queryByText(/already going/)).toBeNull();
    warn.mockRestore();
  });
});
