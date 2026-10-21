import { useEffect, useRef, useState } from "react";
import { refreshTips } from "../lib/tipsStore";
import {
  Modal, View, Text, TouchableOpacity, ScrollView, StyleSheet, AccessibilityInfo, findNodeHandle,
} from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import ChronicleMark from "./ChronicleMark";
import { TRACKING_OPTIONS } from "./TrackingFocusSheet";
import { useAuth } from "../context/AuthContext";
import api from "../lib/api";
import { track } from "../lib/analytics";
import { WELCOME_STEPS, WELCOME_FEATURES, WELCOME_PRIVACY, welcomeStepLabel } from "../theme/tips";

const ICONS = {
  checkin: <Ionicons name="checkmark-circle-outline" size={22} color="white" />,
  spoons: <MaterialCommunityIcons name="silverware-spoon" size={22} color="white" />,
  medications: <Ionicons name="medical" size={22} color="white" />,
  appointments: <Ionicons name="calendar" size={22} color="white" />,
  trends: <Ionicons name="trending-up" size={22} color="white" />,
};

/**
 * Chronicle's welcome: three short steps, skippable at any point. The first
 * close enrols a new account in tips (PUT /welcome); `replay` (from Profile)
 * just shows the steps again and changes nothing else. Web twin:
 * client/src/components/WelcomeModal.jsx — the copy is shared via theme/tips.js.
 */
