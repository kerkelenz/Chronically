import { Platform, AppState } from "react-native";
import Constants from "expo-constants";
import api from "./api";

// tiny fire-and-forget usage tracking - events batch locally for a few seconds,
// then post to our own /api/events endpoint. failures are swallowed silently:
// analytics must never block or break the actual app.

const appVersion = Constants.expoConfig?.version || "unknown";
let queue = [];
let flushTimer = null;
let lastSession = 0;

async function flush() {
  flushTimer = null;
  if (!queue.length) return;
  const events = queue.splice(0, 20);
  try {
    await api.post("/api/events", { platform: Platform.OS, appVersion, events });
  } catch {
    // analytics must never surface errors — drop silently
  }
}

/** Fire-and-forget usage event. Never throws, never blocks. */
export function track(name, metadata) {
  try {
    queue.push({ name, metadata, occurredAt: new Date().toISOString() });
    if (!flushTimer) flushTimer = setTimeout(flush, 3000); // batch within 3s
  } catch {}
}

/** session_start at most once per 30 minutes of foreground activity. */
export function trackSession() {
  const now = Date.now();
  if (now - lastSession < 30 * 60 * 1000) return;
  lastSession = now;
  track("session_start");
}

// re-fire session check whenever the app returns to the foreground
AppState.addEventListener("change", (s) => {
  if (s === "active") trackSession();
});
