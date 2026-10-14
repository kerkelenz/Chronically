import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import axios from "axios";
import ProfilePage from "./ProfilePage";
import { setTipsToken } from "../lib/tipsStore";

const api = vi.hoisted(() => ({ tipsSeen: null, failDelete: false }));

vi.mock("axios", () => ({
  default: {
    get: vi.fn(async (url) => (url.endsWith("/api/users/tips") ? { data: { tipsSeen: api.tipsSeen } } : { data: {} })),
    put: vi.fn(async () => ({ data: {} })),
    post: vi.fn(async () => ({ data: {} })),
    delete: vi.fn(async (url) => {
      if (url.endsWith("/api/users/tips") && api.failDelete) throw new Error("network down");
      return { data: { tipsSeen: {} } };
    }),
  },
}));
vi.mock("../hooks/useAuth", () => ({
  useAuth: () => ({ token: "t", user: { id: 1, username: "Megan", email: "m@x.test", celebratedMilestones: [] }, logout: vi.fn(), updateUser: vi.fn() }),
}));
vi.mock("../lib/analytics", () => ({ track: vi.fn() }));

async function open(tipsSeen) {
  api.tipsSeen = tipsSeen;
  await act(async () => { setTipsToken("t"); });
  render(<MemoryRouter><ProfilePage /></MemoryRouter>);
}

beforeEach(() => { api.failDelete = false; axios.delete.mockClear(); });
afterEach(() => setTipsToken(null));

describe("Profile: tips row", () => {
  it("reads Show tips for an account never enrolled", async () => {
    await open(null);
    expect(screen.getByRole("button", { name: "Show tips" })).toBeTruthy();
  });

  it("reads Show tips again once any screen has been seen", async () => {
    await open({ dashboard: true });
    expect(screen.getByRole("button", { name: "Show tips again" })).toBeTruthy();
  });

  it("a tap resets tips and says when they'll appear", async () => {
    await open({ dashboard: true, trends: true });
    await userEvent.click(screen.getByRole("button", { name: "Show tips again" }));
    expect(axios.delete).toHaveBeenCalledWith(expect.stringMatching(/\/api\/users\/tips$/), expect.anything());
    expect(await screen.findByText("Tips will appear the next time you open each screen.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Show tips" })).toBeTruthy();
  });

  it("a failed reset says so, gently", async () => {
    api.failDelete = true;
    await open(null);
    await userEvent.click(screen.getByRole("button", { name: "Show tips" }));
    expect(await screen.findByText("Couldn't do that just now. Please try again.")).toBeTruthy();
  });
});
