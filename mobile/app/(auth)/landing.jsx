import { View, Text, TouchableOpacity, StyleSheet, Linking } from "react-native";
import { useRouter } from "expo-router";
import ScreenBackground from "../../components/ScreenBackground";
import FloatingPetals from "../../components/FloatingPetals";
import BrandWordmark from "../../components/BrandWordmark";

/**
 * First screen for an unauthenticated launch — the mobile twin of the web
 * LandingPage. Greets first-time visitors instead of dropping them on the
 * "Welcome back" login form. No Support/Buy-Me-a-Coffee link (the iOS
 * external-payment guard applies here as on the profile Support card) and no
 * Delete Account (that lives in-app per Apple's requirement).
 */
export default function LandingScreen() {
  const router = useRouter();

  return (
    <ScreenBackground blobVariant="auth">
      <FloatingPetals />
      <View style={styles.container}>
        <View style={styles.hero}>
          <BrandWordmark fontSize={42} />
          <Text style={styles.tagline}>
            your daily companion for the chronic life.
          </Text>
        </View>

        <View style={styles.buttons}>
          <TouchableOpacity
            style={styles.getStarted}
            onPress={() => router.push("/(auth)/register")}
            activeOpacity={0.85}
          >
            <Text style={styles.getStartedText}>Get Started</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.logIn}
            onPress={() => router.push("/(auth)/login")}
            activeOpacity={0.85}
          >
            <Text style={styles.logInText}>Log In</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.footer}>
        <TouchableOpacity
          onPress={() => Linking.openURL("https://mychronically.app/privacy")}
        >
          <Text style={styles.footerLink}>Privacy Policy</Text>
        </TouchableOpacity>
        <Text style={styles.footerDot}>·</Text>
        <TouchableOpacity
          onPress={() => Linking.openURL("https://mychronically.app/terms")}
        >
          <Text style={styles.footerLink}>Terms of Service</Text>
        </TouchableOpacity>
      </View>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  hero: {
    alignItems: "center",
    marginBottom: 36,
  },
  tagline: {
    fontFamily: "Lato_400Regular",
    fontSize: 13,
    color: "rgba(255,255,255,0.7)",
    textAlign: "center",
    marginTop: 10,
  },
  buttons: {
    width: 192,
    gap: 12,
  },
  getStarted: {
    backgroundColor: "white",
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: "center",
  },
  getStartedText: {
    fontFamily: "Lato_700Bold",
    fontSize: 14,
    color: "#7C6BAE",
  },
  logIn: {
    backgroundColor: "rgba(255,255,255,0.18)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.4)",
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: "center",
  },
  logInText: {
    fontFamily: "Lato_700Bold",
    fontSize: 14,
    color: "white",
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingBottom: 16,
  },
  footerLink: {
    fontFamily: "Lato_400Regular",
    fontSize: 12,
    color: "rgba(255,255,255,0.7)",
  },
  footerDot: {
    fontSize: 12,
    color: "rgba(255,255,255,0.7)",
  },
});
