// Where each first-visit tip's anchor is on screen. <TipAnchor id> registers
// its view here while mounted; the overlay measures them. Also the scroll
// helper each screen spreads onto its ScrollView, so the overlay can bring an
// anchor into view.
import { useRef, useSyncExternalStore } from "react";

const anchors = new Map();
const listeners = new Set();
let snapshot = "";
const changed = () => {
  snapshot = [...anchors.keys()].sort().join(",");
  listeners.forEach((fn) => fn());
};

export function registerAnchor(id, ref) {
  anchors.set(id, ref);
  changed();
  return () => {
    if (anchors.get(id) === ref) {
      anchors.delete(id);
      changed();
    }
  };
}

const subscribe = (fn) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};
const getSnapshot = () => snapshot;

/** Every mounted anchor id, comma-joined — so a tip can wait for its feature to appear. */
export function useMountedAnchors() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/** → { x, y, width, height } in window coordinates, or null when not measurable. */
export function measureAnchor(id) {
  const ref = anchors.get(id);
  const node = ref?.current;
  if (!node || typeof node.measureInWindow !== "function") return Promise.resolve(null);
  return new Promise((resolve) => {
    node.measureInWindow((x, y, width, height) => {
      resolve(width > 0 && height > 0 ? { x, y, width, height } : null);
    });
  });
}

/**
 * Spread onto a screen's ScrollView — `ref={scroll.scrollRef}`,
 * `onScroll={scroll.onScroll}`, `scrollEventThrottle={16}` — and pass the same
 * object to <TipsOverlay scroll>, which uses it to bring an anchor into view.
 */
export function useTipScroll() {
  const scrollRef = useRef(null);
  const offsetRef = useRef(0);
  const api = useRef(null);
  if (!api.current) {
    api.current = {
      scrollRef,
      offsetRef,
      onScroll: (e) => { offsetRef.current = e.nativeEvent.contentOffset.y; },
    };
  }
  return api.current;
}
