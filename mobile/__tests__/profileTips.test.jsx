import { render, screen, fireEvent, act } from "@testing-library/react-native";
import ProfileScreen from "../app/(tabs)/profile";
import { setTipsSignedIn } from "../lib/tipsStore";

const mockApi = { tipsSeen: null, failDelete: false, deletes: [] };
jest.mock("../lib/api", () => ({
  __esModule: true,
  default: {
    get: jest.fn(async (url) => (url === "/api/users/tips" ? { data: { tipsSeen: mockApi.tipsSeen } } : { data: {} })),
    put: jest.fn(async () => ({ data: {} })),
    post: jest.fn(async () => ({ data: {} })),
    delete: jest.fn(async (url) => {
      mockApi.deletes.push(url);
      if (mockApi.failDelete) throw new Error("network down");
      return { data: { tipsSeen: {} } };
    }),
  },
}));
jest.mock("../context/AuthContext", () => ({
  useAuth: () => ({
    user: { id: 1, username: "Megan", email: "m@x.test", celebratedMilestones: [] },
    updateUser: jest.fn(),
    signOut: jest.fn(),
  }),
}));
jest.mock("../lib/pushNotifications", () => ({
  registerForPushNotifications: jest.fn(async () => ({})),
  unregisterPushNotifications: jest.fn(async () => {}),
  getPermissionState: jest.fn(async () => "granted"),
}));
jest.mock("../lib/analytics", () => ({ track: jest.fn() }));

async function open(tipsSeen) {
  mockApi.tipsSeen = tipsSeen;
  await act(async () => { setTipsSignedIn(true); });
  render(<ProfileScreen />);
}

beforeEach(() => { mockApi.failDelete = false; mockApi.deletes = []; });
afterEach(() => setTipsSignedIn(false));

describe("Profile: tips row (phone)", () => {
  test("Show tips for an account never enrolled; Show tips again once any screen is seen", async () => {
    await open(null);
    expect(screen.getByRole("button", { name: "Show tips" })).toBeTruthy();
    await act(async () => { mockApi.tipsSeen = { trends: true }; setTipsSignedIn(true); });
    expect(await screen.findByRole("button", { name: "Show tips again" })).toBeTruthy();
  });

  test("a tap resets tips and says when they'll appear", async () => {
    await open({ dashboard: true });
    fireEvent.press(screen.getByRole("button", { name: "Show tips again" }));
    expect(await screen.findByText("Tips will appear the next time you open each screen.")).toBeTruthy();
    expect(mockApi.deletes).toEqual(["/api/users/tips"]);
    expect(screen.getByRole("button", { name: "Show tips" })).toBeTruthy();
  });

  test("a failed reset says so, gently", async () => {
    mockApi.failDelete = true;
    await open(null);
    fireEvent.press(screen.getByRole("button", { name: "Show tips" }));
    expect(await screen.findByText("Couldn't do that just now. Please try again.")).toBeTruthy();
  });
});
