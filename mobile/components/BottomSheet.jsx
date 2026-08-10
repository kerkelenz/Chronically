import { useEffect, useRef, useState } from "react";
import {
  Modal, KeyboardAvoidingView, TouchableOpacity, View, ScrollView, Platform,
  StyleSheet, Animated, Easing, AccessibilityInfo, useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/**
 * Slide-up bottom sheet with the app's standard frosted card, scrim,
 * tap-to-dismiss, and keyboard avoidance. By default the card scrolls, so a
 * filled-out form (or the keyboard on smaller iPhones) can never clip the
 * bottom action buttons. Sheets that manage their own inner ScrollView should
 * pass `scrollable={false}` to avoid nested scrolling.
 *
 * Animation is hand-driven (Modal `animationType="none"`) so the scrim fades
 * *in place* — the background darkens where it stands — while the card slides
 * up through it. A plain `animationType="slide"` would drag the whole tree up,
 * scrim included, which reads as the darkness travelling with the card.
 */
export default function BottomSheet({
  visible, onClose, children, maxHeight = "88%", cardStyle, scrollable = true,
}) {
  const insets = useSafeAreaInsets();
  const { height: winHeight } = useWindowDimensions();
  // bottom-anchored card, so sliding it down by ~a screen height fully hides it
  const OFFSCREEN = winHeight || 800;

  // the Modal stays mounted through the exit animation, then unmounts
  const [mounted, setMounted] = useState(visible);
  const [reduceMotion, setReduceMotion] = useState(false);

  const scrimOpacity = useRef(new Animated.Value(visible ? 1 : 0)).current;
  const translateY = useRef(new Animated.Value(visible ? 0 : OFFSCREEN)).current;
  const cardOpacity = useRef(new Animated.Value(visible ? 1 : 0)).current; // reduce-motion only

  // respect the OS reduce-motion setting (subscribe on mount, like the confetti)
  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled().then((v) => { if (active) setReduceMotion(v); });
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduceMotion);
    return () => { active = false; sub?.remove?.(); };
  }, []);

  useEffect(() => {
    if (visible && !mounted) {
      setMounted(true); // render first, animate in once the re-render lands
      return;
    }
    if (visible && mounted) {
      // reset to the closed pose, then rise + fade the scrim in place
      scrimOpacity.setValue(0);
      const anims = [
        Animated.timing(scrimOpacity, { toValue: 1, duration: 180, useNativeDriver: true }),
      ];
      if (reduceMotion) {
        translateY.setValue(0);
        cardOpacity.setValue(0);
        anims.push(Animated.timing(cardOpacity, { toValue: 1, duration: 180, useNativeDriver: true }));
      } else {
        translateY.setValue(OFFSCREEN);
        cardOpacity.setValue(1);
        anims.push(Animated.timing(translateY, {
          toValue: 0, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: true,
        }));
      }
      Animated.parallel(anims).start();
    }
    if (!visible && mounted) {
      // reverse: scrim fades where it stands, card descends, then unmount
      const anims = [
        Animated.timing(scrimOpacity, { toValue: 0, duration: 160, useNativeDriver: true }),
      ];
      if (reduceMotion) {
        anims.push(Animated.timing(cardOpacity, { toValue: 0, duration: 160, useNativeDriver: true }));
      } else {
        anims.push(Animated.timing(translateY, {
          toValue: OFFSCREEN, duration: 220, easing: Easing.in(Easing.cubic), useNativeDriver: true,
        }));
      }
      Animated.parallel(anims).start(() => setMounted(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, mounted]);

  return (
    <Modal
      animationType="none"
      transparent
      statusBarTranslucent
      visible={mounted}
      onRequestClose={onClose}
    >
      <View style={styles.root}>
        {/* scrim fades in place; tapping it (outside the card) dismisses */}
        <Animated.View style={[StyleSheet.absoluteFill, styles.scrimBg, { opacity: scrimOpacity }]}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
        </Animated.View>

        {/* sliding layer: KAV keeps keyboard padding working around the card */}
        <KeyboardAvoidingView
          style={styles.avoider}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          pointerEvents="box-none"
        >
          <Animated.View
            style={{ transform: [{ translateY }], opacity: reduceMotion ? cardOpacity : 1 }}
          >
            <View style={[styles.card, { maxHeight }, cardStyle]}>
              {scrollable ? (
                <ScrollView
                  contentContainerStyle={{
                    paddingHorizontal: 24,
                    paddingTop: 24,
                    paddingBottom: insets.bottom + 20,
                  }}
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator={false}
                >
                  {children}
                </ScrollView>
              ) : (
                <View style={{ flexShrink: 1, paddingBottom: insets.bottom + 20 }}>{children}</View>
              )}
            </View>
          </Animated.View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scrimBg: { backgroundColor: "rgba(0,0,0,0.5)" },
  avoider: { flex: 1, justifyContent: "flex-end" },
  card: {
    backgroundColor: "rgba(52,38,86,0.98)",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    overflow: "hidden",
  },
});
