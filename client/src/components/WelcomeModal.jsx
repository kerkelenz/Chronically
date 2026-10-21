import { useEffect, useRef, useState } from "react";
import { refreshTips } from "../lib/tipsStore";
import { useAuth } from "../hooks/useAuth";
import axios from "axios";
import { track } from "../lib/analytics";
import { FiCheckCircle, FiTrendingUp, FiPackage, FiCalendar } from "react-icons/fi";
import { GiSpoon } from "react-icons/gi";
import ChronicleMark from "./ChronicleMark";
import { TRACKING_OPTIONS } from "../utils/trackingFocus";
import { WELCOME_STEPS, WELCOME_FEATURES, WELCOME_PRIVACY, welcomeStepLabel } from "../utils/tips";

const ICONS = { checkin: FiCheckCircle, spoons: GiSpoon, medications: FiPackage, appointments: FiCalendar, trends: FiTrendingUp };

const KEYFRAMES = `
@keyframes welcome-step-in { from { opacity: 0; transform: translateY(6px) } to { opacity: 1; transform: none } }
.welcome-step { animation: welcome-step-in 220ms ease-out; }
@media (prefers-reduced-motion: reduce) { .welcome-step { animation: none; } }
`;

/**
 * Chronicle's welcome: three short steps, skippable at any point. The first
 * close enrols a new account in tips (PUT /welcome); `replay` (from Profile)
 * just shows the steps again and changes nothing else. Mobile twin:
 * mobile/components/WelcomeModal.jsx — the copy is shared via utils/tips.js.
 */
