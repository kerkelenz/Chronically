import { useEffect } from "react";

const MILESTONE_COPY = {
  3:   "Three days in a row. You're building the habit.",
  7:   "A full week of checking in. That's real consistency.",
  14:  "Two weeks straight. You're keeping this up beautifully.",
  30:  "Thirty days — a whole month of showing up for yourself.",
  60:  "Sixty days. This is genuine dedication.",
  90:  "Ninety days straight. That's remarkable.",
  100: "One hundred days. An incredible milestone.",
};

const CONFETTI_COLORS = ["#7C6BAE", "#9B8EC4", "#C4A8C0", "#C4A882", "#7FAF8A", "#FFFFFF"];

function FlameIcon({ size = 48 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden="true" style={{ color: "white" }}>
      <path d="M12 23c4.4 0 8-3.3 8-7.5 0-2.6-1.4-4.9-3-6.8-.4 1.2-1.5 2-2.7 2 .9-2.3.4-4.9-1.6-6.7-1.3-1.2-2-2.7-2-4.3C8.5 4 6 7.5 6 11.5c0 1 .2 2 .6 2.9C5.6 13.6 5 12.4 5 11c-1.2 1.5-2 3.3-2 5.5C3 19.7 6.6 23 12 23z"/>
    </svg>
  );
}

function MilestoneCelebration({ milestone, onDismiss }) {
  useEffect(() => {
    import("canvas-confetti").then(({ default: confetti }) => {
      confetti({ particleCount: 120, spread: 80, origin: { y: 0.5 }, colors: CONFETTI_COLORS });
      setTimeout(() => {
        confetti({ particleCount: 60, spread: 50, origin: { y: 0.4 }, colors: CONFETTI_COLORS });
      }, 350);
    });
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
      style={{ background: "rgba(0,0,0,0.45)" }}
      onClick={onDismiss}
    >
      <div
        className="w-full max-w-sm p-8 rounded-2xl flex flex-col items-center gap-5 text-center"
        style={{
          background: "rgba(124,107,174,0.35)",
          backdropFilter: "blur(24px)",
          border: "1px solid rgba(255,255,255,0.3)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <FlameIcon size={52} />
        <p
          style={{
            color: "white",
            fontFamily: "Playfair Display, Georgia, serif",
            fontSize: "2rem",
            fontWeight: "700",
            lineHeight: "1.2",
          }}
        >
          {milestone}-Day Streak!
        </p>
        <p style={{ color: "rgba(255,255,255,0.85)", fontSize: "0.925rem", lineHeight: "1.6" }}>
          {MILESTONE_COPY[milestone]}
        </p>
        <button
          onClick={onDismiss}
          className="mt-1 px-8 py-3 rounded-full font-medium transition-all duration-200 hover:opacity-90 active:scale-95"
          style={{ background: "white", color: "#7C6BAE" }}
        >
          Keep it going
        </button>
      </div>
    </div>
  );
}

export default MilestoneCelebration;
