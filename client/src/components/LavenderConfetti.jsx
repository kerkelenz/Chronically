const COLORS = ["#C4A8C0", "#9B8EC4", "#E5CFF7", "#B7A6D9", "rgba(255,255,255,0.85)"];

// pre-generated so every fall looks organic but the component stays simple
// (mirrors mobile/components/LavenderConfetti.jsx)
const PIECES = Array.from({ length: 26 }, (_, i) => ({
  key: i,
  leftPct: 4 + Math.random() * 92,           // % across the screen
  size: 5 + Math.random() * 6,               // 5–11px
  round: Math.random() < 0.5,                // circles + rounded rects
  petal: Math.random() < 0.25,               // a few petal-shaped ones
  color: COLORS[i % COLORS.length],
  delay: Math.random() * 700,                // staggered start
  duration: 2400 + Math.random() * 1200,     // 2.4–3.6s — unhurried
  sway: (14 + Math.random() * 22) * (Math.random() < 0.5 ? 1 : -1),
  spin: (Math.random() < 0.5 ? -1 : 1) * (90 + Math.random() * 120),
}));

// vertical stops bake the mobile version's quad ease-out (1 - (1-t)^2) into
// linear keyframes; sway and fade match its interpolation stops
const KEYFRAMES = `
@keyframes chron-confetti-fall {
  0%   { opacity: 0;    transform: translate(0px, -40px) rotate(0deg); }
  8%   { opacity: 0.85; }
  25%  { transform: translate(var(--sway), calc((80vh + 40px) * 0.4375 - 40px)) rotate(calc(var(--spin) * 0.25)); }
  50%  { transform: translate(0px, calc((80vh + 40px) * 0.75 - 40px)) rotate(calc(var(--spin) * 0.5)); }
  75%  { opacity: 0.55; transform: translate(calc(var(--sway) * -0.7), calc((80vh + 40px) * 0.9375 - 40px)) rotate(calc(var(--spin) * 0.75)); }
  100% { opacity: 0;    transform: translate(calc(var(--sway) * 0.3), 80vh) rotate(var(--spin)); }
}
`;

/** One-shot gentle lavender confetti fall. Renders nothing if the user has
 *  reduce-motion enabled — the affirmation itself is the celebration. */
export default function LavenderConfetti() {
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return null;

  return (
    <div className="absolute inset-0 z-20" style={{ pointerEvents: "none" }} aria-hidden="true">
      <style>{KEYFRAMES}</style>
      {PIECES.map((p) => (
        <span
          key={p.key}
          style={{
            position: "absolute",
            top: 0,
            left: `${p.leftPct}%`,
            width: p.petal ? p.size * 1.9 : p.size,
            height: p.size,
            borderRadius: p.petal ? p.size : p.round ? p.size / 2 : 2,
            backgroundColor: p.color,
            opacity: 0,
            "--sway": `${p.sway}px`,
            "--spin": `${p.spin}deg`,
            animation: `chron-confetti-fall ${p.duration}ms linear ${p.delay}ms both`,
          }}
        />
      ))}
    </div>
  );
}
