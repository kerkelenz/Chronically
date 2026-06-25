import React from "react";
import { StyleSheet, View } from "react-native";
import Svg, { Path, Circle, Line, Text as SvgText } from "react-native-svg";
import { line, curveMonotoneX } from "d3-shape";

const CHART_HEIGHT = 200;
const PAD = { left: 38, right: 10, top: 14, bottom: 22 };
const GRID_VALUES = [0, 50, 100];
const REF_LINES = [
  { value: 75, color: "#C4A882", label: "75%" },
  { value: 90, color: "#7FAF8A", label: "90%" },
];
const LINE_COLOR = "#8FAF9B";

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

export default function AdherenceLineChart({ data, width }) {
  const height = CHART_HEIGHT;
  const plotW = width - PAD.left - PAD.right;
  const plotH = height - PAD.top - PAD.bottom;
  const n = data.length;

  const xFn = (i) => PAD.left + (n > 1 ? i / (n - 1) : 0.5) * plotW;
  const yFn = (v) => PAD.top + (1 - v / 100) * plotH;

  const labelIndices = getXLabelIndices(n);

  // Build the path — no nulls in adherence data, always continuous
  const lineGen = line()
    .x((pt, i) => xFn(i))
    .y((pt) => yFn(pt.percentage))
    .curve(curveMonotoneX);
  const pathD = lineGen(data) || "";

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
                {v}%
              </SvgText>
            </React.Fragment>
          );
        })}

        {/* Reference lines (dashed) — drawn behind the data line */}
        {REF_LINES.map(({ value, color, label }) => {
          const ry = yFn(value);
          return (
            <React.Fragment key={value}>
              <Line
                x1={PAD.left}
                y1={ry}
                x2={width - PAD.right}
                y2={ry}
                stroke={color}
                strokeWidth={1}
                strokeDasharray="4,3"
                opacity={0.7}
              />
              <SvgText
                x={width - PAD.right - 2}
                y={ry - 3}
                fontSize={9}
                fill={color}
                textAnchor="end"
                fontFamily="Lato_400Regular"
                opacity={0.9}
              >
                {label}
              </SvgText>
            </React.Fragment>
          );
        })}

        {/* X labels */}
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

        {/* Data line */}
        {pathD.trim() && (
          <Path
            d={pathD.trim()}
            stroke={LINE_COLOR}
            strokeWidth={2}
            fill="none"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        )}

        {/* Dots at every point */}
        {data.map((pt, i) => (
          <Circle
            key={i}
            cx={xFn(i)}
            cy={yFn(pt.percentage)}
            r={3}
            fill={LINE_COLOR}
          />
        ))}
      </Svg>
    </View>
  );
}

// eslint-disable-next-line no-unused-vars
const styles = StyleSheet.create({});
