import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import ChronicleMark from "./ChronicleMark";
import { TIPS, tipsToShow, tipCountLabel } from "../utils/tips";
import { markTipsSeen } from "../lib/tipsStore";
import { track } from "../lib/analytics";

const PAD = 6;
const GAP = 12;
const GUTTER = 16;
const CARD_EST_H = 190; // enough to decide above or below before the card exists

function prefersReducedMotion() {
  try {
    return !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

const anchorEl = (anchor) => document.querySelector(`[data-tip="${anchor}"]`);
function onScreen(anchor) {
  const el = anchorEl(anchor);
  if (!el) return false;
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0;
}

const KEYFRAMES = `
@keyframes tips-ring-breathe { 0%, 100% { opacity: 0.6 } 50% { opacity: 1 } }
@keyframes tips-card-in { from { opacity: 0 } to { opacity: 1 } }
.tips-ring-pulse { animation: tips-ring-breathe 1.6s ease-in-out infinite; }
.tips-card-fade { animation: tips-card-in 180ms ease-out; }
`;

/**
 * Chronicle's tips for one screen: a scrim with a ringed cut-out around the
 * thing being described, and a small card beside it. The whole screen,
 * cut-out included, swallows taps — a tip can never press a button or answer
 * a question. Each tip is marked seen as it shows; "Skip tips" marks the rest
 * of this sequence too. `onDone(outcome)` gets "completed", "skipped", or
 * "empty" when none of the unseen tips' anchors were on screen (nothing marked).
 */
export default function TipsOverlay({ screen, tipsSeen, onDone }) {
  // the anchors were rendered before this mounted (it waits 600 ms), so the
  // DOM can be read once, here
  const [tips] = useState(() => tipsToShow(screen, tipsSeen, (TIPS[screen] || []).map((t) => t.anchor).filter(onScreen)));
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState(null);
  const [reduced, setReduced] = useState(prefersReducedMotion);
  const textRef = useRef(null);
  const cardRef = useRef(null);
  const returnFocus = useRef(typeof document !== "undefined" ? document.activeElement : null);
  const finished = useRef(false);

  const tip = tips[index];
  const last = index === tips.length - 1;

  const finish = (outcome) => {
    if (finished.current) return;
    finished.current = true;
    // skipping declines this whole sequence, not just the tip on screen
    if (outcome === "skipped") markTipsSeen(tips.slice(index).map((t) => t.id));
    if (outcome !== "empty") track("tips_closed", { screen, outcome, count: tips.length });
    onDone(outcome);
  };

  // nothing to point at: leave everything unmarked, it may be ready next time
  useEffect(() => {
    if (tips.length === 0) finish("empty");
    const focusBack = returnFocus.current;
    return () => { if (focusBack && typeof focusBack.focus === "function") focusBack.focus(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let mq;
    try { mq = window.matchMedia?.("(prefers-reduced-motion: reduce)"); } catch { mq = null; }
    if (!mq || !mq.addEventListener) return undefined;
    const onChange = (e) => setReduced(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  // bring this tip's anchor to the middle of the screen, then measure it
  useEffect(() => {
    if (!tip) return undefined;
    markTipsSeen([tip.id]);
    const el = anchorEl(tip.anchor);
    if (!el) return undefined;
    let raf = 0;
    let timer = 0;
    const measure = () => {
      const r = el.getBoundingClientRect();
      setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
    };
    el.scrollIntoView?.({ block: "center", behavior: reduced ? "auto" : "smooth" });
    if (reduced) {
      raf = requestAnimationFrame(() => { raf = requestAnimationFrame(measure); });
    } else {
      const onEnd = () => { clearTimeout(timer); window.removeEventListener("scrollend", onEnd); measure(); };
      window.addEventListener("scrollend", onEnd, { once: true });
      timer = setTimeout(onEnd, 400);
    }
    textRef.current?.focus();

    // keep up with resizing and scrolling, a frame at a time
    let pending = false;
    const schedule = () => {
      if (pending) return;
      pending = true;
      requestAnimationFrame(() => { pending = false; measure(); });
    };
    window.addEventListener("resize", schedule);
    window.addEventListener("scroll", schedule, true);
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(schedule) : null;
    ro?.observe(el);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(timer);
      window.removeEventListener("resize", schedule);
      window.removeEventListener("scroll", schedule, true);
      ro?.disconnect();
    };
  }, [tip, reduced]);

  // Escape skips; Tab stays inside the card
  useEffect(() => {
    if (!tip) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") { e.preventDefault(); finish("skipped"); return; }
      if (e.key !== "Tab" || !cardRef.current) return;
      const focusable = [...cardRef.current.querySelectorAll("button, [tabindex='-1']")];
      if (focusable.length === 0) return;
      const first = focusable[0];
      const lastEl = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); lastEl.focus(); }
      else if (!e.shiftKey && document.activeElement === lastEl) { e.preventDefault(); first.focus(); }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tip]);

  if (!tip) return null;

  const vw = typeof window !== "undefined" ? window.innerWidth : 375;
  const vh = typeof window !== "undefined" ? window.innerHeight : 667;
  const cardW = Math.min(320, vw - 2 * GUTTER);
  const hole = rect && {
    top: rect.top - PAD,
    left: rect.left - PAD,
    width: rect.width + 2 * PAD,
    height: rect.height + 2 * PAD,
  };
  const below = !hole || hole.top + hole.height + GAP + CARD_EST_H <= vh - GUTTER;
  const cardPos = hole
    ? {
      left: Math.min(Math.max(GUTTER, hole.left + hole.width / 2 - cardW / 2), vw - GUTTER - cardW),
      ...(below
        ? { top: Math.min(hole.top + hole.height + GAP, vh - GUTTER - CARD_EST_H) }
        : { bottom: Math.min(vh - hole.top + GAP, vh - GUTTER - 40) }),
    }
    : { left: (vw - cardW) / 2, top: vh / 2 - CARD_EST_H / 2 };

  const count = tipCountLabel(index, tips.length);
  const textId = `tip-text-${screen}`;
  const countId = `tip-count-${screen}`;

  return createPortal(
    <div className="fixed inset-0 z-[90]" style={{ fontFamily: "Lato, sans-serif" }}>
      <style>{KEYFRAMES}</style>
      {/* swallows every click, the cut-out included */}
      <div
        className="absolute inset-0"
        style={{ background: hole ? "transparent" : "rgba(20,12,40,0.55)" }}
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.preventDefault()}
        aria-hidden="true"
      />
      {hole && (
        <div
          aria-hidden="true"
          data-testid="tips-ring"
          className={reduced ? undefined : "tips-ring-pulse"}
          style={{
            position: "absolute",
            ...hole,
            borderRadius: 16,
            border: "2px solid rgba(255,255,255,0.9)",
            boxShadow: "0 0 0 9999px rgba(20,12,40,0.55)",
            pointerEvents: "none",
          }}
        />
      )}
      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={textId}
        aria-describedby={count ? countId : undefined}
        className={reduced ? undefined : "tips-card-fade"}
        style={{
          position: "absolute",
          ...cardPos,
          width: cardW,
          background: "rgba(52,38,86,0.98)",
          border: "1px solid rgba(255,255,255,0.18)",
          borderRadius: 20,
          padding: 16,
        }}
      >
        <div className="flex gap-3 items-start">
          <ChronicleMark size={28} className="text-white shrink-0" />
          <div className="min-w-0">
            <p
              id={textId}
              ref={textRef}
              tabIndex={-1}
              className="text-white outline-none"
              style={{ fontSize: 15, lineHeight: 1.45 }}
            >
              {tip.text}
            </p>
            {count && (
              <p id={countId} className="mt-1.5" style={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }}>
                {count}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center justify-end gap-1 mt-3">
          {tips.length > 1 && <button
            type="button"
            onClick={() => finish("skipped")}
            className="px-3 text-sm"
            style={{ color: "rgba(255,255,255,0.75)", minHeight: 44, minWidth: 44 }}
          >
            Skip tips
          </button>}
          <button
            type="button"
            onClick={() => (last ? finish("completed") : setIndex((i) => i + 1))}
            aria-label={last ? "Got it" : "Next tip"}
            className="px-5 rounded-full text-sm font-bold"
            style={{ background: "white", color: "#7C6BAE", minHeight: 44, minWidth: 44 }}
          >
            {last ? "Got it" : "Next"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
