import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import ScreenBackground from "../../components/ScreenBackground";
import FloatingPetals from "../../components/FloatingPetals";
import { useAuth } from "../../context/AuthContext";

export default function RegisterScreen() {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const { signUp } = useAuth();
  const router = useRouter();

  async function handleRegister() {
    if (!username.trim() || !email.trim() || !password || !confirmPassword) {
      setError("All fields are required.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    setError("");
    setIsSubmitting(true);
    try {
      const msg = await signUp(username.trim(), email.trim().toLowerCase(), password);
      setSuccessMessage(
        msg || "Account created — check your email to verify, then sign in."
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  if (successMessage) {
    return (
      <ScreenBackground blobVariant="auth">
        <FloatingPetals />
        <View style={styles.centeredFull}>
          <View style={styles.header}>
            <Text style={styles.appName}>Chronically</Text>
            <Text style={styles.tagline}>
              your daily companion for the chronic life.
            </Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.successTitle}>Almost there!</Text>
            <Text style={styles.successBody}>{successMessage}</Text>
            <TouchableOpacity
              style={styles.button}
              onPress={() => router.replace("/(auth)/login")}
              activeOpacity={0.85}
            >
              <Text style={styles.buttonText}>Go to Sign In</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScreenBackground>
    );
  }

  return (
    <ScreenBackground blobVariant="auth">
      <FloatingPetals />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <Text style={styles.appName}>Chronically</Text>
            <Text style={styles.tagline}>
              your daily companion for the chronic life.
            </Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Create account</Text>
            <TextInput
              style={styles.input}
              value={username}
              onChangeText={setUsername}
              placeholder="Username"
              placeholderTextColor="rgba(255,255,255,0.45)"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="next"
              blurOnSubmit={false}
            />
            <TextInput
              style={[styles.input, styles.inputSpaced]}
              value={email}
              onChangeText={setEmail}
              placeholder="Email"
              placeholderTextColor="rgba(255,255,255,0.45)"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="next"
              blurOnSubmit={false}
            />
            <TextInput
              style={[styles.input, styles.inputSpaced]}
              value={password}
              onChangeText={setPassword}
              placeholder="Password"
              placeholderTextColor="rgba(255,255,255,0.45)"
              secureTextEntry
              autoCapitalize="none"
              returnKeyType="next"
              blurOnSubmit={false}
            />
            <TextInput
              style={[styles.input, styles.inputSpaced]}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="Confirm password"
              placeholderTextColor="rgba(255,255,255,0.45)"
              secureTextEntry
              autoCapitalize="none"
              returnKeyType="done"
              onSubmitEditing={handleRegister}
            />

            {!!error && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            <TouchableOpacity
              style={[styles.button, isSubmitting && styles.buttonDisabled]}
              onPress={handleRegister}
              disabled={isSubmitting}
              activeOpacity={0.85}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#7C6BAE" />
              ) : (
                <Text style={styles.buttonText}>Create Account</Text>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.footer}>
            <TouchableOpacity onPress={() => router.back()}>
              <Text style={styles.link}>Already have an account? Sign in</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  centeredFull: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  scroll: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
  header: {
    alignItems: "center",
    marginBottom: 32,
  },
  appName: {
    fontFamily: "PlayfairDisplay_500Medium",
    fontSize: 30,
    color: "white",
    textAlign: "center",
  },
  tagline: {
    fontFamily: "Lato_400Regular",
    fontSize: 13,
    color: "rgba(255,255,255,0.7)",
    textAlign: "center",
    marginTop: 6,
  },
  cardTitle: {
    fontFamily: "Lato_700Bold",
    fontSize: 15,
    color: "white",
    marginBottom: 14,
  },
  card: {
    backgroundColor: "rgba(255,255,255,0.15)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
    borderRadius: 20,
    padding: 24,
  },
  input: {
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    fontFamily: "Lato_400Regular",
    color: "white",
  },
  inputSpaced: {
    marginTop: 12,
  },
  errorBox: {
    backgroundColor: "rgba(176,112,136,0.25)",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginTop: 14,
    borderWidth: 1,
    borderColor: "rgba(176,112,136,0.4)",
  },
  errorText: {
    fontFamily: "Lato_400Regular",
    fontSize: 14,
    color: "rgba(255,255,255,0.9)",
    textAlign: "center",
  },
  button: {
    backgroundColor: "rgba(255,255,255,0.9)",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 20,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    fontFamily: "Lato_700Bold",
    fontSize: 16,
    color: "#7C6BAE",
    letterSpacing: 0.5,
  },
  successTitle: {
    fontFamily: "PlayfairDisplay_500Medium",
    fontSize: 28,
    color: "white",
    textAlign: "center",
    marginBottom: 16,
  },
  successBody: {
    fontFamily: "Lato_400Regular",
    fontSize: 15,
    color: "rgba(255,255,255,0.85)",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 28,
  },
  footer: {
    alignItems: "center",
    marginTop: 24,
  },
  link: {
    fontFamily: "Lato_400Regular",
    fontSize: 14,
    color: "rgba(255,255,255,0.8)",
    textDecorationLine: "underline",
  },
});
