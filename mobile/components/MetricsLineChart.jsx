import React from "react";
import { View, Text, StyleSheet } from "react-native";
import Svg, { Path, Circle, Line, Text as SvgText } from "react-native-svg";
import { line, curveMonotoneX } from "d3-shape";

const SERIES = [
  { key: "energy",   color: "#8FAF9B" },
  { key: "mood",     color: "#C4A8C0" },
  { key: "pain",     color: "#7C6BAE" },
  { key: "anxiety",  color: "#9BAFC4" },
  { key: "appetite", color: "#C4A882" },
];

const CHART_HEIGHT = 240;
const PAD = { left: 34, right: 10, top: 10, bottom: 22 };
const GRID_VALUES = [1, 3, 5];
const GRID_LABELS = { 1: "Bad", 3: "Mid", 5: "Good" };
const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

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

  return (
    <View>
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
          const lineGen = line()
            .defined((pt) => pt[key] !== null && pt[key] !== undefined)
            .x((pt, i) => xFn(i))
            .y((pt) => yFn(pt[key]))
            .curve(curveMonotoneX);
          const trimmed = (lineGen(data) || "").trim();
          const nonNullPoints = data.filter((pt) => pt[key] !== null && pt[key] !== undefined);
          const nonNullCount = nonNullPoints.length;
          const lastPt = nonNullPoints[nonNullCount - 1];
          const lastIdx = lastPt ? data.indexOf(lastPt) : 0;
          const lastX = lastPt ? xFn(lastIdx) : 0;
          const lastY = lastPt ? yFn(lastPt[key]) : 0;
          return (
            <React.Fragment key={key}>
              {trimmed && nonNullCount > 1 && (
                <Path
                  d={trimmed}
                  stroke={color}
                  strokeWidth={2}
                  fill="none"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              )}
              {nonNullCount === 1 && (
                <Circle cx={lastX} cy={lastY} r={3} fill={color} />
              )}
            </React.Fragment>
          );
        })}
      </Svg>

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
});
