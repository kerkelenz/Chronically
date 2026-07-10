import { useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  Easing,
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native";

const COLORS = ["#C4A8C0", "#9B8EC4", "#E5CFF7", "#B7A6D9", "rgba(255,255,255,0.85)"];

// pre-generated so every fall looks organic but the component stays simple
const PIECES = Array.from({ length: 26 }, (_, i) => ({
  key: i,
  leftPct: 4 + Math.random() * 92,           // % across the screen
  size: 5 + Math.random() * 6,               // 5–11px
  round: Math.random() < 0.5,                // circles + rounded rects
  petal: Math.random() < 0.25,               // a few petal-shaped ones
  color: COLORS[i % COLORS.length],
  delay: Math.random() * 700,                // staggered start
  duration: 2400 + Math.random() * 1200,     // 2.4–3.6s — unhurried
  swayDir: Math.random() < 0.5 ? 1 : -1,
  sway: 14 + Math.random() * 22,             // gentle horizontal drift
  spin: (Math.random() < 0.5 ? -1 : 1) * (90 + Math.random() * 120),
}));

function Piece({ p, fallDistance }) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anim = Animated.sequence([
      Animated.delay(p.delay),
      Animated.timing(progress, {
        toValue: 1,
        duration: p.duration,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]);
    anim.start();
    return () => anim.stop();
  }, [progress, p]);

  const translateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [-40, fallDistance],
  });
  const translateX = progress.interpolate({
    inputRange: [0, 0.25, 0.5, 0.75, 1],
    outputRange: [0, p.sway * p.swayDir, 0, -p.sway * p.swayDir * 0.7, p.sway * p.swayDir * 0.3],
  });
  const rotate = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", `${p.spin}deg`],
  });
  const opacity = progress.interpolate({
    inputRange: [0, 0.08, 0.75, 1],
    outputRange: [0, 0.85, 0.55, 0],
  });

  return (
    <Animated.View
      style={{
        position: "absolute",
        top: 0,
        left: `${p.leftPct}%`,
        width: p.petal ? p.size * 1.9 : p.size,
        height: p.size,
        borderRadius: p.petal ? p.size : p.round ? p.size / 2 : 2,
        backgroundColor: p.color,
        opacity,
        transform: [{ translateY }, { translateX }, { rotate }],
      }}
    />
  );
}

/** One-shot gentle lavender confetti fall. Renders nothing if the user has
 *  reduce-motion enabled — the affirmation itself is the celebration. */
export default function LavenderConfetti() {
  const { height } = useWindowDimensions();
  const [reduceMotion, setReduceMotion] = useState(null);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((v) => mounted && setReduceMotion(v));
    return () => { mounted = false; };
  }, []);

  if (reduceMotion !== false) return null; // wait for the check; skip if enabled

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {PIECES.map((p) => (
        <Piece key={p.key} p={p} fallDistance={height * 0.8} />
      ))}
    </View>
  );
}
