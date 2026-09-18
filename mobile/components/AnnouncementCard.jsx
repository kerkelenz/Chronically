import { useEffect, useRef, useState } from "react";
import {
  View, Text, Image, TouchableOpacity, Animated, StyleSheet, AccessibilityInfo,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

// TODO: Chronicle artwork — swap for mobile/assets/chronicle.svg once the
// mascot is drawn. The lavender sprig mark stands in so nothing blocks on art.
const chronicleMark = require("../assets/logo-mark.png");

const EXIT_MS = 260;

/**
 * A product update in Chronicle's voice, shown above the check-in prompt.
 * Dismissing fades and collapses the card, then tells the parent to drop it.
 */
export default function AnnouncementCard({ announcement, onDismiss }) {
  const anim = useRef(new Animated.Value(1)).current;
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled().then((v) => active && setReduceMotion(v));
    return () => {
      active = false;
    };
  }, []);

  if (!announcement) return null;

  const dismiss = () => {
    if (reduceMotion) {
      onDismiss?.(announcement.id);
      return;
    }
    Animated.timing(anim, {
      toValue: 0,
      duration: EXIT_MS,
      // height/margin can't run on the native thread, and collapsing is the
      // point of the exit — a fade alone leaves a gap where the card was
      useNativeDriver: false,
    }).start(() => onDismiss?.(announcement.id));
  };

  return (
    <Animated.View
      style={{
        opacity: anim,
        maxHeight: anim.interpolate({ inputRange: [0, 1], outputRange: [0, 400] }),
        marginBottom: anim.interpolate({ inputRange: [0, 1], outputRange: [0, 12] }),
        overflow: "hidden",
      }}
    >
      <View style={styles.card}>
        <Image source={chronicleMark} style={styles.avatar} resizeMode="contain" />

        <View style={styles.content}>
          <Text style={styles.label}>Chronicle</Text>
          <Text style={styles.title}>{announcement.title}</Text>
          <Text style={styles.body}>{announcement.body}</Text>
        </View>

        <TouchableOpacity
          onPress={dismiss}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Dismiss this update"
        >
          <Ionicons name="close" size={16} color="rgba(255,255,255,0.7)" />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
    padding: 16,
  },
  avatar: { width: 44, height: 44, flexShrink: 0 },
  content: { flex: 1, minWidth: 0 },
  label: {
    fontFamily: "Lato_700Bold",
    fontSize: 11,
    color: "rgba(255,255,255,0.6)",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  title: {
    fontFamily: "Lato_700Bold",
    fontSize: 15,
    color: "white",
    marginTop: 3,
  },
  body: {
    fontFamily: "Lato_400Regular",
    fontSize: 14,
    color: "rgba(255,255,255,0.8)",
    marginTop: 4,
    lineHeight: 20,
  },
});
