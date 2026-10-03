import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Linking, Platform } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import ScreenBackground from "../components/ScreenBackground";
import { openLink } from "../lib/openLink";
import {
  SUPPORT_TITLE,
  SUPPORT_INTRO,
  SUPPORT_CLOSING,
  SUPPORT_RESOURCES,
} from "../theme/supportResources";

/**
 * The support pathway. A door, not an intervention: always here, never
 * triggered by anything the app thinks it has detected.
 *
 * Deliberately NOT instrumented. No analytics import, no track() call on open
 * or on any resource. Nothing about someone's worst day belongs in an events
 * table, not even as a count.
 */
export default function SupportScreen() {
  const router = useRouter();

  const open = (r) => {
    if (r.kind === "url") return openLink(r.value);
    if (r.kind === "tel") return Linking.openURL(`tel:${r.value}`).catch(() => {});
    if (r.kind === "sms") {
      // iOS separates the body with &, Android with ?
      const sep = Platform.OS === "ios" ? "&" : "?";
      const url = `sms:${r.value}${r.body ? `${sep}body=${encodeURIComponent(r.body)}` : ""}`;
      return Linking.openURL(url).catch(() => {});
    }
    return undefined;
  };

  return (
    <ScreenBackground>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => (router.canGoBack() ? router.back() : router.replace("/(tabs)/profile"))}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Ionicons name="chevron-back" size={24} color="white" />
          </TouchableOpacity>
          <View style={styles.headerSpacer} />
        </View>

        <Text style={styles.title}>{SUPPORT_TITLE}</Text>
        <Text style={styles.intro}>{SUPPORT_INTRO}</Text>

        <View style={styles.list}>
          {SUPPORT_RESOURCES.map((r) => (
            <TouchableOpacity
              key={r.id}
              style={styles.card}
              onPress={() => open(r)}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel={r.a11y}
            >
              <Text style={styles.cardName}>{r.name}</Text>
              <Text style={styles.cardSub}>{r.sub}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.closing}>{SUPPORT_CLOSING}</Text>
      </ScrollView>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 40 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  headerSpacer: { width: 24 },
  title: {
    fontFamily: "PlayfairDisplay_500Medium",
    fontSize: 28,
    color: "white",
    marginBottom: 12,
  },
  intro: {
    fontFamily: "Lato_400Regular",
    fontSize: 15,
    lineHeight: 23,
    color: "rgba(255,255,255,0.85)",
    marginBottom: 22,
  },
  list: { gap: 12 },
  card: {
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
    // generous padding: a real touch target, comfortably past 44pt tall
    paddingVertical: 18,
    paddingHorizontal: 16,
  },
  cardName: { fontFamily: "Lato_700Bold", fontSize: 16, color: "white" },
  cardSub: {
    fontFamily: "Lato_400Regular",
    fontSize: 14,
    lineHeight: 20,
    color: "rgba(255,255,255,0.8)",
    marginTop: 4,
  },
  closing: {
    fontFamily: "Lato_400Regular",
    fontSize: 14,
    lineHeight: 21,
    color: "rgba(255,255,255,0.7)",
    marginTop: 26,
  },
});
