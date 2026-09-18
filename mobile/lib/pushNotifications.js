import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import api from "./api";
import { getPushToken, setPushToken, clearPushToken } from "./storage";

// Foreground behaviour: a reminder that arrives while the app is open should
// still be visible — the user may be on another screen entirely.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

const projectId =
  Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;

/**
 * Android needs an explicit channel or notifications arrive silently and
 * without a heads-up banner. Must match the `defaultChannel` in app.json.
 */
async function ensureAndroidChannel() {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync("default", {
    name: "Reminders",
    importance: Notifications.AndroidImportance.HIGH,
    sound: "default",
    vibrationPattern: [0, 250, 250, 250],
    lightColor: "#7C6BAE",
  });
}

/** Has the user already answered the OS prompt, one way or the other? */
export async function getPermissionState() {
  if (!Device.isDevice) return "unavailable";
  try {
    const { status, canAskAgain } = await Notifications.getPermissionsAsync();
    if (status === "granted") return "granted";
    if (!canAskAgain) return "blocked";
    return "undetermined";
  } catch {
    return "unavailable";
  }
}

/**
 * Ask for permission (if we still can), then register the device's Expo push
 * token with the server.
 *
 * @param {boolean} promptIfNeeded  false = only register when permission was
 *   already granted, so a returning user is re-registered without ever seeing
 *   a cold OS prompt.
 * @returns "granted" | "denied" | "blocked" | "unavailable" | "error"
 */
export async function registerForPushNotifications({ promptIfNeeded = false } = {}) {
  // Simulators have no APNs/FCM registration, so there is no token to get
  if (!Device.isDevice) return "unavailable";

  try {
    await ensureAndroidChannel();

    const existing = await Notifications.getPermissionsAsync();
    let status = existing.status;

    if (status !== "granted") {
      // never re-prompt: iOS only shows the system dialog once, and asking
      // again just returns denied without the user seeing anything
      if (!promptIfNeeded || !existing.canAskAgain) {
        return existing.canAskAgain ? "denied" : "blocked";
      }
      status = (await Notifications.requestPermissionsAsync()).status;
    }
    if (status !== "granted") return "denied";

    if (!projectId) {
      console.warn("No EAS projectId — cannot get an Expo push token");
      return "error";
    }

    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    if (!token) return "error";

    await api.post("/api/push/register", {
      token,
      platform: Platform.OS === "ios" ? "ios" : "android",
    });
    await setPushToken(token);
    return "granted";
  } catch (err) {
    // Notifications are a nicety; never let this break sign-in
    console.error("Push registration failed:", err);
    return "error";
  }
}

/**
 * Drop this device's token server-side. Called on sign-out so a shared or
 * handed-on phone stops receiving the previous account's reminders.
 */
export async function unregisterPushNotifications() {
  try {
    const token = await getPushToken();
    if (!token) return;
    await api.delete("/api/push/register", { data: { token } });
  } catch {
    // best effort — the token is also pruned server-side once it stops
    // resolving to a device
  } finally {
    await clearPushToken();
  }
}

/**
 * Tell the server which zone this device is in. Medication times are stored as
 * bare "HH:MM" meaning device-local, so without this the server cannot fire a
 * reminder at the right hour.
 */
export async function syncTimezone() {
  try {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!timezone) return;
    await api.put("/api/users/timezone", { timezone });
  } catch {
    // non-fatal: the server falls back to withholding dose reminders rather
    // than sending them at a guessed hour
  }
}
