import { useEffect, useRef } from "react";
import { View } from "react-native";
import { registerAnchor } from "../lib/tipAnchors";

/**
 * Marks what a tip points at. A plain wrapper: `collapsable={false}` keeps it
 * a real native view on Android so it can be measured. A null `id` is just the
 * wrapper — handy in a list, where only the first item carries the anchor.
 */
export default function TipAnchor({ id, children, style }) {
  const ref = useRef(null);
  useEffect(() => (id ? registerAnchor(id, ref) : undefined), [id]);
  return (
    <View ref={ref} collapsable={false} style={style}>
      {children}
    </View>
  );
}
