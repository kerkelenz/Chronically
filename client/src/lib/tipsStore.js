// Tips state, fetched fresh from the server — never read from the cached
// user, or phone and web would disagree. Until a fetch succeeds the status is
// "unknown" and no tips show anywhere.
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import axios from "axios";
import { useOverlayCount } from "./overlayStack";
import { TIPS, tipsToShow, withTipsMarked } from "../utils/tips";

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

/** Optimistic: a tip counts as seen the moment it shows. */
export function markTipsSeen(ids) {
  if (!ids || ids.length === 0) return;
  if (state.tipsSeen && typeof state.tipsSeen === "object") {
    set({ ...state, tipsSeen: withTipsMarked(state.tipsSeen, ids) });
  }
  if (token) axios.put(base(), { ids }, { headers: headers() }).catch(() => {});
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
  // another device may have marked a tip while this tab was hidden
  if (typeof document !== "undefined") document.addEventListener("visibilitychange", onVisible);
  refreshTips();
}

export function useTipsState() {
  return useSyncExternalStore(subscribeTips, getTipsState, getTipsState);
}

/**
 * Which of a screen's anchors are in the page right now, kept current as the
 * page changes — so a tip can wait for the thing it describes to appear.
 */
function usePresentAnchors(screen) {
  const read = () => (TIPS[screen] || [])
    .map((t) => t.anchor)
    .filter((a) => typeof document !== "undefined" && document.querySelector(`[data-tip="${a}"]`))
    .join(",");
  const [present, setPresent] = useState("");
  useEffect(() => {
    // read after the page has committed its anchors, a frame later like every
    // update below, rather than setting state synchronously in the effect
    let raf = requestAnimationFrame(() => setPresent(read()));
    if (typeof MutationObserver === "undefined") return () => cancelAnimationFrame(raf);
    const obs = new MutationObserver(() => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setPresent(read()));
    });
    obs.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-tip"] });
    return () => { cancelAnimationFrame(raf); obs.disconnect(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen]);
  return present;
}

const SETTLE_MS = 600;

/**
 * Whether a screen's tips should be on screen now. A sequence starts when the
 * store is ready, the account is enrolled, at least one unseen tip's anchor is
 * on the page, nothing on the screen is `blocked`, no kit dialog is open, and
 * 600 ms have passed with all of that true. Each tip is marked as it shows, so
 * an interrupted sequence picks up later with whatever wasn't shown. Tips whose
 * feature appears later (the dials after a first check-in) start a new, shorter
 * sequence then. Tips that couldn't be pointed at are left for the next visit.
 */
export function useScreenTips(screen, { blocked = false } = {}) {
  const tips = useTipsState();
  const overlays = useOverlayCount();
  const present = usePresentAnchors(screen);
  const [showing, setShowing] = useState(false);
  const [held, setHeld] = useState(() => new Set());
  const offered = useRef([]);

  const pending = tips.status === "ready"
    ? tipsToShow(screen, tips.tipsSeen, present ? present.split(",") : []).filter((t) => !held.has(t.id))
    : [];
  const pendingKey = pending.map((t) => t.id).join(",");
  const clear = !blocked && overlays === 0;

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

  const done = (outcome) => {
    // nothing could be pointed at: don't keep retrying on this visit
    if (outcome === "empty") setHeld((prev) => new Set([...prev, ...offered.current]));
    setShowing(false);
  };

  return { show: showing && clear, tipsSeen: tips.tipsSeen, done };
}
