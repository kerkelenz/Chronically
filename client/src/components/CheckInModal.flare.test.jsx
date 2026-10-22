import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axios from "axios";
import CheckInModal from "./CheckInModal";

// ── a fake API: the flares read, and the two writes in order ────────────────
const api = vi.hoisted(() => ({ flares: [], failFlares: false, failFlarePost: false, posts: [] }));

vi.mock("axios", () => ({
  default: {
    get: vi.fn(async (url) => {
      if (url.endsWith("/api/flares")) {
        if (api.failFlares) throw new Error("network down");
        return { data: { flares: api.flares } };
      }
      return { data: [] };
    }),
    post: vi.fn(async (url, body) => {
      api.posts.push([url.replace(/^.*\/api/, "/api"), body]);
      if (url.endsWith("/api/flares") && api.failFlarePost) {
        const err = new Error("conflict");
        err.response = { status: 409, data: { error: "A flare is already going." } };
        throw err;
      }
      return { data: {} };
    }),
  },
}));
vi.mock("../hooks/useAuth", () => ({ useAuth: () => ({ token: "t", user: { id: 1, username: "Megan" } }) }));
vi.mock("../lib/analytics", () => ({ track: vi.fn() }));

const NOW = new Date("2026-10-09T12:00:00"); // local, in the pinned zone
// "Same as last time" answers: the check-in opens on its review step
const PREFILL = { painLevel: 3, moodLevel: 3, energyLevel: 3, anxietyLevel: 3, appetiteLevel: 3, symptoms: [] };
const LABEL = "This is the start of a flare";

async function openReview() {
  render(<CheckInModal prefill={PREFILL} askSleep={false} onClose={vi.fn()} onComplete={vi.fn()} />);
  await screen.findByRole("button", { name: "Submit Check-in" });
  // let the flares read land before asking whether the box is there
  await waitFor(() => expect(axios.get.mock.calls.some(([u]) => u.endsWith("/api/flares"))).toBe(true));
  await act(async () => {});
}
const flareBox = () => screen.queryByRole("checkbox", { name: LABEL });
const submit = () => userEvent.click(screen.getByRole("button", { name: "Submit Check-in" }));

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  Object.assign(api, { flares: [], failFlares: false, failFlarePost: false, posts: [] });
  axios.get.mockClear();
});
afterEach(() => vi.useRealTimers());

describe("check-in: this is the start of a flare", () => {
  it("is offered, unchecked, when no flare is going — with its helper text", async () => {
    await openReview();
    expect(flareBox().checked).toBe(false);
    expect(flareBox().getAttribute("aria-describedby")).toBe("checkin-starts-flare-help");
    expect(screen.getByText("I'll mark it from today. You can end it whenever it eases.")).toBeTruthy();
  });

  it("left unchecked: only the check-in is saved", async () => {
    await openReview();
    await submit();
    await waitFor(() => expect(api.posts).toHaveLength(1));
    expect(api.posts[0][0]).toBe("/api/checkins");
  });

  it("checked: the flare is started after the check-in, from the same date", async () => {
    await openReview();
    await userEvent.click(flareBox());
    await submit();
    await waitFor(() => expect(api.posts).toHaveLength(2));
    const [[first, checkIn], [second, flare]] = api.posts;
    expect(first).toBe("/api/checkins");
    expect(second).toBe("/api/flares");
    expect(flare).toEqual({ startDate: checkIn.date });
    expect(checkIn.date).toBe("2026-10-09");
  });

  it("isn't offered while a flare is ongoing", async () => {
    api.flares = [{ id: 1, startDate: "2026-10-05", endDate: null }];
    await openReview();
    expect(flareBox()).toBeNull();
  });

  it("isn't offered if the flares read fails — and the check-in still works", async () => {
    api.failFlares = true;
    await openReview();
    expect(flareBox()).toBeNull();
    await submit();
    await waitFor(() => expect(api.posts.map(([u]) => u)).toEqual(["/api/checkins"]));
    expect(screen.queryByText(/Something went wrong/)).toBeNull();
  });

  it("a failed flare start (e.g. 409) leaves the check-in successful, with no error shown", async () => {
    api.failFlarePost = true;
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await openReview();
    await userEvent.click(flareBox());
    await submit();
    await waitFor(() => expect(api.posts.map(([u]) => u)).toEqual(["/api/checkins", "/api/flares"]));
    // the review step is gone (celebration), and no error line appeared
    await waitFor(() => expect(screen.queryByRole("button", { name: "Submit Check-in" })).toBeNull());
    expect(screen.queryByText(/Something went wrong/)).toBeNull();
    expect(screen.queryByText(/already going/)).toBeNull();
    warn.mockRestore();
  });
});
