import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axios from "axios";
import TipsOverlay from "./TipsOverlay";
import { setTipsToken, useScreenTips } from "../lib/tipsStore";
import { track } from "../lib/analytics";

vi.mock("axios", () => ({
  default: {
    get: vi.fn(async () => ({ data: { tipsSeen: {} } })),
    put: vi.fn(async () => ({ data: {} })),
    delete: vi.fn(async () => ({ data: { tipsSeen: {} } })),
  },
}));
vi.mock("../lib/analytics", () => ({ track: vi.fn() }));

const TRENDS = [
  "Choose how far back to look. Shorter shows the texture of this week; longer shows the shape of things.",
  "When two things keep turning up together, I'll mention it here — always with how many days it's based on.",
  "All six measures, side by side. Higher is always better here, even for pain and anxiety.",
];

// stand-in anchors that report a real size
function Anchors({ ids }) {
  return ids.map((id) => (
    <div
      key={id}
      data-tip={id}
      ref={(el) => {
        if (el) el.getBoundingClientRect = () => ({ top: 100, left: 20, width: 200, height: 40, bottom: 140, right: 220, x: 20, y: 100 });
      }}
    >
      {id}
    </div>
  ));
}

function renderTips(ids, onDone = vi.fn()) {
  render(
    <>
      <Anchors ids={ids} />
      <TipsOverlay screen="trends" tipsSeen={{}} onDone={onDone} />
    </>,
  );
  return onDone;
}
const puts = () => axios.put.mock.calls.map((c) => c[0]);
const setReducedMotion = (on) => {
  window.matchMedia = (q) => ({
    matches: on && q.includes("reduce"), media: q, onchange: null,
    addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false,
  });
};

beforeEach(async () => {
  setReducedMotion(false);
  await act(async () => { setTipsToken("t"); });
  axios.put.mockClear();
  track.mockClear();
});
afterEach(() => setTipsToken(null));

describe("TipsOverlay", () => {
  it("shows the first tip as a dialog named by its text, with its count, and marks the screen seen", async () => {
    // a ref callback stubs the geometry after first render, so mount in two steps
    render(<Anchors ids={["trends.range", "trends.insights", "trends.chart"]} />);
    render(<TipsOverlay screen="trends" tipsSeen={{}} onDone={vi.fn()} />);
    const dialog = screen.getByRole("dialog", { name: TRENDS[0] });
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(screen.getByText("Tip 1 of 3")).toBeTruthy();
    expect(dialog.getAttribute("aria-describedby")).toBe(screen.getByText("Tip 1 of 3").id);
    expect(puts()).toEqual([expect.stringContaining("/api/users/tips/trends")]);
  });

  it("Next steps through; the last button reads Got it and completes", async () => {
    render(<Anchors ids={["trends.range", "trends.insights", "trends.chart"]} />);
    const onDone = vi.fn();
    render(<TipsOverlay screen="trends" tipsSeen={{}} onDone={onDone} />);
    await userEvent.click(screen.getByRole("button", { name: "Next tip" }));
    expect(screen.getByRole("dialog", { name: TRENDS[1] })).toBeTruthy();
    expect(screen.getByText("Tip 2 of 3")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Next tip" }));
    await userEvent.click(screen.getByRole("button", { name: "Got it" }));
    expect(onDone).toHaveBeenCalledWith("completed");
    expect(track).toHaveBeenCalledWith("tips_closed", { screen: "trends", outcome: "completed" });
    expect(puts()).toHaveLength(1); // marked once, when the first tip showed
  });

  it("Skip tips closes and is counted as skipped", async () => {
    render(<Anchors ids={["trends.range", "trends.insights"]} />);
    const onDone = vi.fn();
    render(<TipsOverlay screen="trends" tipsSeen={{}} onDone={onDone} />);
    await userEvent.click(screen.getByRole("button", { name: "Skip tips" }));
    expect(onDone).toHaveBeenCalledWith("skipped");
    expect(track).toHaveBeenCalledWith("tips_closed", { screen: "trends", outcome: "skipped" });
    expect(puts()).toHaveLength(1);
  });

  it("Escape skips", async () => {
    render(<Anchors ids={["trends.range"]} />);
    const onDone = vi.fn();
    render(<TipsOverlay screen="trends" tipsSeen={{}} onDone={onDone} />);
    await userEvent.keyboard("{Escape}");
    expect(onDone).toHaveBeenCalledWith("skipped");
  });

  it("a missing anchor is skipped: the count becomes of 2", () => {
    render(<Anchors ids={["trends.range", "trends.chart"]} />);
    render(<TipsOverlay screen="trends" tipsSeen={{}} onDone={vi.fn()} />);
    expect(screen.getByText("Tip 1 of 2")).toBeTruthy();
  });

  it("no anchor at all: nothing shows and the screen is not marked", () => {
    const onDone = renderTips([]);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(onDone).toHaveBeenCalledWith("empty");
    expect(puts()).toEqual([]);
    expect(track).not.toHaveBeenCalled();
  });

  it("the ring breathes, unless reduce motion is on", () => {
    render(<Anchors ids={["trends.range"]} />);
    const { unmount } = render(<TipsOverlay screen="trends" tipsSeen={{}} onDone={vi.fn()} />);
    return waitFor(() => expect(screen.getByTestId("tips-ring").className).toBe("tips-ring-pulse")).then(() => {
      unmount();
      setReducedMotion(true);
      render(<TipsOverlay screen="trends" tipsSeen={{}} onDone={vi.fn()} />);
      return waitFor(() => {
        const ring = screen.getByTestId("tips-ring");
        expect(ring.className).toBe("");
        expect(screen.getByRole("dialog").className).toBe("");
      });
    });
  });
});

describe("useScreenTips", () => {
  function Screen({ blocked }) {
    const tips = useScreenTips("trends", { blocked });
    return (
      <>
        <Anchors ids={["trends.range"]} />
        {tips.show && <TipsOverlay screen="trends" tipsSeen={tips.tipsSeen} onDone={tips.done} />}
      </>
    );
  }

  it("starts 600 ms after the screen is clear", async () => {
    render(<Screen blocked={false} />);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(await screen.findByRole("dialog", {}, { timeout: 1500 })).toBeTruthy();
  });

  it("blocked: nothing shows", async () => {
    render(<Screen blocked />);
    await new Promise((r) => setTimeout(r, 900));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("not enrolled (null) or unknown: nothing shows", async () => {
    axios.get.mockResolvedValueOnce({ data: { tipsSeen: null } });
    await act(async () => { setTipsToken("t"); });
    render(<Screen blocked={false} />);
    await new Promise((r) => setTimeout(r, 900));
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
