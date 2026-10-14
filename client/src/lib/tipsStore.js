// First-visit tips state, fetched fresh from the server — never read from the
// cached user, or phone and web would disagree. Until a fetch succeeds the
// status is "unknown" and no tips show anywhere.
import { useEffect, useState, useSyncExternalStore } from "react";
import axios from "axios";
import { useOverlayCount } from "./overlayStack";

let token = null;
let state = { status: "unknown", tipsSeen: null };
const listeners = new Set();
const emit = () => listeners.forEach((fn) => fn());
const set = (next) => { state = next; emit(); };
const base = () => `${import.meta.env.VITE_API_URL}/api/users/tips`;
const headers = () => ({ Authorization: `Bearer ${token}` });

export function getTipsState() {
  return state;
}

export function subscribeTips(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export async function refreshTips() {
  if (!token) return;
  try {
    const res = await axios.get(base(), { headers: headers() });
    const seen = res.data?.tipsSeen;
    set({ status: "ready", tipsSeen: seen && typeof seen === "object" ? seen : null });
  } catch {
    set({ status: "unknown", tipsSeen: null });
  }
}

/** Optimistic: the screen counts as seen the moment its first tip shows. */
export function markTipsSeen(screen) {
  if (state.tipsSeen && typeof state.tipsSeen === "object") {
    set({ ...state, tipsSeen: { ...state.tipsSeen, [screen]: true } });
  }
  if (token) axios.put(`${base()}/${screen}`, {}, { headers: headers() }).catch(() => {});
}

/** Profile's "Show tips". Throws on failure so the row can say so. */
export async function resetTips() {
  await axios.delete(base(), { headers: headers() });
  set({ status: "ready", tipsSeen: {} });
}

const onVisible = () => { if (document.visibilityState === "visible") refreshTips(); };

/** Called by AuthProvider whenever the token changes; null on logout. */
export function setTipsToken(next) {
  token = next;
  if (typeof document !== "undefined") document.removeEventListener("visibilitychange", onVisible);
  if (!next) {
    set({ status: "unknown", tipsSeen: null });
    return;
  }
  // another device may have marked a screen while this tab was hidden
  if (typeof document !== "undefined") document.addEventListener("visibilitychange", onVisible);
  refreshTips();
}

export function useTipsState() {
  return useSyncExternalStore(subscribeTips, getTipsState, getTipsState);
}

const SETTLE_MS = 600;

/**
 * Whether a screen's tips should be on screen now. They start once the store
 * is ready, the account is enrolled and hasn't seen this screen, nothing on
 * the screen is `blocked`, no kit dialog is open, and 600 ms have passed with
 * all of that true. A sequence that gets interrupted ends there — the screen
 * was already marked seen when its first tip showed.
 */
export function useScreenTips(screen, { blocked = false } = {}) {
  const tips = useTipsState();
  const overlays = useOverlayCount();
  const [phase, setPhase] = useState("idle"); // idle → showing → finished
  const seen = !tips.tipsSeen || tips.tipsSeen[screen] === true;
  const clear = !blocked && overlays === 0;
  const ready = tips.status === "ready" && !seen && clear;

  useEffect(() => {
    if (phase !== "idle" || !ready) return undefined;
    const t = setTimeout(() => setPhase("showing"), SETTLE_MS);
    return () => clearTimeout(t);
  }, [phase, ready]);

  const show = phase === "showing" && clear;
  // interrupted mid-sequence: close for good, silently
  useEffect(() => {
    if (phase !== "showing" || clear) return undefined;
    const t = setTimeout(() => setPhase("finished"), 0);
    return () => clearTimeout(t);
  }, [phase, clear]);

  return { show, tipsSeen: tips.tipsSeen, done: () => setPhase("finished") };
}
