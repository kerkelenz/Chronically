import { useEffect, useRef } from "react";
import {
  Animated,
  Easing,
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native";

const PETALS = [
  { left: "10%", duration: 8000, delay: 0 },
  { left: "25%", duration: 11000, delay: 2000 },
  { left: "50%", duration: 9000, delay: 4000 },
  { left: "70%", duration: 12000, delay: 1000 },
  { left: "88%", duration: 10000, delay: 3000 },
];

function Petal({ left, duration, delay, distance }) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const seq = Animated.sequence([
      Animated.delay(delay),
      Animated.loop(
        Animated.timing(progress, {
          toValue: 1,
          duration,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      ),
    ]);
    seq.start();
    return () => seq.stop();
  }, [progress, duration, delay]);

  const translateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -distance],
  });
  const rotate = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });
  const opacity = progress.interpolate({
    inputRange: [0, 0.1, 0.9, 1],
    outputRange: [0, 0.6, 0.4, 0],
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.petal,
        { left, opacity, transform: [{ translateY }, { rotate }] },
      ]}
    />
  );
}

export default function FloatingPetals() {
  const { height } = useWindowDimensions();
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {PETALS.map((p, i) => (
        <Petal key={i} {...p} distance={height + 40} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  petal: {
    position: "absolute",
    bottom: -10,
    width: 6,
    height: 10,
    backgroundColor: "rgba(255,255,255,0.3)",
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
    borderBottomRightRadius: 6,
    borderBottomLeftRadius: 0,
  },
});
