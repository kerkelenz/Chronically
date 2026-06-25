import Svg, { Defs, RadialGradient, Stop, Circle, Ellipse, Path, Rect } from "react-native-svg";
import { MILESTONE_META, TIER_COLORS, glyphShapes, lockShapes } from "../lib/milestones";

export default function Badge({ days, earned, size = 64 }) {
  const meta = MILESTONE_META[days];
  if (!meta) return null;
  const t = TIER_COLORS[meta.tier];
  const c = size / 2;
  const R = size * 0.42;
  const gid = `badge-${days}-${earned ? "e" : "l"}-${size}`;
  const color = (tok) => (tok === "glyph" ? t.glyph : tok === "light" ? t.light : "none");

  const renderShape = (sh, i) => {
    const common = {
      fill: sh.fill ? color(sh.fill) : "none",
      stroke: sh.stroke ? color(sh.stroke) : "none",
      strokeWidth: sh.sw || 0,
      strokeLinecap: "round",
      strokeLinejoin: "round",
    };
    if (sh.t === "path") return <Path key={i} d={sh.d} {...common} />;
    if (sh.t === "circle") return <Circle key={i} cx={sh.cx} cy={sh.cy} r={sh.r} {...common} />;
    return null;
  };

  return (
    <Svg width={size} height={size}>
      <Defs>
        <RadialGradient id={gid} cx="38%" cy="32%" r="75%">
          {(earned
            ? [["0%", t.light], ["55%", t.mid], ["100%", t.dark]]
            : [["0%", "#C9C2D6"], ["100%", "#8A82A0"]]
          ).map(([offset, stopColor], i) => (
            <Stop key={i} offset={offset} stopColor={stopColor} stopOpacity="1" />
          ))}
        </RadialGradient>
      </Defs>
      {earned && <Circle cx={c} cy={c} r={R + size * 0.08} fill={t.mid} opacity={0.22} />}
      <Circle cx={c} cy={c} r={R} fill={`url(#${gid})`} stroke={earned ? t.dark : "#7C7390"} strokeWidth={size * 0.045} opacity={earned ? 1 : 0.55} />
      {earned && <Ellipse cx={c - R * 0.32} cy={c - R * 0.38} rx={R * 0.42} ry={R * 0.26} fill="#fff" opacity={0.28} />}
      {earned
        ? glyphShapes(meta.glyph, c, c + size * 0.02, R * 0.5).map(renderShape)
        : lockShapes(c, c, R * 0.5).map((sh, i) =>
            sh.t === "rect"
              ? <Rect key={i} x={sh.x} y={sh.y} width={sh.w} height={sh.h} rx={sh.rx} fill="#ECE8F2" />
              : <Path key={i} d={sh.d} stroke="#ECE8F2" strokeWidth={sh.sw} fill="none" strokeLinecap="round" />
          )}
    </Svg>
  );
}
