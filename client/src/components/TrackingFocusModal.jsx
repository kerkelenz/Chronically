import { useState } from "react";
import axios from "axios";
import FormModal from "./FormModal";

// Kept identical to the mobile TrackingFocusSheet and the welcome step.
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
export default function TrackingFocusModal({ open, current, token, onClose, onSaved }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const choose = async (value) => {
    if (saving || value === current) { onClose(); return; }
    setSaving(true);
    setError("");
    try {
      const res = await axios.put(
        `${import.meta.env.VITE_API_URL}/api/users/tracking-mode`,
        { trackingMode: value },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      onSaved(res.data.trackingMode);
      setSaving(false);
      onClose();
    } catch {
      setError("Couldn't save that. Please try again.");
      setSaving(false);
    }
  };

  return (
    <FormModal
      open={open}
      onClose={onClose}
      title="Tracking focus"
      subtitle="What would you like to keep track of? You can change this anytime. Everything stays searchable either way."
    >
      <div className="flex flex-col gap-3 pb-4">
        {TRACKING_OPTIONS.map((o) => {
          const active = current === o.value;
          return (
            <button
              key={o.value}
              type="button"
              onClick={() => choose(o.value)}
              disabled={saving}
              role="radio"
              aria-checked={active}
              aria-label={`${o.label}. ${o.hint}`}
              className="w-full text-left rounded-2xl transition-colors disabled:opacity-60"
              style={{
                background: active ? "white" : "rgba(255,255,255,0.12)",
                border: `1px solid ${active ? "white" : "rgba(255,255,255,0.25)"}`,
                padding: "18px 16px",
              }}
            >
              <p style={{ color: active ? "#7C6BAE" : "white", fontSize: 16, fontWeight: 700 }}>
                {o.label}
              </p>
              <p
                style={{
                  color: active ? "rgba(124,107,174,0.8)" : "rgba(255,255,255,0.7)",
                  fontSize: 13, lineHeight: 1.45, marginTop: 3,
                }}
              >
                {o.hint}
              </p>
            </button>
          );
        })}
        {error ? <p className="text-sm text-center text-white/85">{error}</p> : null}
      </div>
    </FormModal>
  );
}
