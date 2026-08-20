import "../global.css";
import { useEffect, useRef } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useFonts } from "expo-font";
import {
  PlayfairDisplay_400Regular,
  PlayfairDisplay_500Medium,
  PlayfairDisplay_600SemiBold,
  PlayfairDisplay_700Bold,
} from "@expo-google-fonts/playfair-display";
import { Lato_300Light, Lato_400Regular, Lato_700Bold } from "@expo-google-fonts/lato";
import { SafeAreaProvider } from "react-native-safe-area-context";
import * as Sentry from "@sentry/react-native";
import { AuthProvider, useAuth } from "../context/AuthContext";
import ErrorBoundary from "../components/ErrorBoundary";

// Errors-only and env-gated — a silent no-op when EXPO_PUBLIC_SENTRY_DSN is
// absent, so local dev needs nothing. tracesSampleRate 0 = errors only.
Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
  enabled: !!process.env.EXPO_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0,
});

SplashScreen.preventAutoHideAsync();

// Rendered inside AuthProvider — watches auth state and redirects accordingly.
function AuthGate() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const segments = useSegments();
  // true once a session has existed this run — lets us send a first-time
  // visitor to the landing screen but an expired/logged-out user to login.
  const wasAuthed = useRef(false);

  useEffect(() => {
    if (isLoading) return;
    if (user) wasAuthed.current = true;
    const inAuth = segments[0] === "(auth)";
    if (!user && !inAuth) {
      router.replace(wasAuthed.current ? "/(auth)/login" : "/(auth)/landing");
    } else if (user && inAuth) {
      router.replace("/(tabs)");
    }
  }, [user, isLoading, segments]);

  return null;
}

export const unstable_settings = {
  initialRouteName: "(tabs)",
};

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    PlayfairDisplay_400Regular,
    PlayfairDisplay_500Medium,
    PlayfairDisplay_600SemiBold,
    PlayfairDisplay_700Bold,
    Lato_300Light,
    Lato_400Regular,
    Lato_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <ErrorBoundary>
          <AuthGate />
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen
              name="checkin"
              options={{ presentation: "fullScreenModal", gestureEnabled: false }}
            />
          </Stack>
        </ErrorBoundary>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
