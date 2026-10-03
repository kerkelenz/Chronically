import Svg, { Path, Circle } from "react-native-svg";

// Chronicle — the Chronically mascot, a lavender bud companion.
// Inline rather than an imported .svg because this project has no SVG
// transformer in metro.config; the med type icons work the same way.
// The seam sits high on purpose: it reads as a little cap while leaving
// the face clear at the 44px size the announcement card uses.
export default function ChronicleMark({ size = 44, color = "#FFFFFF" }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      {/* bud body */}
      <Path
        d="M32 4 C41.5 13.5 46 23 46 32 C46 41 40 47.5 32 47.5 C24 47.5 18 41 18 32 C18 23 22.5 13.5 32 4 Z"
        stroke={color} strokeWidth={2.9} strokeLinecap="round" strokeLinejoin="round"
      />
      {/* bud seam */}
      <Path d="M25.5 18 Q32 22.5 38.5 18" stroke={color} strokeWidth={2.9} strokeLinecap="round" strokeLinejoin="round" />
      {/* face */}
      <Circle cx={27.5} cy={33} r={1.9} fill={color} />
      <Circle cx={36.5} cy={33} r={1.9} fill={color} />
      <Path d="M28.5 38.5 Q32 41.5 35.5 38.5" stroke={color} strokeWidth={2.9} strokeLinecap="round" strokeLinejoin="round" />
      {/* stem and two leaves */}
      <Path d="M32 47.5 L32 60" stroke={color} strokeWidth={2.9} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M32 51.5 C25 50 18 53 14 60 C21 61.5 28.5 58 32 51.5 Z" stroke={color} strokeWidth={2.9} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M32 51.5 C39 50 46 53 50 60 C43 61.5 35.5 58 32 51.5 Z" stroke={color} strokeWidth={2.9} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
