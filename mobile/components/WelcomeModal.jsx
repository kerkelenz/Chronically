import { useState } from "react";
import { Modal, View, Text, TouchableOpacity, ScrollView, StyleSheet } from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import ChronicleMark from "./ChronicleMark";
import { TRACKING_OPTIONS } from "./TrackingFocusSheet";
import { useAuth } from "../context/AuthContext";
import api from "../lib/api";
import { track } from "../lib/analytics";

const FEATURES = [
  { icon: <Ionicons name="checkmark-circle-outline" size={22} color="white" />, name: "Daily check-ins", desc: "Note how you're feeling in seconds." },
  { icon: <MaterialCommunityIcons name="silverware-spoon" size={22} color="white" />, name: "Spoon Center", desc: "Plan your day around the energy you have." },
  { icon: <Ionicons name="medical" size={22} color="white" />, name: "Medications", desc: "Keep doses, schedules, and history in one place." },
  { icon: <Ionicons name="calendar" size={22} color="white" />, name: "Appointments", desc: "Prep visits and bring a clean report to your doctor." },
  { icon: <Ionicons name="trending-up" size={22} color="white" />, name: "Trends", desc: "Watch your patterns come into focus over time." },
];

export default function WelcomeModal({ onClose }) {
  const { user, updateUser } = useAuth();
  // Preselected, and left alone if they skip or dismiss — nobody is made to
  // answer this to get into the app.
  const [mode, setMode] = useState("both");

  const chooseMode = async (value) => {
    setMode(value);
    try {
      await api.put("/api/users/tracking-mode", { trackingMode: value });
      updateUser({ ...user, trackingMode: value });
    } catch {
      // non-fatal — "both" is the default and the Profile row is the other route
    }
  };

  const dismiss = async () => {
    try {
      await api.put("/api/users/welcome");
    } catch {
      // non-fatal — still dismiss locally
    }
    track("welcome_completed");
    updateUser({ ...user, hasSeenWelcome: true });
    onClose();
  };

  return (
    <Modal transparent animationType="fade" visible statusBarTranslucent onRequestClose={dismiss}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <ScrollView contentContainerStyle={{ gap: 14 }} showsVerticalScrollIndicator={false}>
            <View>
              {/* Chronicle's introduction — the one placement every user sees */}
              <View style={styles.chronicleWrap}>
                <ChronicleMark size={64} />
              </View>
              <Text style={styles.title}>Welcome to Chronically</Text>
              <Text style={styles.subtitle}>
                A calm, private place to track life with a chronic illness — one day at a time.
              </Text>
            </View>
            {FEATURES.map((f) => (
              <View key={f.name} style={styles.row}>
                <View style={styles.iconWrap}>{f.icon}</View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowName}>{f.name}</Text>
                  <Text style={styles.rowDesc}>{f.desc}</Text>
                </View>
              </View>
            ))}
            <View>
              <Text style={styles.trackingQuestion}>What would you like to keep track of?</Text>
              <View style={styles.trackingRow}>
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
              <Text style={styles.trackingSub}>
                You can change this anytime in Profile. Everything stays searchable either way.
              </Text>
            </View>
            <Text style={styles.note}>No ads, no tracking — just gentle, everyday support. 💜</Text>
          </ScrollView>
          <TouchableOpacity style={styles.btn} onPress={dismiss} activeOpacity={0.85}>
            <Text style={styles.btnText}>Get started</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center", padding: 24 },
  card: {
    width: "100%", maxWidth: 380, maxHeight: "86%",
    backgroundColor: "rgba(52,38,86,0.98)",
    borderRadius: 24, borderWidth: 1, borderColor: "rgba(255,255,255,0.15)", padding: 24,
  },
  chronicleWrap: { alignItems: "center", marginBottom: 12 },
  title: { fontFamily: "PlayfairDisplay_500Medium", fontSize: 24, color: "white", textAlign: "center" },
  subtitle: { fontFamily: "Lato_400Regular", fontSize: 13, color: "rgba(255,255,255,0.8)", textAlign: "center", marginTop: 6, lineHeight: 19 },
  row: { flexDirection: "row", alignItems: "center", gap: 14 },
  iconWrap: { width: 30, alignItems: "center" },
  rowName: { fontFamily: "Lato_700Bold", fontSize: 15, color: "white" },
  rowDesc: { fontFamily: "Lato_400Regular", fontSize: 13, color: "rgba(255,255,255,0.72)", marginTop: 1 },
  note: { fontFamily: "Lato_400Regular", fontSize: 12, color: "rgba(255,255,255,0.6)", textAlign: "center", marginTop: 2 },
  trackingQuestion: { fontFamily: "Lato_700Bold", fontSize: 15, color: "white", textAlign: "center", marginBottom: 10 },
  trackingRow: { flexDirection: "row", gap: 8 },
  trackingOpt: {
    flex: 1, paddingVertical: 14, borderRadius: 14, alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.25)",
  },
  trackingOptActive: { backgroundColor: "white", borderColor: "white" },
  trackingOptText: { fontFamily: "Lato_700Bold", fontSize: 14, color: "white" },
  trackingOptTextActive: { color: "#7C6BAE" },
  trackingSub: { fontFamily: "Lato_400Regular", fontSize: 12, color: "rgba(255,255,255,0.6)", textAlign: "center", marginTop: 10, lineHeight: 17 },
  btn: { backgroundColor: "white", borderRadius: 999, paddingVertical: 14, alignItems: "center", marginTop: 16 },
  btnText: { fontFamily: "Lato_700Bold", fontSize: 15, color: "#5A3A60" },
});
