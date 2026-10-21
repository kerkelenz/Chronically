import { render, screen, fireEvent, waitFor, act } from "@testing-library/react-native";
import { Animated, Modal, AccessibilityInfo } from "react-native";
import TipsOverlay from "../components/TipsOverlay";
import { registerAnchor } from "../lib/tipAnchors";
import { setTipsSignedIn, useScreenTips } from "../lib/tipsStore";

const mockApi = { puts: [], ids: [], tipsSeen: {} };
jest.mock("../lib/api", () => ({
  __esModule: true,
  default: {
    get: jest.fn(async () => ({ data: { tipsSeen: mockApi.tipsSeen } })),
    put: jest.fn(async (url, body) => { mockApi.puts.push(url); mockApi.ids.push(...(body?.ids || [])); return { data: {} }; }),
    delete: jest.fn(async () => ({ data: { tipsSeen: {} } })),
  },
}));
jest.mock("../lib/analytics", () => ({ track: jest.fn() }));
const { track } = require("../lib/analytics");

const TRENDS = [
  "Choose how far back to look. Shorter shows the texture of this week; longer shows the shape of things.",
  "When two things keep turning up together, I'll mention it here — always with how many days it's based on.",
  "All six measures, side by side. Higher is always better here, even for pain and anxiety.",
];

// anchors that measure like real views, without a native layer
let unregister = [];
function anchors(ids) {
  unregister = ids.map((id, i) => registerAnchor(id, {
    current: { measureInWindow: (cb) => cb(20, 120 + i * 60, 200, 40) },
  }));
}

beforeEach(async () => {
  mockApi.puts = [];
  mockApi.ids = [];
  mockApi.tipsSeen = {};
  track.mockClear();
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(false);
  await act(async () => { setTipsSignedIn(true); });
  mockApi.puts = [];
  mockApi.ids = [];
});
afterEach(() => {
  unregister.forEach((u) => u());
  unregister = [];
  setTipsSignedIn(false);
  jest.restoreAllMocks();
});

function show(ids, onDone = jest.fn(), tipsSeen = {}) {
  anchors(ids);
  render(<TipsOverlay screen="trends" tipsSeen={tipsSeen} onDone={onDone} />);
  return onDone;
}

describe("TipsOverlay (phone)", () => {
  test("the first tip is read with its count, and that tip is marked seen", async () => {
    show(["trends.range", "trends.insights", "trends.chart"]);
    expect(await screen.findByLabelText(`Tip 1 of 3. ${TRENDS[0]}`)).toBeTruthy();
    expect(mockApi.puts).toEqual(["/api/users/tips"]);
    expect(mockApi.ids).toEqual(["trends.range"]);
  });

  test("Next tip steps through; the last button is Got it and completes", async () => {
    const onDone = show(["trends.range", "trends.insights", "trends.chart"]);
    fireEvent.press(await screen.findByRole("button", { name: "Next tip" }));
    expect(await screen.findByLabelText(`Tip 2 of 3. ${TRENDS[1]}`)).toBeTruthy();
    fireEvent.press(await screen.findByRole("button", { name: "Next tip" }));
    fireEvent.press(await screen.findByRole("button", { name: "Got it" }));
    expect(onDone).toHaveBeenCalledWith("completed", []);
    expect(track).toHaveBeenCalledWith("tips_closed", { screen: "trends", outcome: "completed", count: 3 });
    expect(mockApi.ids).toEqual(["trends.range", "trends.insights", "trends.chart"]);
  });

  test("Skip tips closes and is counted as skipped", async () => {
    const onDone = show(["trends.range", "trends.insights"]);
    fireEvent.press(await screen.findByRole("button", { name: "Skip tips" }));
    expect(onDone).toHaveBeenCalledWith("skipped", []);
    expect(track).toHaveBeenCalledWith("tips_closed", { screen: "trends", outcome: "skipped", count: 2 });
    // skipping declines the rest of the sequence too
    expect(new Set(mockApi.ids)).toEqual(new Set(["trends.range", "trends.insights"]));
  });

  test("a tip that arrives on its own: no count, no Skip — just Got it", async () => {
    show(["trends.range", "trends.chart"], jest.fn(), { "trends.range": true });
    expect(await screen.findByLabelText(TRENDS[2])).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Skip tips" })).toBeNull();
    expect(screen.getByRole("button", { name: "Got it" })).toBeTruthy();
  });

  test("Android back skips", async () => {
    const onDone = show(["trends.range"]);
    await screen.findByRole("button", { name: "Got it" });
    act(() => { screen.UNSAFE_getByType(Modal).props.onRequestClose(); });
    expect(onDone).toHaveBeenCalledWith("skipped", []);
  });

  test("a missing anchor is skipped: of 2", async () => {
    show(["trends.range", "trends.chart"]);
    expect(await screen.findByLabelText(`Tip 1 of 2. ${TRENDS[0]}`)).toBeTruthy();
  });

  test("no anchor at all: nothing shows and nothing is marked", async () => {
    const onDone = show([]);
    await waitFor(() => expect(onDone).toHaveBeenCalledWith("empty", []));
    expect(screen.queryByRole("button", { name: "Skip tips" })).toBeNull();
    expect(mockApi.puts).toEqual([]);
    expect(track).not.toHaveBeenCalled();
  });

  test("reduce motion: the ring doesn't breathe", async () => {
    AccessibilityInfo.isReduceMotionEnabled.mockResolvedValue(true);
    const loop = jest.spyOn(Animated, "loop");
    show(["trends.range"]);
    await screen.findByRole("button", { name: "Got it" });
    await act(async () => {});
    expect(loop).not.toHaveBeenCalled();
  });

  test("normally, the ring breathes", async () => {
    const loop = jest.spyOn(Animated, "loop");
    show(["trends.range"]);
    await screen.findByRole("button", { name: "Got it" });
    await waitFor(() => expect(loop).toHaveBeenCalled());
  });
});

