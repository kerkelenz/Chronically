import React, { useRef, useState } from "react";
import { View, Text, StyleSheet, PanResponder } from "react-native";
import Svg, { Path, Circle, Line, Text as SvgText } from "react-native-svg";
import { catmullRomPath } from "../lib/curve";
import { METRIC_LABELS } from "../theme/metrics";

const SERIES = [
  { key: "energy",   color: "#8FAF9B" },
  { key: "mood",     color: "#C4A8C0" },
  { key: "pain",     color: "#7C6BAE" },
  { key: "anxiety",  color: "#9BAFC4" },
  { key: "appetite", color: "#C4A882" },
  { key: "sleep",    color: "#9AD0C8" },
];

const CHART_HEIGHT = 240;
const PAD = { left: 34, right: 10, top: 10, bottom: 22 };
const GRID_VALUES = [1, 3, 5];
const GRID_LABELS = { 1: "Bad", 3: "Mid", 5: "Good" };
const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const LONG_PRESS_MS = 250;
const MOVE_CANCEL_PX = 8; // pre-activation drift that means "scroll", not "hold"
const CARD_W = 170;

function formatShortDate(dateStr) {
  const [, m, d] = dateStr.split("-").map(Number);
  return `${MONTHS[m - 1]} ${d}`;
}

function getXLabelIndices(n) {
  if (n === 0) return [];
  const count = Math.min(n, 5);
  if (count === 1) return [0];
  return Array.from({ length: count }, (_, i) =>
    Math.round((i * (n - 1)) / (count - 1))
  );
}

