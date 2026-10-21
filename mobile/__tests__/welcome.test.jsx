import { render, screen, fireEvent, act } from "@testing-library/react-native";
import { Modal } from "react-native";
import WelcomeModal from "../components/WelcomeModal";

const mockApi = { puts: [] };
jest.mock("../lib/api", () => ({
  __esModule: true,
  default: {
    get: jest.fn(async () => ({ data: { tipsSeen: {} } })),
    put: jest.fn(async (url, body) => { mockApi.puts.push([url, body]); return { data: {} }; }),
  },
}));
const mockAuth = { updateUser: null, user: { id: 1, trackingMode: "mental", hasSeenWelcome: false } };
jest.mock("../context/AuthContext", () => ({
  useAuth: () => ({ user: mockAuth.user, updateUser: mockAuth.updateUser }),
}));
jest.mock("../lib/analytics", () => ({ track: jest.fn() }));
const { track } = require("../lib/analytics");

beforeEach(() => {
  mockApi.puts = [];
  mockAuth.updateUser = jest.fn();
  track.mockClear();
});
const urls = () => mockApi.puts.map(([u]) => u);

describe("WelcomeModal (phone)", () => {
  test("three steps: hello, the tracking question, then how tips work", async () => {
    const onClose = jest.fn();
    render(<WelcomeModal onClose={onClose} />);
    expect(screen.getByText("Welcome to Chronically")).toBeTruthy();
    expect(screen.getByLabelText("Step 1 of 3")).toBeTruthy();

    fireEvent.press(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByText("What would you like to keep track of?")).toBeTruthy();
    expect(screen.getByRole("radio", { name: "Both" }).props.accessibilityState.selected).toBe(true);
    await act(async () => { fireEvent.press(screen.getByRole("radio", { name: "My mind" })); });
    expect(mockApi.puts).toContainEqual(["/api/users/tracking-mode", { trackingMode: "mental" }]);
    expect(screen.getByText(/pain question is skipped/)).toBeTruthy();

    fireEvent.press(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByText("One thing at a time")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Skip" })).toBeNull();
    await act(async () => { fireEvent.press(screen.getByRole("button", { name: "Get started" })); });

    expect(urls()).toContain("/api/users/welcome");
    expect(track).toHaveBeenCalledWith("welcome_completed", { step: "pace", skipped: false });
    expect(mockAuth.updateUser).toHaveBeenCalledWith(expect.objectContaining({ hasSeenWelcome: true }));
    expect(onClose).toHaveBeenCalled();
  });

  test("Android back steps back, then skips from the first step", async () => {
    const onClose = jest.fn();
    render(<WelcomeModal onClose={onClose} />);
    fireEvent.press(screen.getByRole("button", { name: "Next" }));
    act(() => { screen.UNSAFE_getByType(Modal).props.onRequestClose(); });
    expect(screen.getByText("Welcome to Chronically")).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();
    await act(async () => { screen.UNSAFE_getByType(Modal).props.onRequestClose(); });
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(track).toHaveBeenCalledWith("welcome_completed", { step: "hello", skipped: true });
  });

  test("a replay starts on the current focus and changes nothing else", async () => {
    const onClose = jest.fn();
    render(<WelcomeModal replay onClose={onClose} />);
    fireEvent.press(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByRole("radio", { name: "My mind" }).props.accessibilityState.selected).toBe(true);
    fireEvent.press(screen.getByRole("button", { name: "Next" }));
    await act(async () => { fireEvent.press(screen.getByRole("button", { name: "Done" })); });
    expect(urls()).not.toContain("/api/users/welcome");
    expect(track).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });
});