export default function WelcomeModal({ onClose, onTrackingChange, replay = false }) {
  const { user, updateUser } = useAuth();
  const [step, setStep] = useState(0);
  // Preselected, and left alone if they skip — nobody is made to answer this
  // to get into the app.
  const [mode, setMode] = useState(() => (replay && user?.trackingMode) || "both");
  const titleRef = useRef(null);
  const closing = useRef(false);

  const current = WELCOME_STEPS[step];
  const last = step === WELCOME_STEPS.length - 1;

  const chooseMode = async (value) => {
    setMode(value);
    try {
      await api.put("/api/users/tracking-mode", { trackingMode: value });
      updateUser({ ...user, trackingMode: value });
      onTrackingChange?.(value);
    } catch {
      // non-fatal — "both" is the default and the Profile row is the other route
    }
  };

  const dismiss = async (skipped) => {
    if (closing.current) return;
    closing.current = true;
    if (!replay) {
      try {
        await api.put("/api/users/welcome");
      } catch {
        // non-fatal — still dismiss locally
      }
      // closing the welcome is what enrols a new account in tips
      refreshTips();
      track("welcome_completed", { step: current.id, skipped });
      updateUser({ ...user, hasSeenWelcome: true });
    }
    onClose();
  };

  // screen readers start each step at its title
  useEffect(() => {
    const node = titleRef.current && findNodeHandle(titleRef.current);
    if (node) AccessibilityInfo.setAccessibilityFocus?.(node);
  }, [step]);

  // Android back steps back, and skips from the first step
  const onBack = () => (step > 0 ? setStep((s) => s - 1) : dismiss(true));
  const hint = TRACKING_OPTIONS.find((o) => o.value === mode)?.hint;

  return (
    <Modal transparent animationType="fade" visible statusBarTranslucent onRequestClose={onBack}>
      <View style={styles.overlay}>
        <View style={styles.card} accessibilityViewIsModal>
          <View style={styles.topRow}>
            <View style={styles.dots} accessible accessibilityLabel={welcomeStepLabel(step)}>
              {WELCOME_STEPS.map((s, i) => (
                <View key={s.id} style={[styles.dot, i === step && styles.dotActive]} />
              ))}
            </View>
            {!last ? (
              <TouchableOpacity
                onPress={() => dismiss(true)}
                style={styles.skip}
                activeOpacity={0.7}
                accessibilityRole="button"
              >
                <Text style={styles.skipText}>{replay ? "Close" : "Skip"}</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.skip} />
            )}
          </View>

          <ScrollView contentContainerStyle={{ gap: 12, paddingBottom: 4 }} showsVerticalScrollIndicator={false}>
            {current.id !== "focus" && (
              <View style={styles.chronicleWrap}>
                <ChronicleMark size={current.id === "hello" ? 56 : 48} />
              </View>
            )}
            <View>
              <Text ref={titleRef} style={styles.title} accessibilityRole="header">{current.title}</Text>
              <Text style={styles.subtitle}>{current.body}</Text>
            </View>

            {current.id === "hello" && WELCOME_FEATURES.map((f) => (
              <View key={f.key} style={styles.row}>
                <View style={styles.iconWrap} importantForAccessibility="no-hide-descendants">{ICONS[f.key]}</View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowName}>{f.name}</Text>
                  <Text style={styles.rowDesc}>{f.desc}</Text>
                </View>
              </View>
            ))}

            {current.id === "focus" && (
              <View>
                <View style={styles.trackingRow} accessibilityRole="radiogroup">
                  {TRACKING_OPTIONS.map((o) => {
                    const active = mode === o.value;
                    return (
                      <TouchableOpacity
                        key={o.value}
                        style={[styles.trackingOpt, active && styles.trackingOptActive]}
                        onPress={() => chooseMode(o.value)}
                        activeOpacity={0.8}
                        accessibilityRole="radio"
                        accessibilityState={{ selected: active }}
                        accessibilityLabel={o.label}
                      >
                        <Text style={[styles.trackingOptText, active && styles.trackingOptTextActive]}>
                          {o.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                <Text style={styles.trackingSub} accessibilityLiveRegion="polite">{hint}</Text>
              </View>
            )}

            {current.id === "pace" && (
              <View style={{ gap: 10 }}>
                <Text style={styles.paceNote}>{current.note}</Text>
                <Text style={styles.note}>{WELCOME_PRIVACY}</Text>
              </View>
            )}
          </ScrollView>

          <View style={styles.footer}>
            {step > 0 && (
              <TouchableOpacity
                onPress={() => setStep((s) => s - 1)}
                style={styles.back}
                activeOpacity={0.7}
                accessibilityRole="button"
              >
                <Text style={styles.skipText}>Back</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.btn}
              onPress={() => (last ? dismiss(false) : setStep((s) => s + 1))}
              activeOpacity={0.85}
              accessibilityRole="button"
            >
              <Text style={styles.btnText}>{last ? (replay ? "Done" : "Get started") : "Next"}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(20,12,40,0.55)", justifyContent: "center", alignItems: "center", padding: 16 },
  card: {
    width: "100%", maxWidth: 420, maxHeight: "88%",
    backgroundColor: "rgba(52,38,86,0.98)",
    borderRadius: 24, borderWidth: 1, borderColor: "rgba(255,255,255,0.18)",
    paddingHorizontal: 24, paddingTop: 12, paddingBottom: 20,
  },
  topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 },
  dots: { flexDirection: "row", gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "rgba(255,255,255,0.3)" },
  dotActive: { width: 20, backgroundColor: "white" },
  skip: { minHeight: 44, minWidth: 44, justifyContent: "center", alignItems: "flex-end" },
  skipText: { fontFamily: "Lato_400Regular", fontSize: 14, color: "rgba(255,255,255,0.75)" },
  chronicleWrap: { alignItems: "center", marginTop: 4 },
  title: { fontFamily: "PlayfairDisplay_500Medium", fontSize: 24, lineHeight: 30, color: "white", textAlign: "center" },
  subtitle: { fontFamily: "Lato_400Regular", fontSize: 14, color: "rgba(255,255,255,0.8)", textAlign: "center", marginTop: 8, lineHeight: 21 },
  row: { flexDirection: "row", alignItems: "center", gap: 14 },
  iconWrap: { width: 30, alignItems: "center" },
  rowName: { fontFamily: "Lato_700Bold", fontSize: 15, color: "white" },
  rowDesc: { fontFamily: "Lato_400Regular", fontSize: 13, color: "rgba(255,255,255,0.72)", marginTop: 1 },
  paceNote: { fontFamily: "Lato_400Regular", fontSize: 13, color: "rgba(255,255,255,0.7)", textAlign: "center", lineHeight: 19 },
  note: { fontFamily: "Lato_400Regular", fontSize: 12, color: "rgba(255,255,255,0.55)", textAlign: "center" },
  trackingRow: { flexDirection: "row", gap: 8 },
  trackingOpt: {
    flex: 1, minHeight: 52, borderRadius: 16, alignItems: "center", justifyContent: "center", paddingHorizontal: 6,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.25)",
  },
  trackingOptActive: { backgroundColor: "white", borderColor: "white" },
  trackingOptText: { fontFamily: "Lato_700Bold", fontSize: 14, color: "white" },
  trackingOptTextActive: { color: "#7C6BAE" },
  trackingSub: { fontFamily: "Lato_400Regular", fontSize: 13, color: "rgba(255,255,255,0.7)", textAlign: "center", marginTop: 12, lineHeight: 19, minHeight: 19 },
  footer: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 16 },
  back: { minHeight: 44, minWidth: 44, justifyContent: "center", paddingHorizontal: 8 },
  btn: { flex: 1, minHeight: 48, backgroundColor: "white", borderRadius: 999, alignItems: "center", justifyContent: "center" },
  btnText: { fontFamily: "Lato_700Bold", fontSize: 15, color: "#7C6BAE" },
});
