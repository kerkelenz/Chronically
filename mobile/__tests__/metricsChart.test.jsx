import { render } from "@testing-library/react-native";
import MetricsLineChart from "../components/MetricsLineChart";
import { rangeWindow, buildAnnotations } from "../theme/trendHelpers";
import { formatFlareRange } from "../theme/flareHelpers";

// Draw the SVG as plain host elements that keep their props, so the geometry
// can be read back. (The shared stub renders nothing.)
jest.mock("react-native-svg", () => require("./support/svgRecorder"));

const PAD_LEFT = 34;
const PLOT_W = 300 - 34 - 10; // width − PAD.left − PAD.right
const win = rangeWindow("2026-10-09", 30); // Sep 10 … Oct 9
const row = (date, x) => ({ date, x, energy: 3, mood: 4, pain: null, anxiety: null, appetite: null, sleep: null });
const colLeft = (idx) => PAD_LEFT + (idx / 30) * PLOT_W;

function draw({ rows, flares = [] }) {
  const { bands, markers } = buildAnnotations({
    window: win, flares, changes: [], appointments: [], todayYmd: "2026-10-09",
    describeChange: () => [], formatFlareRange,
  });
  return render(<MetricsLineChart data={rows} width={300} win={win} bands={bands} markers={markers} />);
}
const pathStart = (d) => Number(d.match(/^M([\d.]+)/)[1]);

test("x is the calendar day: Oct 1 and Oct 9 sit 8 day-columns apart, not at the two edges", () => {
  const { UNSAFE_root } = draw({ rows: [row("2026-10-01", 21), row("2026-10-09", 29)] });
  const energy = UNSAFE_root.findAll((n) => n.type === "svg-path" && n.props.stroke === "#8FAF9B")[0];
  const start = pathStart(energy.props.d);
  expect(start).toBeCloseTo(PAD_LEFT + (21.5 / 30) * PLOT_W, 1);
  // the path is "M x,y L x,y": its last point is Oct 9's column centre
  const end = Number(energy.props.d.match(/L([\d.]+),[\d.]+$/)[1]);
  expect(end).toBeCloseTo(PAD_LEFT + (29.5 / 30) * PLOT_W, 1);
  expect(end - start).toBeCloseTo((8 / 30) * PLOT_W, 1);
});

test("a Sep 20 – Sep 24 flare shades exactly those five day columns", () => {
  const { UNSAFE_root } = draw({ rows: [row("2026-09-15", 5), row("2026-10-09", 29)], flares: [{ id: 1, startDate: "2026-09-20", endDate: "2026-09-24" }] });
  const [band] = UNSAFE_root.findAll((n) => n.type === "svg-rect");
  expect(band.props.x).toBeCloseTo(colLeft(10), 3); // Sep 20 is day 10
  expect(band.props.x + band.props.width).toBeCloseTo(colLeft(15), 3); // through the end of Sep 24
});

test("an ongoing flare runs to today's column; one begun before the window is clipped at the left edge", () => {
  const { UNSAFE_root } = draw({
    rows: [row("2026-09-15", 5), row("2026-10-09", 29)],
    flares: [{ id: 1, startDate: "2026-10-02", endDate: null }, { id: 2, startDate: "2026-09-01", endDate: "2026-09-12" }],
  });
  const rects = UNSAFE_root.findAll((n) => n.type === "svg-rect");
  const ongoing = rects.find((r) => r.props.x > colLeft(20));
  expect(ongoing.props.x + ongoing.props.width).toBeCloseTo(PAD_LEFT + PLOT_W, 3);
  const clipped = rects.find((r) => r.props.x <= PAD_LEFT + 0.001);
  expect(clipped.props.x).toBeCloseTo(PAD_LEFT, 3);
  expect(clipped.props.x + clipped.props.width).toBeCloseTo(colLeft(3), 3); // through Sep 12
});

test("x labels are calendar dates across the window, not row dates", () => {
  const { UNSAFE_root } = draw({ rows: [row("2026-10-01", 21), row("2026-10-09", 29)] });
  const labels = UNSAFE_root.findAll((n) => n.type === "svg-text" && n.props.textAnchor === "middle").map((n) => n.props.children);
  expect(labels).toEqual(["Sep 10", "Sep 17", "Sep 25", "Oct 2", "Oct 9"]);
});
