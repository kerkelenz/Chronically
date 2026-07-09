import axios from "axios";

// tiny fire-and-forget usage tracking - events batch locally for a few seconds,
// then post to our own /api/events endpoint. failures are swallowed silently:
// analytics must never block or break the actual app.

const API = import.meta.env.VITE_API_URL;
let queue = [];
let flushTimer = null;
let authToken = null;

export function setAnalyticsToken(token) {
  authToken = token;
}

async function flush() {
  flushTimer = null;
  if (!queue.length || !authToken) {
    queue = [];
    return;
  }
  const events = queue.splice(0, 20);
  try {
    await axios.post(
      `${API}/api/events`,
      { platform: "web", events },
      { headers: { Authorization: `Bearer ${authToken}` } },
    );
  } catch {
    // never surface analytics errors
  }
}

/** Fire-and-forget usage event. Never throws, never blocks. */
export function track(name, metadata) {
  try {
    queue.push({ name, metadata, occurredAt: new Date().toISOString() });
    if (!flushTimer) flushTimer = setTimeout(flush, 3000); // batch within 3s
  } catch {}
}

/** session_start at most once per 30 minutes. */
export function trackSession() {
  try {
    const last = Number(sessionStorage.getItem("chron_last_session") || 0);
    if (Date.now() - last < 30 * 60 * 1000) return;
    sessionStorage.setItem("chron_last_session", String(Date.now()));
    track("session_start");
  } catch {}
}
