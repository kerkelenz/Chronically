import { View, Text, Image } from "react-native";

const mark = require("../assets/logo-mark.png");

/**
 * "Chronically" with the brand logo (C + lavender sprig) as the C — the
 * "statement C" sizing from web. Proportions measured from the asset:
 * mark aspect 0.964, C baseline at 88.4% of mark height.
 *
 * RN can't baseline-align an Image to Text, so we bottom-align and lift the
 * mark by a computed margin. TUNE: if the C looks like it floats or sinks by
 * a pixel or two on device, nudge BASELINE_LIFT (0.05–0.09 range).
 */
const BASELINE_LIFT = 0.07; // × fontSize

export default function BrandWordmark({ fontSize = 30, color = "white", style }) {
  const h = Math.round(fontSize * 1.12);
  const w = Math.round(h * 0.964);
  return (
    <View
      style={[{ flexDirection: "row", alignItems: "flex-end", justifyContent: "center" }, style]}
      accessible
      accessibilityRole="header"
      accessibilityLabel="Chronically"
    >
      <Image
        source={mark}
        resizeMode="contain"
        style={{
          width: w,
          height: h,
          marginBottom: Math.round(fontSize * BASELINE_LIFT),
          marginRight: Math.round(fontSize * -0.02),
        }}
      />
      <Text
        importantForAccessibility="no"
        style={{
          fontFamily: "PlayfairDisplay_500Medium",
          fontSize,
          lineHeight: fontSize,
          includeFontPadding: false, // Android: strip extra font-box padding so bottom ≈ descender
          color,
        }}
      >
        hronically
      </Text>
    </View>
  );
}
