import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axios from "axios";
import WelcomeModal from "./WelcomeModal";
import { track } from "../lib/analytics";

const auth = vi.hoisted(() => ({ updateUser: null, user: { id: 1, trackingMode: "mental", hasSeenWelcome: false } }));
vi.mock("axios", () => ({
  default: {
    get: vi.fn(async () => ({ data: { tipsSeen: {} } })),
    put: vi.fn(async () => ({ data: {} })),
  },
}));
vi.mock("../hooks/useAuth", () => ({
  useAuth: () => ({ token: "t", user: auth.user, updateUser: auth.updateUser }),
}));
vi.mock("../lib/analytics", () => ({ track: vi.fn() }));

const puts = () => axios.put.mock.calls.map((c) => c[0]);

beforeEach(() => {
  auth.updateUser = vi.fn();
  axios.put.mockClear();
  track.mockClear();
});

describe("WelcomeModal", () => {
  it("walks three steps: hello, the tracking question, then how tips work", async () => {
    const onClose = vi.fn();
    render(<WelcomeModal onClose={onClose} />);
    expect(screen.getByRole("dialog", { name: "Welcome to Chronically" })).toBeTruthy();
    expect(screen.getByRole("img", { name: "Step 1 of 3" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Back" })).toBeNull();

    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByRole("dialog", { name: "What would you like to keep track of?" })).toBeTruthy();
    // a new account starts on Both, preselected
    expect(screen.getByRole("radio", { name: "Both" }).getAttribute("aria-checked")).toBe("true");
    await userEvent.click(screen.getByRole("radio", { name: "My mind" }));
    expect(axios.put).toHaveBeenCalledWith(expect.stringMatching(/tracking-mode$/), { trackingMode: "mental" }, expect.anything());
    // the hint is honest about what the choice changes
    expect(screen.getByText(/pain question is skipped/)).toBeTruthy();

    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByRole("dialog", { name: "One thing at a time" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Skip" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Get started" }));

    expect(puts()).toContainEqual(expect.stringMatching(/\/api\/users\/welcome$/));
    expect(track).toHaveBeenCalledWith("welcome_completed", { step: "pace", skipped: false });
    expect(auth.updateUser).toHaveBeenCalledWith(expect.objectContaining({ hasSeenWelcome: true }));
    expect(onClose).toHaveBeenCalled();
  });

  it("Back returns a step", async () => {
    render(<WelcomeModal onClose={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    await userEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByRole("dialog", { name: "Welcome to Chronically" })).toBeTruthy();
  });

  it("Skip closes from any early step, and still enrols the account", async () => {
    const onClose = vi.fn();
    render(<WelcomeModal onClose={onClose} />);
    await userEvent.click(screen.getByRole("button", { name: "Skip" }));
    expect(puts()).toEqual([expect.stringMatching(/\/api\/users\/welcome$/)]);
    expect(track).toHaveBeenCalledWith("welcome_completed", { step: "hello", skipped: true });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("Escape skips", async () => {
    const onClose = vi.fn();
    render(<WelcomeModal onClose={onClose} />);
    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("a replay from Profile changes nothing but what's chosen, and starts on the current focus", async () => {
    const onClose = vi.fn();
    const onTrackingChange = vi.fn();
    render(<WelcomeModal replay onClose={onClose} onTrackingChange={onTrackingChange} />);
    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByRole("radio", { name: "My mind" }).getAttribute("aria-checked")).toBe("true");
    await userEvent.click(screen.getByRole("radio", { name: "My body" }));
    expect(onTrackingChange).toHaveBeenCalledWith("physical");
    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    await userEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(puts()).not.toContainEqual(expect.stringMatching(/\/api\/users\/welcome$/));
    expect(track).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });
});
