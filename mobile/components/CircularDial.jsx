import { View, Text, StyleSheet } from "react-native";
import Svg, { Circle } from "react-native-svg";

const SW = 5; // stroke width

export default function CircularDial({ value, color, label, size = 60 }) {
  const r = (size - SW) / 2;
  const c = size / 2;
  const circ = 2 * Math.PI * r;
  const filled = value > 0;
  const offset = filled ? circ * (1 - Math.min(value / 5, 1)) : circ;

  return (
    <View style={styles.outer}>
      <View style={{ width: size, height: size }}>
        <Svg width={size} height={size}>
          {/* Trail */}
          <Circle
            cx={c}
            cy={c}
            r={r}
            stroke="rgba(255,255,255,0.2)"
            strokeWidth={SW}
            fill="none"
          />
          {/* Arc */}
          <Circle
            cx={c}
            cy={c}
            r={r}
            stroke={color}
            strokeWidth={SW}
            fill="none"
            strokeDasharray={`${circ} ${circ}`}
            strokeDashoffset={offset}
            strokeLinecap="round"
            transform={`rotate(-90, ${c}, ${c})`}
          />
        </Svg>
        {/* Centered value overlaid on SVG */}
        <View style={[StyleSheet.absoluteFill, styles.center]}>
          <Text
            style={{
              fontFamily: "Lato_700Bold",
              fontSize: Math.max(10, Math.floor(size * 0.22)),
              color,
            }}
          >
            {filled ? value.toFixed(1) : "—"}
          </Text>
        </View>
      </View>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    alignItems: "center",
  },
  center: {
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    fontFamily: "Lato_400Regular",
    fontSize: 11,
    color: "rgba(255,255,255,0.65)",
    marginTop: 5,
    textAlign: "center",
  },
});
