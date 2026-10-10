import { useEffect, useMemo, useRef, useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceArea, ReferenceLine,
} from "recharts";
import { curveCatmullRom } from "d3-shape";
import { METRIC_LABELS } from "../utils/metricLabels";
import { flareDay } from "../utils/flareHelpers";
import { axisTicks, clusterMarkers, annotationSummary } from "../utils/trendHelpers";

const METRIC_SERIES = [
  { key: "energy", color: "#8FAF9B" },
  { key: "mood", color: "#C4A8C0" },
  { key: "pain", color: "#7C6BAE" },
  { key: "anxiety", color: "#9BAFC4" },
  { key: "appetite", color: "#C4A882" },
  { key: "sleep", color: "#9AD0C8" },
];

// The plot's own box inside the chart: YAxis width 32 + margin left 0, and
// margin right 5. The marker lane lines up to the same x scale.
const PLOT_LEFT = 32;
const PLOT_RIGHT = 5;
const LANE_H = 28;
const MIN_GAP_PX = 24;
const BAND_FILL = "rgba(196,168,192,0.22)";
const TICK_STROKE = "rgba(255,255,255,0.35)";
const CARD = { background: "rgba(52,38,86,0.98)", border: "1px solid rgba(255,255,255,0.18)", borderRadius: 14 };

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

function reducedMotion() {
  try {
    return !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

/** A cluster's glyph: shape carries the type, so colour is never the only signal. */
function Glyph({ items }) {
  if (items.length > 1) {
    return (
      <span
        className="inline-flex items-center justify-center text-[10px] font-bold"
        style={{ minWidth: 16, height: 16, padding: "0 4px", borderRadius: 8, background: "white", color: "#342656" }}
      >
        {items.length}
      </span>
    );
  }
  if (items[0].type === "med") {
    return <span style={{ display: "inline-block", width: 9, height: 9, background: "white", transform: "rotate(45deg)" }} />;
  }
  return <span style={{ display: "inline-block", width: 11, height: 11, borderRadius: "50%", border: "2px solid white" }} />;
}

const SWATCH = {
  flares: <span style={{ display: "inline-block", width: 14, height: 10, background: "rgba(196,168,192,0.55)", borderRadius: 2 }} />,
  med: <span style={{ display: "inline-block", width: 8, height: 8, background: "white", transform: "rotate(45deg)" }} />,
  appt: <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: "50%", border: "2px solid white" }} />,
};

/**
 * The metrics chart on an honest calendar x-axis, with flares as bands behind
 * the lines and medication changes / appointments as markers in a lane under
 * the plot. `rows` come from /api/trends/summary (logged days only); `win` is
 * the window they belong to.
 */
