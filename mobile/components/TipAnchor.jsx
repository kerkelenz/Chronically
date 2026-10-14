import { useEffect, useRef } from "react";
import { View } from "react-native";
import { registerAnchor } from "../lib/tipAnchors";

/**
 * Marks what a first-visit tip points at. A plain wrapper: `collapsable={false}`
 * keeps it a real native view on Android so it can be measured.
 */
export default function TipAnchor({ id, children, style }) {
  const ref = useRef(null);
  useEffect(() => registerAnchor(id, ref), [id]);
  return (
    <View ref={ref} collapsable={false} style={style}>
      {children}
    </View>
  );
}
