export const MILESTONES = [3, 7, 14, 30, 60, 90, 100, 180, 365];

export const MILESTONE_COPY = {
  3: "Three days of checking in — a lovely start.",
  7: "Seven days logged. You're really showing up for yourself.",
  14: "Fourteen days of check-ins. Wonderful consistency.",
  30: "Thirty days tracked — a real picture is taking shape.",
  60: "Sixty days of looking after yourself. Look how far you've come.",
  90: "Ninety days logged. That's remarkable care.",
  100: "One hundred days tracked. An incredible milestone.",
  180: "One hundred eighty days — half a year of showing up.",
  365: "A full year of check-ins. Extraordinary.",
};

export const totalCheckInDays = (checkIns) =>
  new Set(checkIns.map((c) => c.date)).size;

export const achievedMilestones = (total) =>
  MILESTONES.filter((m) => total >= m);

// --- Achievement badge metadata ---
export const MILESTONE_META = {
  3:   { name: "First Steps",  tier: 1, glyph: "sprout" },
  7:   { name: "One Week",     tier: 1, glyph: "leaf" },
  14:  { name: "Two Weeks",    tier: 1, glyph: "flower" },
  30:  { name: "One Month",    tier: 2, glyph: "star" },
  60:  { name: "Two Months",   tier: 2, glyph: "rosette" },
  90:  { name: "Three Months", tier: 2, glyph: "medal" },
  100: { name: "Hundred Days", tier: 3, glyph: "trophy" },
  180: { name: "Half Year",    tier: 3, glyph: "gem" },
  365: { name: "One Year",     tier: 3, glyph: "crown" },
};

// tier palettes: dark (ring) / mid (glow) / light (accents) / glyph (icon color)
export const TIER_COLORS = {
  1: { dark: "#5E8A72", mid: "#8FAF9B", light: "#D6E7DD", glyph: "#2E4A3A" },
  2: { dark: "#9A6FA6", mid: "#C4A8C0", light: "#EAD9E8", glyph: "#5A3A60" },
  3: { dark: "#C99A33", mid: "#E6C156", light: "#F6E9B8", glyph: "#6E5212" },
};

const round = (v) => Math.round(v * 100) / 100;

function starPath(cx, cy, rad, pts = 5, inner = 0.45) {
  const p = [];
  for (let i = 0; i < pts * 2; i++) {
    const ang = -Math.PI / 2 + (i * Math.PI) / pts;
    const rr = i % 2 === 0 ? rad : rad * inner;
    p.push(`${round(cx + rr * Math.cos(ang))},${round(cy + rr * Math.sin(ang))}`);
  }
  return "M" + p.join(" L") + " Z";
}

