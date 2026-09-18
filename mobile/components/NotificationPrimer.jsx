import { useState } from "react";
import { Modal, View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { registerForPushNotifications } from "../lib/pushNotifications";
import { setPushDeclined } from "../lib/storage";
import { track } from "../lib/analytics";

const REASONS = [
  {
    icon: <Ionicons name="medical" size={22} color="white" />,
    name: "Medication reminders",
    desc: "A nudge at each dose time, only until you've logged it.",
  },
  {
    icon: <MaterialCommunityIcons name="bandage" size={22} color="white" />,
    name: "Patch removal",
    desc: "A reminder to take it off, timed from when you put it on.",
  },
  {
    icon: <Ionicons name="checkmark-circle-outline" size={22} color="white" />,
    name: "A gentle check-in nudge",
    desc: "One quiet reminder in the evening. Never a streak, never a scolding.",
  },
];

/**
 * Asked once, before the OS prompt, so the system dialog arrives with context —
 * and so declining here costs nothing permanent (iOS only ever shows its own
 * prompt once, and a cold "Don't Allow" can't be undone inside the app).
 */
export default function NotificationPrimer({ onDone }) {
  const [busy, setBusy] = useState(false);

  const enable = async () => {
    setBusy(true);
    const result = await registerForPushNotifications({ promptIfNeeded: true });
    track("notifications_prompt_answered", { result });
    // Whatever the OS said, don't ask again on our own — Profile has the toggle
    await setPushDeclined(true);
    setBusy(false);
    onDone();
  };

  const notNow = async () => {
    await setPushDeclined(true);
    track("notifications_prompt_answered", { result: "not_now" });
    onDone();
  };

  return (
    <Modal transparent animationType="fade" visible statusBarTranslucent onRequestClose={notNow}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.bellWrap}>
            <Ionicons name="notifications-outline" size={26} color="white" />
          </View>
          <Text style={styles.title}>Want a nudge?</Text>
          <Text style={styles.subtitle}>
            Chronically can remind you about medications and check-ins. Everything below stays
            off until you say otherwise, and you can change it any time in Profile.
          </Text>

          <View style={{ gap: 14, marginTop: 18 }}>
            {REASONS.map((r) => (
              <View key={r.name} style={styles.row}>
                <View style={styles.iconWrap}>{r.icon}</View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowName}>{r.name}</Text>
                  <Text style={styles.rowDesc}>{r.desc}</Text>
                </View>
              </View>
            ))}
          </View>

          <TouchableOpacity
            style={[styles.btn, busy && styles.btnBusy]}
            onPress={enable}
            disabled={busy}
            activeOpacity={0.85}
          >
            {busy ? <ActivityIndicator color="#5A3A60" /> : <Text style={styles.btnText}>Enable reminders</Text>}
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondary} onPress={notNow} disabled={busy} activeOpacity={0.7}>
            <Text style={styles.secondaryText}>Not now</Text>
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
  bellWrap: {
    alignSelf: "center", width: 52, height: 52, borderRadius: 26,
    backgroundColor: "rgba(255,255,255,0.14)", alignItems: "center", justifyContent: "center",
    marginBottom: 14,
  },
  title: { fontFamily: "PlayfairDisplay_500Medium", fontSize: 24, color: "white", textAlign: "center" },
  subtitle: { fontFamily: "Lato_400Regular", fontSize: 13, color: "rgba(255,255,255,0.8)", textAlign: "center", marginTop: 6, lineHeight: 19 },
  row: { flexDirection: "row", alignItems: "center", gap: 14 },
  iconWrap: { width: 30, alignItems: "center" },
  rowName: { fontFamily: "Lato_700Bold", fontSize: 15, color: "white" },
  rowDesc: { fontFamily: "Lato_400Regular", fontSize: 13, color: "rgba(255,255,255,0.72)", marginTop: 1 },
  btn: { backgroundColor: "white", borderRadius: 999, paddingVertical: 14, alignItems: "center", marginTop: 20 },
  btnBusy: { opacity: 0.7 },
  btnText: { fontFamily: "Lato_700Bold", fontSize: 15, color: "#5A3A60" },
  secondary: { paddingVertical: 12, alignItems: "center" },
  secondaryText: { fontFamily: "Lato_400Regular", fontSize: 14, color: "rgba(255,255,255,0.7)" },
});
