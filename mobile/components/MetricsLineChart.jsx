import React, { useMemo, useRef, useState } from "react";
import { View, Text, StyleSheet, PanResponder, Pressable, ScrollView } from "react-native";
import Svg, { Path, Circle, Line, Rect, Text as SvgText } from "react-native-svg";
import { catmullRomPath } from "../lib/curve";
import { METRIC_LABELS } from "../theme/metrics";
import { flareDay } from "../theme/flareHelpers";
import { axisTicks, clusterMarkers, annotationSummary } from "../theme/trendHelpers";

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
const BAND_FILL = "rgba(196,168,192,0.22)";
const TICK_STROKE = "rgba(255,255,255,0.35)";
const LANE_H = 28;
// each lane marker is a 44pt target, so clusters closer than that merge and
// targets never overlap
const MIN_GAP_PX = 44;

const LONG_PRESS_MS = 250;
const MOVE_CANCEL_PX = 8; // pre-activation drift that means "scroll", not "hold"
const CARD_W = 170;

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

function Glyph({ items }) {
  if (items.length > 1) {
    return (
      <View style={styles.badge}>
        <Text style={styles.badgeText}>{items.length}</Text>
      </View>
    );
  }
  return items[0].type === "med" ? <View style={styles.diamond} /> : <View style={styles.ring} />;
}

const TOGGLES = [
  { key: "flares", label: "Flares" },
  { key: "med", label: "Medication changes" },
  { key: "appt", label: "Appointments" },
];

/**
 * The metrics chart on an honest calendar x-axis: day 0 is the window's first
 * day, so unlogged days take their real width. `data` holds logged days only
 * (from /api/trends/summary), each with `x` = its day index in `win`. Flares are bands
 * behind the lines; medication changes and appointments are markers in a lane
 * under the plot — outside the scrub's touch area, so tapping one never
 * starts a scrub.
 */