export default function TrendsMetricsChart({ rows, win, annotations }) {
  const days = win.days;
  const [show, setShow] = useState({ flares: true, med: true, appt: true });
  const [openAt, setOpenAt] = useState(null); // the open cluster's dayIdx
  const [width, setWidth] = useState(0);
  const wrapRef = useRef(null);
  const laneRef = useRef(null);
  const animate = !reducedMotion();

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return undefined;
    if (typeof ResizeObserver === "undefined") return undefined;
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // until measured, cluster against a nominal width rather than zero
  const plotWidth = Math.max(1, (width || 600) - PLOT_LEFT - PLOT_RIGHT);
  const xPx = (idx) => PLOT_LEFT + ((idx + 0.5) / days) * plotWidth;

  const counts = {
    flares: annotations.bands.length,
    med: annotations.markers.filter((m) => m.type === "med").length,
    appt: annotations.markers.filter((m) => m.type === "appt").length,
  };
  const bands = show.flares ? annotations.bands : [];
  const markers = annotations.markers.filter((m) => show[m.type]);
  // hidden types don't count towards a badge
  const clusters = useMemo(
    () => clusterMarkers(markers, { days, plotWidth, minGapPx: MIN_GAP_PX }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [annotations, show, days, plotWidth],
  );
  const open = clusters.find((c) => c.dayIdx === openAt) || null;

  const ticks = axisTicks(win);
  const tickLabel = Object.fromEntries(ticks.map((t) => [t.idx, t.label]));

  // close the popover on Escape or a tap outside it
  useEffect(() => {
    if (openAt === null) return undefined;
    const onKey = (e) => { if (e.key === "Escape") setOpenAt(null); };
    const onDown = (e) => { if (laneRef.current && !laneRef.current.contains(e.target)) setOpenAt(null); };
    window.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
    };
  }, [openAt]);

  const summary = annotationSummary({ bands, markers, days });

  const tooltip = ({ active, payload }) => {
    if (!active || !payload || payload.length === 0) return null;
    const row = payload[0].payload;
    const band = bands.find((b) => row.x >= b.startIdx && row.x <= b.endIdx);
    const dayMarkers = markers.filter((m) => m.dayIdx === row.x);
    return (
      <div className="px-3 py-2 text-xs text-white" style={{ ...CARD, fontFamily: "Lato, sans-serif" }}>
        <p className="font-bold mb-1">{row.label}</p>
        {payload.filter((p) => p.value != null).map((p) => (
          <p key={p.dataKey} style={{ color: p.color }}>
            {cap(p.dataKey)}: {METRIC_LABELS[p.dataKey]?.[Math.round(p.value)] ?? p.value}
          </p>
        ))}
        {band && <p className="mt-1">Flare · day {flareDay(band.startDate, row.date)}</p>}
        {dayMarkers.map((m) => <p key={m.text} className="mt-0.5 text-white/80">{m.text}</p>)}
      </div>
    );
  };

  return (
    <div>
      <div ref={wrapRef} role="group" aria-label={summary} style={{ position: "relative" }}>
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={rows} margin={{ top: 5, right: PLOT_RIGHT, left: 0, bottom: 0 }}>
            <XAxis
              type="number"
              dataKey="x"
              domain={[-0.5, days - 0.5]}
              allowDataOverflow
              ticks={ticks.map((t) => t.idx)}
              tickFormatter={(v) => tickLabel[v] ?? ""}
              tick={{ fontSize: 10, fill: "rgba(255,255,255,0.7)" }}
            />
            <YAxis
              domain={[1, 5]}
              ticks={[1, 3, 5]}
              width={PLOT_LEFT}
              tick={{ fontSize: 9, fill: "rgba(255,255,255,0.7)" }}
              tickFormatter={(v) => ({ 1: "Bad", 3: "Mid", 5: "Good" })[v] ?? ""}
            />
            {/* behind the lines: drawn first */}
            {bands.map((b) => (
              <ReferenceArea
                key={`band-${b.startDate}`}
                x1={b.startIdx - 0.5}
                x2={b.endIdx + 0.5}
                fill={BAND_FILL}
                fillOpacity={1}
                strokeOpacity={0}
                ifOverflow="hidden"
              />
            ))}
            {clusters.map((c) => (
              <ReferenceLine key={`tick-${c.dayIdx}`} x={c.dayIdx} stroke={TICK_STROKE} strokeDasharray="3 3" />
            ))}
            <Tooltip content={tooltip} />
            {METRIC_SERIES.map(({ key, color }) => (
              <Line
                key={key}
                type={curveCatmullRom.alpha(0.5)}
                dataKey={key}
                stroke={color}
                strokeWidth={2}
                dot={false}
                isAnimationActive={animate}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>

        {/* the marker lane, on the plot's x scale */}
        <div ref={laneRef} style={{ position: "relative", height: LANE_H }}>
          {clusters.map((c) => {
            const label = c.items.map((i) => i.text).join("; ");
            return (
              <button
                key={`lane-${c.dayIdx}`}
                type="button"
                aria-label={label}
                aria-expanded={openAt === c.dayIdx}
                onClick={() => setOpenAt((cur) => (cur === c.dayIdx ? null : c.dayIdx))}
                className="absolute flex items-center justify-center"
                style={{ left: xPx(c.dayIdx) - 12, top: 0, width: 24, height: LANE_H }}
              >
                <Glyph items={c.items} />
              </button>
            );
          })}
          {open && (
            <div
              role="dialog"
              aria-label="Annotations for this day"
              className="absolute z-20 px-3 py-2 text-xs text-white"
              style={{
                ...CARD,
                fontFamily: "Lato, sans-serif",
                top: LANE_H + 4,
                left: Math.min(Math.max(0, xPx(open.dayIdx) - 110), Math.max(0, (width || 600) - 230)),
                width: 220,
                maxHeight: 6 * 22,
                overflowY: open.items.length > 6 ? "auto" : "visible",
              }}
            >
              {open.items.map((i) => <p key={i.text} className="py-0.5">{i.text}</p>)}
            </div>
          )}
        </div>

        {/* everything above, as text, for a screen reader */}
        <ul className="sr-only">
          {bands.map((b) => <li key={`sr-band-${b.startDate}`}>Flare: {b.label}</li>)}
          {markers.map((m) => <li key={`sr-${m.type}-${m.text}`}>{m.text}</li>)}
        </ul>
      </div>

      <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 mt-3">
        {METRIC_SERIES.map(({ key, color }) => (
          <span key={key} className="flex items-center gap-1 text-xs" style={{ color: "rgba(255,255,255,0.7)" }}>
            <span style={{ display: "inline-block", width: 16, height: 2, background: color, borderRadius: 1 }} />
            {key}
          </span>
        ))}
      </div>

      {(counts.flares > 0 || counts.med > 0 || counts.appt > 0) && (
        <div className="flex flex-wrap justify-center gap-x-2 mt-1">
          {[
            { key: "flares", label: "Flares" },
            { key: "med", label: "Medication changes" },
            { key: "appt", label: "Appointments" },
          ].filter((t) => counts[t.key] > 0).map((t) => (
            <button
              key={t.key}
              type="button"
              aria-pressed={show[t.key]}
              onClick={() => { setShow((s) => ({ ...s, [t.key]: !s[t.key] })); setOpenAt(null); }}
              className={`flex items-center gap-1.5 px-2 text-xs transition-opacity ${show[t.key] ? "text-white/85" : "text-white/45"}`}
              style={{ minHeight: 44 }}
            >
              <span style={{ opacity: show[t.key] ? 1 : 0.4, display: "inline-flex" }}>{SWATCH[t.key]}</span>
              {t.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
