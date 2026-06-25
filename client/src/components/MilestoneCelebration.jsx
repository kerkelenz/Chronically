import { useEffect } from "react";
import { MILESTONE_COPY, MILESTONE_META } from "../utils/milestones";
import Badge from "./Badge";

const CONFETTI_COLORS = ["#7C6BAE", "#9B8EC4", "#C4A8C0", "#C4A882", "#7FAF8A", "#FFFFFF"];

export default function MilestoneCelebration({ milestone, onDismiss }) {
  useEffect(() => {
    import("canvas-confetti").then(({ default: confetti }) => {
      confetti({
        particleCount: 150,
        spread: 80,
        origin: { y: 0.55 },
        colors: CONFETTI_COLORS,
      });
    });
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.45)" }}
      onClick={onDismiss}
    >
      <div
        className="mx-4 p-8 rounded-3xl flex flex-col items-center gap-4 text-center"
        style={{
          background: "rgba(255,255,255,0.18)",
          backdropFilter: "blur(24px)",
          border: "1px solid rgba(255,255,255,0.35)",
          maxWidth: "360px",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <Badge days={milestone} earned size={128} />
        <p className="text-xl font-medium" style={{ color: "white", fontFamily: "Playfair Display, Georgia, serif" }}>
          {MILESTONE_META[milestone].name}
        </p>
        <p
          className="text-lg font-medium leading-snug"
          style={{ color: "white", fontFamily: "Playfair Display, Georgia, serif" }}
        >
          {MILESTONE_COPY[milestone]}
        </p>
        <button
          onClick={onDismiss}
          className="mt-2 px-8 py-3 rounded-full text-sm font-medium bg-white hover:scale-105 transition-all duration-200"
          style={{ color: "#7C6BAE" }}
        >
          Keep it up
        </button>
      </div>
    </div>
  );
}
