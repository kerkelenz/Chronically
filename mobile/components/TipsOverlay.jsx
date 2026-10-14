import { useEffect, useRef, useState } from "react";
import {
  Modal, View, Text, TouchableOpacity, StyleSheet, Animated, Easing,
  AccessibilityInfo, findNodeHandle, useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import ChronicleMark from "./ChronicleMark";
import { TIPS, tipsToShow, tipCountLabel } from "../theme/tips";
import { measureAnchor } from "../lib/tipAnchors";
import { markTipsSeen } from "../lib/tipsStore";
import { track } from "../lib/analytics";

const PAD = 6;
const GAP = 12;
const GUTTER = 16;
const CARD_EST_H = 190; // enough to decide above or below before the card lays out
const TAB_BAR = 64;
const SCRIM = "rgba(20,12,40,0.55)";
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Chronicle's first-visit tips for one screen: a scrim with a ringed cut-out
 * around the thing being described, and a small card beside it. It sits in
 * its own Modal, so every tap — the cut-out included — lands on the overlay,
 * never the screen: a tip can't press a button or answer a question.
 * `scroll` is the screen's useTipScroll(), used to bring an anchor into view.
 * `onDone(outcome)` gets "completed", "skipped", or "empty" when none of the
 * anchors could be shown (the screen is then left unmarked).
 * Web twin: client/src/components/TipsOverlay.jsx.
 */
export default function TipsOverlay({ screen, tipsSeen, onDone, scroll, bottomInset = TAB_BAR }) {
  const insets = useSafeAreaInsets();
  const { width: W, height: H } = useWindowDimensions();
  const [tips, setTips] = useState(null); // null while the anchors are measured
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState(null);
  const [reduced, setReduced] = useState(false);
  const ring = useRef(new Animated.Value(1)).current;
  const fade = useRef(new Animated.Value(1)).current;
  const textRef = useRef(null);
  const finished = useRef(false);

  const finish = (outcome) => {
    if (finished.current) return;
    finished.current = true;
    if (outcome !== "empty") track("tips_closed", { screen, outcome });
    onDone(outcome);
  };

  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled?.().then((v) => { if (active) setReduced(!!v); }).catch(() => {});
    const sub = AccessibilityInfo.addEventListener?.("reduceMotionChanged", (v) => setReduced(!!v));
    return () => { active = false; sub?.remove?.(); };
  }, []);

  // which of this screen's anchors are actually there
  useEffect(() => {
    let alive = true;
    (async () => {
      const present = [];
      for (const t of TIPS[screen] || []) {
        if (await measureAnchor(t.anchor)) present.push(t.anchor);
      }
      if (!alive) return;
      const list = tipsToShow(screen, tipsSeen, present);
      if (list.length === 0) { finish("empty"); return; }
      markTipsSeen(screen);
      setTips(list);
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const tip = tips ? tips[index] : null;
  const last = tips ? index === tips.length - 1 : false;

  // bring the anchor to mid-screen if it isn't comfortably visible, then measure
  useEffect(() => {
    if (!tip) return undefined;
    let alive = true;
    const top = insets.top + 8;
    const bottom = H - bottomInset - insets.bottom;
    const visible = (r) => r && r.y >= top && r.y + r.height <= bottom;
    (async () => {
      let r = await measureAnchor(tip.anchor);
      if (r && !visible(r) && scroll?.scrollRef?.current) {
        const target = Math.max(0, (scroll.offsetRef?.current || 0) + r.y + r.height / 2 - H / 2);
        scroll.scrollRef.current.scrollTo?.({ y: target, animated: !reduced });
        await wait(reduced ? 60 : 380);
        r = await measureAnchor(tip.anchor);
      }
      if (!alive) return;
      if (!visible(r)) {
        // can't be shown on this screen size: leave it out
        const rest = tips.filter((t) => t !== tip);
        if (rest.length === 0) finish("empty");
        else { setTips(rest); setIndex((i) => Math.min(i, rest.length - 1)); }
        return;
      }
      setRect(r);
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tip]);

  // screen readers land on the tip itself, every time it changes
  useEffect(() => {
    if (!rect || !textRef.current) return;
    const node = findNodeHandle(textRef.current);
    if (node) AccessibilityInfo.setAccessibilityFocus?.(node);
  }, [rect, index]);

  // the ring breathes and the card fades in — unless motion is reduced
  useEffect(() => {
    if (!rect || reduced) { ring.setValue(1); fade.setValue(1); return undefined; }
    fade.setValue(0);
    Animated.timing(fade, { toValue: 1, duration: 180, useNativeDriver: true }).start();
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(ring, { toValue: 0.6, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(ring, { toValue: 1, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [rect, reduced, index, ring, fade]);

  if (!tip || !rect) return null;

  const hole = { x: rect.x - PAD, y: rect.y - PAD, w: rect.width + 2 * PAD, h: rect.height + 2 * PAD };
  const cardW = Math.min(320, W - 2 * GUTTER);
  const below = hole.y + hole.h + GAP + CARD_EST_H <= H - insets.bottom - GUTTER;
  const cardPos = {
    left: Math.min(Math.max(GUTTER, hole.x + hole.w / 2 - cardW / 2), W - GUTTER - cardW),
    ...(below
      ? { top: hole.y + hole.h + GAP }
      : { bottom: Math.max(insets.bottom + GUTTER, H - hole.y + GAP) }),
  };
  const count = tipCountLabel(index, tips.length);

  return (
    <Modal transparent visible statusBarTranslucent animationType="none" onRequestClose={() => finish("skipped")}>
      {/* full screen and touchable everywhere, so nothing reaches the app */}
      <View style={StyleSheet.absoluteFill} onStartShouldSetResponder={() => true}>
        <View style={[styles.scrim, { left: 0, top: 0, width: W, height: Math.max(0, hole.y) }]} />
        <View style={[styles.scrim, { left: 0, top: hole.y + hole.h, width: W, height: Math.max(0, H - hole.y - hole.h) }]} />
        <View style={[styles.scrim, { left: 0, top: hole.y, width: Math.max(0, hole.x), height: hole.h }]} />
        <View style={[styles.scrim, { left: hole.x + hole.w, top: hole.y, width: Math.max(0, W - hole.x - hole.w), height: hole.h }]} />
        <Animated.View
          testID="tips-ring"
          pointerEvents="none"
          style={[styles.ring, { left: hole.x, top: hole.y, width: hole.w, height: hole.h, opacity: ring }]}
        />

        <Animated.View
          accessibilityViewIsModal
          style={[styles.card, cardPos, { width: cardW, opacity: fade }]}
        >
          <View style={styles.row}>
            <ChronicleMark size={28} />
            <View style={{ flex: 1 }}>
              <Text ref={textRef} accessible accessibilityLabel={`${count}. ${tip.text}`} style={styles.text}>
                {tip.text}
              </Text>
              <Text style={styles.count} importantForAccessibility="no" accessibilityElementsHidden>{count}</Text>
            </View>
          </View>
          <View style={styles.actions}>
            <TouchableOpacity
              onPress={() => finish("skipped")}
              style={styles.skip}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Skip tips"
            >
              <Text style={styles.skipText}>Skip tips</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                if (last) { finish("completed"); return; }
                setRect(null);
                setIndex((i) => i + 1);
              }}
              style={styles.next}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel={last ? "Got it" : "Next tip"}
            >
              <Text style={styles.nextText}>{last ? "Got it" : "Next"}</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { position: "absolute", backgroundColor: SCRIM },
  ring: { position: "absolute", borderRadius: 16, borderWidth: 2, borderColor: "rgba(255,255,255,0.9)" },
  card: {
    position: "absolute",
    backgroundColor: "rgba(52,38,86,0.98)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    borderRadius: 20,
    padding: 16,
  },
  row: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  text: { fontFamily: "Lato_400Regular", fontSize: 15, lineHeight: 21, color: "white" },
  count: { fontFamily: "Lato_400Regular", fontSize: 12, color: "rgba(255,255,255,0.6)", marginTop: 6 },
  actions: { flexDirection: "row", justifyContent: "flex-end", alignItems: "center", gap: 4, marginTop: 12 },
  skip: { minHeight: 44, minWidth: 44, justifyContent: "center", paddingHorizontal: 12 },
  skipText: { fontFamily: "Lato_400Regular", fontSize: 14, color: "rgba(255,255,255,0.75)" },
  next: {
    minHeight: 44,
    minWidth: 44,
    justifyContent: "center",
    paddingHorizontal: 20,
    borderRadius: 22,
    backgroundColor: "white",
  },
  nextText: { fontFamily: "Lato_700Bold", fontSize: 14, color: "#7C6BAE" },
});