export default function MetricsLineChart({ data, width, win, bands = [], markers = [] }) {
  const days = win.days;
  const height = CHART_HEIGHT;
  const plotW = width - PAD.left - PAD.right;
  const plotH = height - PAD.top - PAD.bottom;
  const n = data.length;

  // the column for day i spans i−0.5 … i+0.5
  const xFn = (idx) => PAD.left + ((idx + 0.5) / days) * plotW;
  const yFn = (v) => PAD.top + (1 - (v - 1) / 4) * plotH;

  const [show, setShow] = useState({ flares: true, med: true, appt: true });
  const [openAt, setOpenAt] = useState(null);

  const counts = {
    flares: bands.length,
    med: markers.filter((m) => m.type === "med").length,
    appt: markers.filter((m) => m.type === "appt").length,
  };
  const visibleBands = show.flares ? bands : [];
  const visibleMarkers = useMemo(() => markers.filter((m) => show[m.type]), [markers, show]);
  // hidden types don't count towards a badge
  const clusters = useMemo(
    () => clusterMarkers(visibleMarkers, { days, plotWidth: plotW, minGapPx: MIN_GAP_PX }),
    [visibleMarkers, days, plotW],
  );
  const open = clusters.find((c) => c.dayIdx === openAt) || null;

  // ── The expensive drawing, rebuilt only when the data or size changes — a
  //    scrub sets state on every move and must not redraw a year of paths
  const seriesPaths = useMemo(() => SERIES.map(({ key, color }) => {
    // Split each series into contiguous runs at null gaps, then draw a
    // Catmull-Rom curve per run. Rows are logged days only, so a run carries
    // straight on across unlogged days and breaks only at a null.
    const runs = [];
    let run = [];
    data.forEach((pt) => {
      const v = pt[key];
      if (v === null || v === undefined) {
        if (run.length) { runs.push(run); run = []; }
      } else {
        run.push({ x: PAD.left + ((pt.x + 0.5) / days) * plotW, y: PAD.top + (1 - (v - 1) / 4) * plotH });
      }
    });
    if (run.length) runs.push(run);
    const d = runs.filter((r) => r.length > 1).map((r) => catmullRomPath(r)).join(" ");
    const nonNull = runs.reduce((s, r) => s + r.length, 0);
    const single = nonNull === 1 ? runs.find((r) => r.length === 1)[0] : null;
    return { key, color, d, single };
  }), [data, days, plotW, plotH]);

  const xLabels = useMemo(
    () => axisTicks(win, 5).map((t) => ({ ...t, x: PAD.left + ((t.idx + 0.5) / win.days) * plotW })),
    [win, plotW],
  );

  const bandRects = useMemo(() => visibleBands.map((b) => {
    const x1 = Math.max(PAD.left, PAD.left + (b.startIdx / days) * plotW);
    const x2 = Math.min(PAD.left + plotW, PAD.left + ((b.endIdx + 1) / days) * plotW);
    return { key: b.startDate, x: x1, w: Math.max(1, x2 - x1) };
  }), [visibleBands, days, plotW]);

  // ── Long-press → scrub inspector ────────────────────────────────────────────
  const [activeIndex, setActiveIndex] = useState(null);
  // fresh geometry for the once-created PanResponder to read
  const geom = useRef({ data, plotW, days });
  geom.current = { data, plotW, days };
  const timerRef = useRef(null);
  const activatedRef = useRef(false);
  const startLocX = useRef(0);  // touch X relative to the chart at grant
  const startPageX = useRef(0); // touch X in screen coords at grant

  // the nearest logged day to a finger, by day index
  const idxFromX = (x) => {
    const g = geom.current;
    if (g.data.length === 0) return null;
    const day = ((x - PAD.left) / g.plotW) * g.days - 0.5;
    let best = 0;
    g.data.forEach((row, i) => {
      if (Math.abs(row.x - day) < Math.abs(g.data[best].x - day)) best = i;
    });
    return best;
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
        setOpenAt(null);
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
  let activeBand = null;
  let activeMarkers = [];
  if (active != null) {
    const row = data[active];
    guideX = xFn(row.x);
    presentSeries = SERIES.filter(({ key }) => row[key] != null);
    activeBand = visibleBands.find((b) => row.x >= b.startIdx && row.x <= b.endIdx) || null;
    activeMarkers = visibleMarkers.filter((m) => m.dayIdx === row.x);
    const ys = presentSeries.map(({ key }) => yFn(row[key]));
    const avgY = ys.length ? ys.reduce((a, b) => a + b, 0) / ys.length : PAD.top;
    const dropLow = avgY < PAD.top + plotH / 3; // data sits high → drop card low
    const left = Math.max(0, Math.min(width - CARD_W, guideX - CARD_W / 2));
    cardStyle = {
      left,
      width: CARD_W,
      ...(dropLow ? { bottom: PAD.bottom + 4 } : { top: PAD.top + 4 }),
    };
  }

  const summary = annotationSummary({ bands: visibleBands, markers: visibleMarkers, days });

  return (
    <View>
      <View
        {...pan.panHandlers}
        accessible
        accessibilityRole="image"
        accessibilityLabel={summary}
      >
        <Svg width={width} height={height}>
          {/* Flare bands, behind everything else */}
          {bandRects.map((b) => (
            <Rect key={`band-${b.key}`} x={b.x} y={PAD.top} width={b.w} height={plotH} fill={BAND_FILL} />
          ))}

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

          {/* Marker ticks up through the plot */}
          {clusters.map((c) => (
            <Line
              key={`tick-${c.dayIdx}`}
              x1={xFn(c.dayIdx)}
              y1={PAD.top}
              x2={xFn(c.dayIdx)}
              y2={PAD.top + plotH}
              stroke={TICK_STROKE}
              strokeWidth={1}
              strokeDasharray="3 3"
            />
          ))}

          {/* X labels: calendar dates across the window (date string split — no new Date()) */}
          {xLabels.map((t) => (
            <SvgText
              key={t.idx}
              x={t.x}
              y={height - 4}
              fontSize={9}
              fill="rgba(255,255,255,0.6)"
              textAnchor="middle"
              fontFamily="Lato_400Regular"
            >
              {t.label}
            </SvgText>
          ))}

          {/* Series: path with gaps at null values; single-point dot */}
          {seriesPaths.map(({ key, color, d, single }) => (
            <React.Fragment key={key}>
              {d ? (
                <Path
                  d={d}
                  stroke={color}
                  strokeWidth={2}
                  fill="none"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              ) : null}
              {single ? <Circle cx={single.x} cy={single.y} r={3} fill={color} /> : null}
            </React.Fragment>
          ))}

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
            <Text style={styles.cardHeader}>{xLabelFor(data[active].date)}</Text>
            {presentSeries.map(({ key, color }) => {
              const v = data[active][key];
              const label = METRIC_LABELS[key]?.[Math.round(v)] ?? Math.round(v);
              return (
                <View key={key} style={styles.cardRow}>
                  <View style={[styles.cardDot, { backgroundColor: color }]} />
                  <Text style={styles.cardName}>{cap(key)}</Text>
                  <Text style={styles.cardValue}>{label}</Text>
                </View>
              );
            })}
            {activeBand ? (
              <Text style={styles.cardNote}>Flare · day {flareDay(activeBand.startDate, data[active].date)}</Text>
            ) : null}
            {activeMarkers.map((m) => (
              <Text key={m.text} style={styles.cardNote}>{m.text}</Text>
            ))}
          </View>
        )}
      </View>

      {/* Marker lane — outside the scrub's touch area */}
      <View style={{ height: LANE_H }}>
        {clusters.map((c) => (
          <Pressable
            key={`lane-${c.dayIdx}`}
            onPress={() => setOpenAt((cur) => (cur === c.dayIdx ? null : c.dayIdx))}
            style={[styles.laneTarget, { left: xFn(c.dayIdx) - 22 }]}
            hitSlop={{ top: 8, bottom: 8 }}
            accessibilityRole="button"
            accessibilityLabel={c.items.map((i) => i.text).join("; ")}
            accessibilityState={{ expanded: openAt === c.dayIdx }}
          >
            <Glyph items={c.items} />
          </Pressable>
        ))}
      </View>
      {open ? (
        <View style={styles.popover}>
          <ScrollView style={{ maxHeight: 6 * 22 }} scrollEnabled={open.items.length > 6} nestedScrollEnabled>
            {open.items.map((i) => (
              <Text key={i.text} style={styles.popoverText}>{i.text}</Text>
            ))}
          </ScrollView>
        </View>
      ) : null}

      {/* Legend */}
      <View style={styles.legend}>
        {SERIES.map(({ key, color }) => (
          <View key={key} style={styles.legendItem}>
            <View style={[styles.legendSwatch, { backgroundColor: color }]} />
            <Text style={styles.legendLabel}>{cap(key)}</Text>
          </View>
        ))}
      </View>

      {/* Annotation toggles — only for types that have something in range */}
      {counts.flares + counts.med + counts.appt > 0 ? (
        <View style={styles.toggles}>
          {TOGGLES.filter((t) => counts[t.key] > 0).map((t) => (
            <Pressable
              key={t.key}
              onPress={() => { setShow((s) => ({ ...s, [t.key]: !s[t.key] })); setOpenAt(null); }}
              style={[styles.toggle, !show[t.key] && styles.toggleOff]}
              accessibilityRole="switch"
              accessibilityState={{ checked: show[t.key] }}
              accessibilityLabel={t.label}
            >
              {t.key === "flares" ? <View style={styles.bandSwatch} /> : t.key === "med" ? <View style={styles.diamondSmall} /> : <View style={styles.ringSmall} />}
              <Text style={styles.toggleText}>{t.label}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function xLabelFor(dateStr) {
  const [, m, d] = dateStr.split("-").map(Number);
  return `${MONTHS[m - 1]} ${d}`;
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

  // Marker lane
  laneTarget: {
    position: "absolute",
    top: 0,
    width: 44,
    height: LANE_H,
    alignItems: "center",
    justifyContent: "center",
  },
  diamond: { width: 9, height: 9, backgroundColor: "white", transform: [{ rotate: "45deg" }] },
  ring: { width: 11, height: 11, borderRadius: 6, borderWidth: 2, borderColor: "white" },
  badge: {
    minWidth: 16,
    height: 16,
    paddingHorizontal: 4,
    borderRadius: 8,
    backgroundColor: "white",
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { fontFamily: "Lato_700Bold", fontSize: 10, color: "#342656" },
  popover: {
    marginTop: 4,
    backgroundColor: "rgba(52,38,86,0.98)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    borderRadius: 14,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  popoverText: { fontFamily: "Lato_400Regular", fontSize: 12, color: "white", paddingVertical: 3 },

  // Toggles
  toggles: { flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 4 },
  toggle: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: 44, paddingHorizontal: 6 },
  toggleOff: { opacity: 0.45 },
  toggleText: { fontFamily: "Lato_400Regular", fontSize: 12, color: "rgba(255,255,255,0.85)" },
  bandSwatch: { width: 14, height: 10, borderRadius: 2, backgroundColor: "rgba(196,168,192,0.55)" },
  diamondSmall: { width: 8, height: 8, backgroundColor: "white", transform: [{ rotate: "45deg" }] },
  ringSmall: { width: 10, height: 10, borderRadius: 5, borderWidth: 2, borderColor: "white" },

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
  cardNote: {
    fontFamily: "Lato_400Regular",
    fontSize: 11,
    color: "rgba(255,255,255,0.8)",
    marginTop: 4,
  },
});
