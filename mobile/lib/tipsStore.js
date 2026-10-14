// First-visit tips state, fetched fresh from the server — never read from the
// cached user, or phone and web would disagree. Until a fetch succeeds the
// status is "unknown" and no tips show anywhere. Web twin:
// client/src/lib/tipsStore.js.
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { AppState } from "react-native";
import { useFocusEffect } from "expo-router";
import api from "./api";
import { useOverlayCount } from "./overlayStack";

let signedIn = false;
let state = { status: "unknown", tipsSeen: null };
const listeners = new Set();
const emit = () => listeners.forEach((fn) => fn());
const set = (next) => { state = next; emit(); };

export function getTipsState() {
  return state;
}

export function subscribeTips(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export async function refreshTips() {
  if (!signedIn) return;
  try {
    const res = await api.get("/api/users/tips");
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
  if (signedIn) api.put(`/api/users/tips/${screen}`).catch(() => {});
}

/** Profile's "Show tips". Throws on failure so the row can say so. */
export async function resetTips() {
  await api.delete("/api/users/tips");
  set({ status: "ready", tipsSeen: {} });
}

let appStateSub = null;

/** Called by AuthProvider: true once signed in, false on sign-out. */
export function setTipsSignedIn(next) {
  signedIn = next;
  appStateSub?.remove?.();
  appStateSub = null;
  if (!next) {
    set({ status: "unknown", tipsSeen: null });
    return;
  }
  // another device may have marked a screen while this one was in the background
  appStateSub = AppState.addEventListener?.("change", (s) => { if (s === "active") refreshTips(); }) || null;
  refreshTips();
}

export function useTipsState() {
  return useSyncExternalStore(subscribeTips, getTipsState, getTipsState);
}

const SETTLE_MS = 600;

/**
 * Whether a screen's tips should be on screen now. They start once the store
 * is ready, the account is enrolled and hasn't seen this screen, the screen
 * is focused, nothing on it is `blocked`, no kit sheet is open, and 600 ms
 * have passed with all of that true. A sequence that gets interrupted ends
 * there — the screen was already marked seen when its first tip showed.
 */
export function useScreenTips(screen, { blocked = false } = {}) {
  const tips = useTipsState();
  const overlays = useOverlayCount();
  const [focused, setFocused] = useState(false);
  const [phase, setPhase] = useState("idle"); // idle → showing → finished

  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      setPhase("idle");
      return () => setFocused(false);
    }, []),
  );

  const seen = !tips.tipsSeen || tips.tipsSeen[screen] === true;
  const clear = focused && !blocked && overlays === 0;
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