describe("useScreenTips (phone)", () => {
  function Screen({ blocked }) {
    const tips = useScreenTips("trends", { blocked });
    return tips.show ? <TipsOverlay screen="trends" tipsSeen={tips.tipsSeen} onDone={tips.done} /> : null;
  }

  test("starts 600 ms after the screen is clear", async () => {
    anchors(["trends.range"]);
    render(<Screen blocked={false} />);
    expect(screen.queryByRole("button", { name: "Got it" })).toBeNull();
    expect(await screen.findByRole("button", { name: "Got it" }, { timeout: 1500 })).toBeTruthy();
  });

  test("blocked: nothing shows", async () => {
    anchors(["trends.range"]);
    render(<Screen blocked />);
    await act(async () => { await new Promise((r) => setTimeout(r, 900)); });
    expect(screen.queryByRole("button", { name: "Got it" })).toBeNull();
  });

  test("not enrolled: nothing shows", async () => {
    mockApi.tipsSeen = null;
    await act(async () => { setTipsSignedIn(true); });
    anchors(["trends.range"]);
    render(<Screen blocked={false} />);
    await act(async () => { await new Promise((r) => setTimeout(r, 900)); });
    expect(screen.queryByRole("button", { name: "Got it" })).toBeNull();
  });

  test("a feature that appears later brings its own tip, alone; the first one never repeats", async () => {
    anchors(["trends.range"]);
    render(<Screen blocked={false} />);
    fireEvent.press(await screen.findByRole("button", { name: "Got it" }, { timeout: 1500 }));
    await waitFor(() => expect(screen.queryByRole("button", { name: "Got it" })).toBeNull());

    // the chart arrives once there's data
    act(() => {
      unregister.push(registerAnchor("trends.chart", { current: { measureInWindow: (cb) => cb(20, 300, 200, 40) } }));
    });
    expect(await screen.findByLabelText(TRENDS[2], {}, { timeout: 1500 })).toBeTruthy();
    fireEvent.press(screen.getByRole("button", { name: "Got it" }));
    expect(mockApi.ids).toEqual(["trends.range", "trends.chart"]);
  });

  test("a closed screen shows nothing, even for a new feature", async () => {
    mockApi.tipsSeen = { trends: true };
    await act(async () => { setTipsSignedIn(true); });
    anchors(["trends.range", "trends.chart"]);
    render(<Screen blocked={false} />);
    await act(async () => { await new Promise((r) => setTimeout(r, 900)); });
    expect(screen.queryByRole("button", { name: "Got it" })).toBeNull();
  });
});
