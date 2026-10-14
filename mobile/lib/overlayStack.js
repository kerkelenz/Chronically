// How many kit sheets and dialogs are open right now. BottomSheet and
// ConfirmDialog count themselves in while visible; first-visit tips never
// start while anything is open, so a tip can't land on top of a sheet. One
// rule in the kit instead of a flag on every screen. Web twin:
// client/src/lib/overlayStack.js.
import { useEffect, useSyncExternalStore } from "react";

let count = 0;
const listeners = new Set();
const emit = () => listeners.forEach((fn) => fn());

export function openOverlay() {
  count += 1;
  emit();
  return () => { count = Math.max(0, count - 1); emit(); };
}

export function overlayCount() {
  return count;
}

export function subscribeOverlays(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Counts the calling kit component in while `active`. */
export function useRegisterOverlay(active) {
  useEffect(() => (active ? openOverlay() : undefined), [active]);
}

export function useOverlayCount() {
  return useSyncExternalStore(subscribeOverlays, overlayCount, overlayCount);
}
