import {
  Sleepy, Neurology, Pain, Nerve, Electricity, LowVision,
  Thermometer, WalkSupported, Dizzy, Headache, Weights, Joints,
  Lungs, Nausea, Observation, Bladder,
  Pill1, Syringe, IntravenousBag, MedicineBottle, BloodDrop,
} from "healthicons-react";

const SYMPTOM_ICON_MAP = {
  "Fatigue":            Sleepy,
  "Brain fog":          Neurology,
  "Pain flare":         Pain,
  "Numbness":           Nerve,
  "Spasticity":         Electricity,
  "Vision issues":      LowVision,
  "Heat sensitivity":   Thermometer,
  "Balance issues":     WalkSupported,
  "Dizziness":          Dizzy,
  "Headache":           Headache,
  "Muscle weakness":    Weights,
  "Joint pain":         Joints,
  "Shortness of breath": Lungs,
  "Nausea":             Nausea,
  "Sleep disturbance":  Observation,
  "Bladder urgency":    Bladder,
};

const MEDICATION_TYPE_ICON_MAP = {
  pill:       Pill1,
  injection:  Syringe,
  infusion:   IntravenousBag,
  supplement: MedicineBottle,
  sublingual: BloodDrop,
};

export function SymptomIcon({ name, size = 24, color = "white", style: extraStyle, ...props }) {
  const Icon = SYMPTOM_ICON_MAP[name];
  if (!Icon) return null;
  return (
    <span
      title={name}
      style={{ color, display: "inline-flex", flexShrink: 0, ...extraStyle }}
      {...props}
    >
      <Icon width={size} height={size} />
    </span>
  );
}

export function MedicationTypeIcon({ type, size = 22, color = "white", style: extraStyle, ...props }) {
  const Icon = MEDICATION_TYPE_ICON_MAP[type];
  if (!Icon) return null;
  return (
    <span
      title={type}
      style={{ color, display: "inline-flex", flexShrink: 0, ...extraStyle }}
      {...props}
    >
      <Icon width={size} height={size} />
    </span>
  );
}
