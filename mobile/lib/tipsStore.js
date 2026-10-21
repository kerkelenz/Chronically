// Tips state, fetched fresh from the server — never read from the
// cached user, or phone and web would disagree. Until a fetch succeeds the
// status is "unknown" and no tips show anywhere. Web twin:
// client/src/lib/tipsStore.js.
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { AppState } from "react-native";
import { useFocusEffect } from "expo-router";
import api from "./api";
import { useOverlayCount } from "./overlayStack";
import { useMountedAnchors } from "./tipAnchors";
import { tipsToShow, withTipsMarked } from "../theme/tips";

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

/** Optimistic: a tip counts as seen the moment it shows. */
export function markTipsSeen(ids) {
  if (!ids || ids.length === 0) return;
  if (state.tipsSeen && typeof state.tipsSeen === "object") {
    set({ ...state, tipsSeen: withTipsMarked(state.tipsSeen, ids) });
  }
  if (signedIn) api.put("/api/users/tips", { ids }).catch(() => {});
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
  // another device may have marked a tip while this one was in the background
  appStateSub = AppState.addEventListener?.("change", (s) => { if (s === "active") refreshTips(); }) || null;
  refreshTips();
}

export function useTipsState() {
  return useSyncExternalStore(subscribeTips, getTipsState, getTipsState);
}

const SETTLE_MS = 600;

/**
 * Whether a screen's tips should be on screen now. A sequence starts when the
 * store is ready, the account is enrolled, at least one unseen tip's anchor is
 * mounted, the screen is focused, nothing on it is `blocked`, no kit sheet is
 * open, and 600 ms have passed with all of that true. Each tip is marked as it
 * shows, so an interrupted sequence picks up later with whatever wasn't shown.
 * Tips whose feature appears later (the dials after a first check-in) start a
 * new, shorter sequence then. Tips that couldn't be shown on this screen size
 * are left for the next visit.
 */
export function useScreenTips(screen, { blocked = false } = {}) {
  const tips = useTipsState();
  const overlays = useOverlayCount();
  const mounted = useMountedAnchors();
  const [focused, setFocused] = useState(false);
  const [showing, setShowing] = useState(false);
  const [held, setHeld] = useState(() => new Set());
  const offered = useRef([]);

  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      setShowing(false);
      setHeld(new Set());
      return () => setFocused(false);
    }, []),
  );

  const pending = tips.status === "ready"
    ? tipsToShow(screen, tips.tipsSeen, mounted ? mounted.split(",") : []).filter((t) => !held.has(t.id))
    : [];
  const pendingKey = pending.map((t) => t.id).join(",");
  const clear = focused && !blocked && overlays === 0;

  useEffect(() => {
    if (showing || !clear || !pendingKey) return undefined;
    const t = setTimeout(() => {
      offered.current = pendingKey.split(",");
      setShowing(true);
    }, SETTLE_MS);
    return () => clearTimeout(t);
  }, [showing, clear, pendingKey]);

  // interrupted mid-sequence: close quietly; what wasn't shown comes back later
  useEffect(() => {
    if (!showing || clear) return undefined;
    const t = setTimeout(() => setShowing(false), 0);
    return () => clearTimeout(t);
  }, [showing, clear]);

  // `unshown`: tips the overlay had to leave out (they didn't fit on screen)
  const done = (outcome, unshown = []) => {
    const hold = outcome === "empty" ? offered.current : unshown;
    if (hold.length) setHeld((prev) => new Set([...prev, ...hold]));
    setShowing(false);
  };

  return { show: showing && clear, tipsSeen: tips.tipsSeen, done };
}
