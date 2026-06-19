import { StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Defs, RadialGradient, Stop, Circle } from "react-native-svg";

const BLOB_SETS = {
  app: [
    { color: "#5C4E8A", size: 300, top: -50, left: -100 },
    { color: "#DEC8DA", size: 250, top: 200, right: -80 },
    { color: "#9B8EC4", size: 280, bottom: 300, left: -50 },
    { color: "#C4A8C0", size: 200, bottom: 100, right: -30 },
  ],
  auth: [
    { color: "#5C4E8A", size: 200, top: -50, left: -50 },
    { color: "#DEC8DA", size: 150, top: 50, right: -30 },
    { color: "#9B8EC4", size: 180, bottom: 80, left: 20 },
    { color: "#C4A8C0", size: 130, bottom: -20, right: 40 },
  ],
};

const PEAK = { app: 0.3, auth: 0.4 };

function Blob({ color, size, top, left, right, bottom, peak }) {
  const id = `blob-${color.replace("#", "")}-${size}`;
  return (
    <View
      pointerEvents="none"
      style={{ position: "absolute", width: size, height: size, top, left, right, bottom }}
    >
      <Svg width={size} height={size}>
        <Defs>
          <RadialGradient id={id} cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor={color} stopOpacity={peak} />
            <Stop offset="100%" stopColor={color} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={size / 2} cy={size / 2} r={size / 2} fill={`url(#${id})`} />
      </Svg>
    </View>
  );
}

export default function ScreenBackground({
  children,
  style,
  edges = ["top", "left", "right", "bottom"],
  blobVariant = "app",
}) {
  const blobs = BLOB_SETS[blobVariant] ?? BLOB_SETS.app;
  const peak = PEAK[blobVariant] ?? PEAK.app;
  return (
    <LinearGradient
      colors={["#7C6BAE", "#9B8EC4", "#C4A8C0"]}
      locations={[0, 0.55, 1]}
      start={{ x: 0.3, y: 0 }}
      end={{ x: 0.7, y: 1 }}
      style={StyleSheet.absoluteFill}
    >
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        {blobs.map((b, i) => (
          <Blob key={i} {...b} peak={peak} />
        ))}
      </View>
      <SafeAreaView edges={edges} style={[styles.safe, style]}>
        {children}
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
});