export default function MetricsLineChart({ data, width }) {
  const height = CHART_HEIGHT;
  const plotW = width - PAD.left - PAD.right;
  const plotH = height - PAD.top - PAD.bottom;
  const n = data.length;

  const xFn = (i) =>
    PAD.left + (n > 1 ? i / (n - 1) : 0.5) * plotW;
  const yFn = (v) =>
    PAD.top + (1 - (v - 1) / 4) * plotH;

  const labelIndices = getXLabelIndices(n);

  // ── Long-press → scrub inspector ────────────────────────────────────────────
  const [activeIndex, setActiveIndex] = useState(null);
  // fresh geometry for the once-created PanResponder to read
  const geom = useRef({ n, plotW });
  geom.current = { n, plotW };
  const timerRef = useRef(null);
  const activatedRef = useRef(false);
  const startLocX = useRef(0);  // touch X relative to the chart at grant
  const startPageX = useRef(0); // touch X in screen coords at grant

  const idxFromX = (x) => {
    const g = geom.current;
    if (g.n <= 1) return 0;
    const i = Math.round(((x - PAD.left) / g.plotW) * (g.n - 1));
    return Math.max(0, Math.min(g.n - 1, i));
  };
  const cancelTimer = () => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
  };
  const dismiss = () => {
    cancelTimer();
    activatedRef.current = false;
    setActiveIndex(null);
  };

  const pan = useRef(
    PanResponder.create({
      // claim the touch so we get grant/move/release, but yield to the
      // ScrollView (below) until the long-press fires
      onStartShouldSetPanResponder: () => true,
      // before activation, let the ScrollView take the gesture to scroll;
      // once active, refuse so the scrub isn't stolen
      onPanResponderTerminationRequest: () => !activatedRef.current,
      onShouldBlockNativeResponder: () => false,

      onPanResponderGrant: (evt, g) => {
        startLocX.current = evt.nativeEvent.locationX;
        startPageX.current = g.x0;
        activatedRef.current = false;
        cancelTimer();
        timerRef.current = setTimeout(() => {
          activatedRef.current = true;
          setActiveIndex(idxFromX(startLocX.current));
        }, LONG_PRESS_MS);
      },

      onPanResponderMove: (evt, g) => {
        // map absolute drag back onto the chart-relative X (reliable during move)
        const x = startLocX.current + (g.moveX - startPageX.current);
        if (!activatedRef.current) {
          // moved before the hold landed → it's a scroll/swipe, abandon
          if (Math.abs(g.dx) > MOVE_CANCEL_PX || Math.abs(g.dy) > MOVE_CANCEL_PX) {
            cancelTimer();
          }
          return;
        }
        setActiveIndex(idxFromX(x));
      },

      onPanResponderRelease: dismiss,
      onPanResponderTerminate: dismiss,
    })
  ).current;

  // ── Active-inspector derived values (render only) ───────────────────────────
  const active =
    activeIndex != null && activeIndex >= 0 && activeIndex < n ? activeIndex : null;
  let guideX = 0;
  let presentSeries = [];
  let cardStyle = null;
  if (active != null) {
    guideX = xFn(active);
    presentSeries = SERIES.filter(({ key }) => data[active][key] != null);
    const ys = presentSeries.map(({ key }) => yFn(data[active][key]));
    const avgY = ys.length ? ys.reduce((a, b) => a + b, 0) / ys.length : PAD.top;
    const dropLow = avgY < PAD.top + plotH / 3; // data sits high → drop card low
    const left = Math.max(0, Math.min(width - CARD_W, guideX - CARD_W / 2));
    cardStyle = {
      left,
      width: CARD_W,
      ...(dropLow ? { bottom: PAD.bottom + 4 } : { top: PAD.top + 4 }),
    };
  }

  return (
    <View>
      <View {...pan.panHandlers}>
        <Svg width={width} height={height}>
          {/* Gridlines + Y labels */}
          {GRID_VALUES.map((v) => {
            const gy = yFn(v);
            return (
              <React.Fragment key={v}>
                <Line
                  x1={PAD.left}
                  y1={gy}
                  x2={width - PAD.right}
                  y2={gy}
                  stroke="rgba(255,255,255,0.15)"
                  strokeWidth={1}
                />
                <SvgText
                  x={PAD.left - 4}
                  y={gy + 3}
                  fontSize={9}
                  fill="rgba(255,255,255,0.7)"
                  textAnchor="end"
                  fontFamily="Lato_400Regular"
                >
                  {GRID_LABELS[v]}
                </SvgText>
              </React.Fragment>
            );
          })}

          {/* X labels (evenly spaced, date string split — no new Date()) */}
          {labelIndices.map((i) => (
            <SvgText
              key={i}
              x={xFn(i)}
              y={height - 4}
              fontSize={9}
              fill="rgba(255,255,255,0.6)"
              textAnchor="middle"
              fontFamily="Lato_400Regular"
            >
              {formatShortDate(data[i].date)}
            </SvgText>
          ))}

          {/* Series: path with gaps at null values; single-point dot */}
          {SERIES.map(({ key, color }) => {
            // Split each series into contiguous runs at null gaps, then draw a
            // Catmull-Rom curve per run. Gaps stay broken; 2-point runs render
            // as straight lines (handled inside catmullRomPath).
            const runs = [];
            let run = [];
            data.forEach((pt, i) => {
              const v = pt[key];
              if (v === null || v === undefined) {
                if (run.length) { runs.push(run); run = []; }
              } else {
                run.push({ x: xFn(i), y: yFn(v) });
              }
            });
            if (run.length) runs.push(run);

            const pathD = runs
              .filter((r) => r.length > 1)
              .map((r) => catmullRomPath(r))
              .join(" ");
            const nonNullCount = runs.reduce((s, r) => s + r.length, 0);
            const singlePoint = nonNullCount === 1
              ? runs.find((r) => r.length === 1)[0]
              : null;

            return (
              <React.Fragment key={key}>
                {pathD && (
                  <Path
                    d={pathD}
                    stroke={color}
                    strokeWidth={2}
                    fill="none"
                    strokeLinejoin="round"
                    strokeLinecap="round"
                  />
                )}
                {singlePoint && (
                  <Circle cx={singlePoint.x} cy={singlePoint.y} r={3} fill={color} />
                )}
              </React.Fragment>
            );
          })}

          {/* Inspector guideline + per-series dots (active only) */}
          {active != null && (
            <React.Fragment>
              <Line
                x1={guideX}
                y1={PAD.top}
                x2={guideX}
                y2={PAD.top + plotH}
                stroke="rgba(255,255,255,0.35)"
                strokeWidth={1}
              />
              {presentSeries.map(({ key, color }) => (
                <Circle
                  key={key}
                  cx={guideX}
                  cy={yFn(data[active][key])}
                  r={3.5}
                  fill={color}
                  stroke="rgba(255,255,255,0.8)"
                  strokeWidth={1.5}
                />
              ))}
            </React.Fragment>
          )}
        </Svg>

        {/* Value card — real Views/Text, above the SVG */}
        {active != null && (
          <View style={[styles.card, cardStyle]}>
            <Text style={styles.cardHeader}>{formatShortDate(data[active].date)}</Text>
            {presentSeries.map(({ key, color }) => {
              const v = data[active][key];
              const label = METRIC_LABELS[key]?.[Math.round(v)] ?? Math.round(v);
              return (
                <View key={key} style={styles.cardRow}>
                  <View style={[styles.cardDot, { backgroundColor: color }]} />
                  <Text style={styles.cardName}>
                    {key.charAt(0).toUpperCase() + key.slice(1)}
                  </Text>
                  <Text style={styles.cardValue}>{label}</Text>
                </View>
              );
            })}
          </View>
        )}
      </View>

      {/* Legend */}
      <View style={styles.legend}>
        {SERIES.map(({ key, color }) => (
          <View key={key} style={styles.legendItem}>
            <View style={[styles.legendSwatch, { backgroundColor: color }]} />
            <Text style={styles.legendLabel}>
              {key.charAt(0).toUpperCase() + key.slice(1)}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  legend: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginTop: 10,
    paddingHorizontal: 2,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  legendSwatch: {
    width: 16,
    height: 3,
    borderRadius: 2,
  },
  legendLabel: {
    fontFamily: "Lato_400Regular",
    fontSize: 11,
    color: "rgba(255,255,255,0.7)",
  },

  // Inspector card
  card: {
    position: "absolute",
    maxWidth: 190,
    backgroundColor: "rgba(52,38,86,0.98)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  cardHeader: {
    fontFamily: "Lato_700Bold",
    fontSize: 13,
    color: "white",
    marginBottom: 6,
  },
  cardRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 3,
  },
  cardDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  cardName: {
    fontFamily: "Lato_400Regular",
    fontSize: 12,
    color: "rgba(255,255,255,0.7)",
    flex: 1,
  },
  cardValue: {
    fontFamily: "Lato_700Bold",
    fontSize: 12,
    color: "white",
  },
});