export default function WelcomeModal({ onClose, onTrackingChange, replay = false }) {
  const { user, token, updateUser } = useAuth();
  const [step, setStep] = useState(0);
  // Preselected, and left alone if they skip — nobody is made to answer this
  // to get into the app.
  const [mode, setMode] = useState(() => (replay && user?.trackingMode) || "both");
  const titleRef = useRef(null);
  const cardRef = useRef(null);
  const closing = useRef(false);
  const returnFocus = useRef(typeof document !== "undefined" ? document.activeElement : null);

  const current = WELCOME_STEPS[step];
  const last = step === WELCOME_STEPS.length - 1;

  const chooseMode = async (value) => {
    setMode(value);
    try {
      await axios.put(
        `${import.meta.env.VITE_API_URL}/api/users/tracking-mode`,
        { trackingMode: value },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      updateUser({ ...user, trackingMode: value });
      onTrackingChange?.(value);
    } catch {
      // non-fatal — "both" is the default and the Profile row is the other route
    }
  };

  const dismiss = async (skipped) => {
    if (closing.current) return;
    closing.current = true;
    if (!replay) {
      try {
        await axios.put(
          `${import.meta.env.VITE_API_URL}/api/users/welcome`,
          {},
          { headers: { Authorization: `Bearer ${token}` } },
        );
      } catch {
        // non-fatal — still dismiss locally
      }
      // closing the welcome is what enrols a new account in tips
      refreshTips();
      track("welcome_completed", { step: current.id, skipped });
      updateUser({ ...user, hasSeenWelcome: true });
    }
    onClose();
  };

  // each step's title takes focus, so a screen reader starts at the top
  useEffect(() => {
    titleRef.current?.focus();
  }, [step]);

  useEffect(() => {
    const focusBack = returnFocus.current;
    return () => { if (focusBack && typeof focusBack.focus === "function") focusBack.focus(); };
  }, []);

  // Escape skips; Tab stays inside the card
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") { e.preventDefault(); dismiss(true); return; }
      if (e.key !== "Tab" || !cardRef.current) return;
      const focusable = [...cardRef.current.querySelectorAll("button:not([disabled]), [tabindex='-1']")];
      if (focusable.length === 0) return;
      const first = focusable[0];
      const lastEl = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); lastEl.focus(); }
      else if (!e.shiftKey && document.activeElement === lastEl) { e.preventDefault(); first.focus(); }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  const hint = TRACKING_OPTIONS.find((o) => o.value === mode)?.hint;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(20,12,40,0.55)", fontFamily: "Lato, sans-serif" }}
    >
      <style>{KEYFRAMES}</style>
      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="welcome-title"
        className="w-full max-w-md rounded-3xl flex flex-col"
        style={{
          background: "rgba(52,38,86,0.98)",
          border: "1px solid rgba(255,255,255,0.18)",
          maxHeight: "min(640px, calc(100dvh - 32px))",
        }}
      >
        {/* progress and a way out, on every step but the last */}
        <div className="flex items-center justify-between px-5 sm:px-6 pt-3 sm:pt-5">
          <div className="flex gap-1.5" role="img" aria-label={welcomeStepLabel(step)}>
            {WELCOME_STEPS.map((s, i) => (
              <span
                key={s.id}
                className="rounded-full transition-all duration-200"
                style={{
                  width: i === step ? 20 : 8,
                  height: 8,
                  background: i === step ? "white" : "rgba(255,255,255,0.3)",
                }}
              />
            ))}
          </div>
          {!last ? (
            <button
              type="button"
              onClick={() => dismiss(true)}
              className="px-2 text-sm"
              style={{ color: "rgba(255,255,255,0.75)", minHeight: 44, minWidth: 44 }}
            >
              {replay ? "Close" : "Skip"}
            </button>
          ) : (
            <span style={{ minHeight: 44 }} />
          )}
        </div>

        <div key={current.id} className="welcome-step flex-1 overflow-y-auto px-5 sm:px-6 pb-2 flex flex-col gap-3 sm:gap-4">
          {current.id !== "focus" && (
            <div className="flex justify-center text-white" style={{ marginTop: 4 }}>
              <ChronicleMark size={current.id === "hello" ? 56 : 48} />
            </div>
          )}
          <div className="text-center">
            <h2
              id="welcome-title"
              ref={titleRef}
              tabIndex={-1}
              className="text-white outline-none"
              style={{ fontFamily: "Playfair Display, Georgia, serif", fontSize: 24, lineHeight: 1.25 }}
            >
              {current.title}
            </h2>
            <p className="mt-2" style={{ fontSize: 14, lineHeight: 1.5, color: "rgba(255,255,255,0.8)" }}>
              {current.body}
            </p>
          </div>

          {current.id === "hello" && (
            <ul className="flex flex-col gap-2.5">
              {WELCOME_FEATURES.map((f) => {
                const Icon = ICONS[f.key];
                return (
                  <li key={f.key} className="flex gap-3 items-start">
                    <Icon size={20} aria-hidden="true" style={{ color: "white", flexShrink: 0, marginTop: 2 }} />
                    <div>
                      <p className="text-sm font-bold text-white">{f.name}</p>
                      <p style={{ fontSize: 13, lineHeight: 1.4, color: "rgba(255,255,255,0.72)" }}>{f.desc}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          {current.id === "focus" && (
            <div>
              <div className="flex gap-2" role="radiogroup" aria-label={current.title}>
                {TRACKING_OPTIONS.map((o) => {
                  const active = mode === o.value;
                  return (
                    <button
                      key={o.value}
                      type="button"
                      onClick={() => chooseMode(o.value)}
                      role="radio"
                      aria-checked={active}
                      className="flex-1 rounded-2xl transition-colors"
                      style={{
                        background: active ? "white" : "rgba(255,255,255,0.12)",
                        color: active ? "#7C6BAE" : "white",
                        border: `1px solid ${active ? "white" : "rgba(255,255,255,0.25)"}`,
                        minHeight: 52, padding: "0 8px", fontSize: 14, fontWeight: 700,
                      }}
                    >
                      {o.label}
                    </button>
                  );
                })}
              </div>
              <p aria-live="polite" className="text-center mt-3" style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", minHeight: 20 }}>
                {hint}
              </p>
            </div>
          )}

          {current.id === "pace" && (
            <div className="text-center flex flex-col gap-3">
              <p style={{ fontSize: 13, lineHeight: 1.5, color: "rgba(255,255,255,0.7)" }}>{current.note}</p>
              <p style={{ fontSize: 12, color: "rgba(255,255,255,0.55)" }}>{WELCOME_PRIVACY}</p>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 px-5 sm:px-6 pb-5 sm:pb-6 pt-3">
          {step > 0 ? (
            <button
              type="button"
              onClick={() => setStep((s) => s - 1)}
              className="px-3 text-sm"
              style={{ color: "rgba(255,255,255,0.75)", minHeight: 44, minWidth: 44 }}
            >
              Back
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => (last ? dismiss(false) : setStep((s) => s + 1))}
            className="flex-1 rounded-full font-bold transition-opacity hover:opacity-90"
            style={{ background: "white", color: "#7C6BAE", minHeight: 48, fontSize: 15 }}
          >
            {last ? (replay ? "Done" : "Get started") : "Next"}
          </button>
        </div>
      </div>
    </div>
  );
}