// Returns primitive shapes for a glyph centered at (cx, cy), radius ~s.
// Color tokens resolved by the Badge component: "glyph" | "light" | "none".
export function glyphShapes(kind, cx, cy, s) {
  const r = round;
  const P = (d, o = {}) => ({ t: "path", d, fill: o.fill || "none", stroke: o.stroke || "none", sw: o.sw || 0 });
  const C = (x, y, rad, fill) => ({ t: "circle", cx: r(x), cy: r(y), r: r(rad), fill });
  switch (kind) {
    case "sprout":
      return [
        P(`M${r(cx)},${r(cy + s * 0.7)} L${r(cx)},${r(cy - s * 0.1)}`, { stroke: "glyph", sw: r(s * 0.12) }),
        P(`M${r(cx)},${r(cy + s * 0.1)} C${r(cx - s * 0.7)},${r(cy)} ${r(cx - s * 0.8)},${r(cy - s * 0.6)} ${r(cx - s * 0.2)},${r(cy - s * 0.5)} C${r(cx - s * 0.3)},${r(cy)} ${r(cx)},${r(cy + s * 0.1)} ${r(cx)},${r(cy + s * 0.1)} Z`, { fill: "glyph" }),
        P(`M${r(cx)},${r(cy - s * 0.2)} C${r(cx + s * 0.7)},${r(cy - s * 0.3)} ${r(cx + s * 0.8)},${r(cy - s * 0.9)} ${r(cx + s * 0.2)},${r(cy - s * 0.8)} C${r(cx + s * 0.3)},${r(cy - s * 0.3)} ${r(cx)},${r(cy - s * 0.2)} ${r(cx)},${r(cy - s * 0.2)} Z`, { fill: "glyph" }),
      ];
    case "leaf":
      return [
        P(`M${r(cx - s * 0.5)},${r(cy + s * 0.6)} C${r(cx - s * 0.7)},${r(cy - s * 0.5)} ${r(cx + s * 0.3)},${r(cy - s * 0.8)} ${r(cx + s * 0.6)},${r(cy - s * 0.6)} C${r(cx + s * 0.4)},${r(cy + s * 0.3)} ${r(cx - s * 0.2)},${r(cy + s * 0.7)} ${r(cx - s * 0.5)},${r(cy + s * 0.6)} Z`, { fill: "glyph" }),
        P(`M${r(cx - s * 0.35)},${r(cy + s * 0.45)} L${r(cx + s * 0.45)},${r(cy - s * 0.45)}`, { stroke: "light", sw: r(s * 0.08) }),
      ];
    case "flower": {
      const out = [];
      for (let i = 0; i < 5; i++) {
        const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
        out.push(C(cx + s * 0.55 * Math.cos(a), cy + s * 0.55 * Math.sin(a), s * 0.34, "glyph"));
      }
      out.push(C(cx, cy, s * 0.3, "light"));
      return out;
    }
    case "star":
      return [P(starPath(cx, cy, s * 0.95), { fill: "glyph" })];
    case "rosette":
      return [
        P(`M${r(cx - s * 0.3)},${r(cy + s * 0.2)} L${r(cx - s * 0.55)},${r(cy + s * 0.95)} L${r(cx - s * 0.12)},${r(cy + s * 0.6)} Z`, { fill: "glyph" }),
        P(`M${r(cx + s * 0.3)},${r(cy + s * 0.2)} L${r(cx + s * 0.55)},${r(cy + s * 0.95)} L${r(cx + s * 0.12)},${r(cy + s * 0.6)} Z`, { fill: "glyph" }),
        C(cx, cy - s * 0.15, s * 0.6, "glyph"),
        P(starPath(cx, cy - s * 0.15, s * 0.36), { fill: "light" }),
      ];
    case "medal":
      return [
        P(`M${r(cx - s * 0.4)},${r(cy - s * 0.9)} L${r(cx - s * 0.1)},${r(cy)}`, { stroke: "glyph", sw: r(s * 0.12) }),
        P(`M${r(cx + s * 0.4)},${r(cy - s * 0.9)} L${r(cx + s * 0.1)},${r(cy)}`, { stroke: "glyph", sw: r(s * 0.12) }),
        C(cx, cy + s * 0.25, s * 0.6, "glyph"),
        P(starPath(cx, cy + s * 0.25, s * 0.34), { fill: "light" }),
      ];
    case "trophy":
      return [
        P(`M${r(cx - s * 0.55)},${r(cy - s * 0.7)} L${r(cx + s * 0.55)},${r(cy - s * 0.7)} L${r(cx + s * 0.42)},${r(cy)} C${r(cx + s * 0.42)},${r(cy + s * 0.3)} ${r(cx - s * 0.42)},${r(cy + s * 0.3)} ${r(cx - s * 0.42)},${r(cy)} Z`, { fill: "glyph" }),
        P(`M${r(cx - s * 0.55)},${r(cy - s * 0.55)} C${r(cx - s * 0.95)},${r(cy - s * 0.5)} ${r(cx - s * 0.9)},${r(cy - s * 0.05)} ${r(cx - s * 0.5)},${r(cy - s * 0.15)}`, { stroke: "glyph", sw: r(s * 0.12) }),
        P(`M${r(cx + s * 0.55)},${r(cy - s * 0.55)} C${r(cx + s * 0.95)},${r(cy - s * 0.5)} ${r(cx + s * 0.9)},${r(cy - s * 0.05)} ${r(cx + s * 0.5)},${r(cy - s * 0.15)}`, { stroke: "glyph", sw: r(s * 0.12) }),
        P(`M${r(cx)},${r(cy + s * 0.3)} L${r(cx)},${r(cy + s * 0.6)} M${r(cx - s * 0.35)},${r(cy + s * 0.7)} L${r(cx + s * 0.35)},${r(cy + s * 0.7)}`, { stroke: "glyph", sw: r(s * 0.12) }),
      ];
    case "gem":
      return [
        P(`M${r(cx - s * 0.7)},${r(cy - s * 0.3)} L${r(cx - s * 0.35)},${r(cy - s * 0.7)} L${r(cx + s * 0.35)},${r(cy - s * 0.7)} L${r(cx + s * 0.7)},${r(cy - s * 0.3)} L${r(cx)},${r(cy + s * 0.8)} Z`, { fill: "glyph" }),
        P(`M${r(cx - s * 0.7)},${r(cy - s * 0.3)} L${r(cx + s * 0.7)},${r(cy - s * 0.3)} M${r(cx - s * 0.35)},${r(cy - s * 0.7)} L${r(cx)},${r(cy + s * 0.8)} M${r(cx + s * 0.35)},${r(cy - s * 0.7)} L${r(cx)},${r(cy + s * 0.8)} M${r(cx)},${r(cy - s * 0.7)} L${r(cx)},${r(cy + s * 0.8)}`, { stroke: "light", sw: r(s * 0.07) }),
      ];
    case "crown":
      return [
        P(`M${r(cx - s * 0.75)},${r(cy + s * 0.5)} L${r(cx - s * 0.85)},${r(cy - s * 0.6)} L${r(cx - s * 0.4)},${r(cy - s * 0.05)} L${r(cx)},${r(cy - s * 0.75)} L${r(cx + s * 0.4)},${r(cy - s * 0.05)} L${r(cx + s * 0.85)},${r(cy - s * 0.6)} L${r(cx + s * 0.75)},${r(cy + s * 0.5)} Z`, { fill: "glyph" }),
        P(`M${r(cx - s * 0.75)},${r(cy + s * 0.5)} L${r(cx + s * 0.75)},${r(cy + s * 0.5)}`, { stroke: "light", sw: r(s * 0.11) }),
      ];
    default:
      return [];
  }
}

// lock glyph for not-yet-earned badges
export function lockShapes(cx, cy, s) {
  const r = round;
  return [
    { t: "rect", x: r(cx - s * 0.5), y: r(cy - s * 0.05), w: r(s), h: r(s * 0.75), rx: r(s * 0.14) },
    { t: "path", d: `M${r(cx - s * 0.32)},${r(cy)} L${r(cx - s * 0.32)},${r(cy - s * 0.3)} C${r(cx - s * 0.32)},${r(cy - s * 0.7)} ${r(cx + s * 0.32)},${r(cy - s * 0.7)} ${r(cx + s * 0.32)},${r(cy - s * 0.3)} L${r(cx + s * 0.32)},${r(cy)}`, sw: r(s * 0.12) },
  ];
}
