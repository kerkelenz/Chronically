import { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import BottomSheet from "./BottomSheet";
import { SheetHeader } from "./FormSheet";
import api from "../lib/api";

// Kept identical to the web TrackingFocusModal and the welcome step.
export const TRACKING_OPTIONS = [
  { value: "physical", label: "My body", hint: "Physical symptoms lead." },
  { value: "mental", label: "My mind", hint: "Mood and mind symptoms lead, and the pain question is skipped." },
  { value: "both", label: "Both", hint: "Everything, physical first." },
];

export const trackingLabel = (mode) =>
  (TRACKING_OPTIONS.find((o) => o.value === mode) || TRACKING_OPTIONS[2]).label;

/**
 * Chooses what the app puts front and centre. It only changes what's offered
 * first and whether pain is asked — search always covers the whole catalog,
 * so nothing is ever out of reach.
 */
export default function TrackingFocusSheet({ visible, current, onClose, onSaved }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const choose = async (value) => {
    if (saving || value === current) { onClose(); return; }
    setSaving(true);
    setError("");
    try {
      const res = await api.put("/api/users/tracking-mode", { trackingMode: value });
      onSaved(res.data.trackingMode);
      setSaving(false);
      onClose();
    } catch {
      setError("Couldn't save that. Please try again.");
      setSaving(false);
    }
  };

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <SheetHeader
        title="Tracking focus"
        subtitle="What would you like to keep track of? You can change this anytime. Everything stays searchable either way."
      />
      <View style={styles.list}>
        {TRACKING_OPTIONS.map((o) => {
          const active = current === o.value;
          return (
            <TouchableOpacity
              key={o.value}
              style={[styles.option, active && styles.optionActive]}
              onPress={() => choose(o.value)}
              disabled={saving}
              activeOpacity={0.8}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`${o.label}. ${o.hint}`}
            >
              <Text style={[styles.optionLabel, active && styles.optionLabelActive]}>{o.label}</Text>
              <Text style={[styles.optionHint, active && styles.optionHintActive]}>{o.hint}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  list: { gap: 12, marginTop: 4 },
  option: {
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
    paddingVertical: 18,
    paddingHorizontal: 16,
  },
  optionActive: { backgroundColor: "white", borderColor: "white" },
  optionLabel: { fontFamily: "Lato_700Bold", fontSize: 16, color: "white" },
  optionLabelActive: { color: "#7C6BAE" },
  optionHint: {
    fontFamily: "Lato_400Regular",
    fontSize: 13,
    lineHeight: 19,
    color: "rgba(255,255,255,0.7)",
    marginTop: 3,
  },
  optionHintActive: { color: "rgba(124,107,174,0.8)" },
  error: {
    fontFamily: "Lato_400Regular",
    fontSize: 14,
    color: "rgba(255,255,255,0.85)",
    marginTop: 14,
    textAlign: "center",
  },
});
