// Symptom catalog — names are what gets stored on check-ins; icon is a
// healthicons export name resolved per-platform in SymptomIcon.
// COMMON_SYMPTOMS is the default quick-pick grid; the full catalog is searchable.

export const COMMON_SYMPTOMS = [
  "Fatigue", "Pain flare", "Headache", "Brain fog",
  "Nausea", "Dizziness", "Joint pain", "Muscle aches",
  "Numbness", "Stomach issues", "Sleep issues", "Shortness of breath",
];

export const SYMPTOM_CATALOG = [
  { name: "Fatigue", icon: "Sleepy" },
  { name: "Fever", icon: "Fever" },
  { name: "Chills", icon: "Chills" },
  { name: "Night sweats", icon: "Sweating" },
  { name: "Flu-like feeling", icon: "Virus" },
  { name: "Pain flare", icon: "Symptom" },
  { name: "Headache", icon: "Headache" },
  { name: "Migraine", icon: "Headache" },
  { name: "Joint pain", icon: "Joints" },
  { name: "Back pain", icon: "BackPain" },
  { name: "Neck pain", icon: "Spine" },
  { name: "Muscle aches", icon: "Arm" },
  { name: "Muscle weakness", icon: "WalkSupported" },
  { name: "Muscle cramps", icon: "Leg" },
  { name: "Nerve pain", icon: "Neurology" },
  { name: "Chest pain", icon: "Heart" },
  { name: "Abdominal pain", icon: "IntestinalPain" },
  { name: "Eye pain", icon: "Eye" },
  { name: "Brain fog", icon: "Confused" },
  { name: "Dizziness", icon: "Dizzy" },
  { name: "Vertigo", icon: "Woozy" },
  { name: "Fainting", icon: "Woozy" },
  { name: "Numbness", icon: "Leg" },
  { name: "Tingling", icon: "Foot" },
  { name: "Tremor", icon: "Symptom" },
  { name: "Balance issues", icon: "Walking" },
  { name: "Vision issues", icon: "LowVision" },
  { name: "Light sensitivity", icon: "Eye" },
  { name: "Sound sensitivity", icon: "Ear" },
  { name: "Ringing ears", icon: "Deaf" },
  { name: "Memory issues", icon: "Neurology" },
  { name: "Nausea", icon: "Nauseous" },
  { name: "Vomiting", icon: "Vomiting" },
  { name: "Diarrhea", icon: "Diarrhea" },
  { name: "Constipation", icon: "IntestinalPain" },
  { name: "Bloating", icon: "Stomach" },
  { name: "Stomach issues", icon: "Stomach" },
  { name: "Acid reflux", icon: "Expectorate" },
  { name: "Shortness of breath", icon: "Lungs" },
  { name: "Cough", icon: "Coughing" },
  { name: "Congestion", icon: "Nose" },
  { name: "Sore throat", icon: "Mouth" },
  { name: "Runny nose", icon: "Tissue" },
  { name: "Palpitations", icon: "Heartbeat" },
  { name: "Rapid heartbeat", icon: "Cardiogram" },
  { name: "Rash", icon: "Allergies" },
  { name: "Itching", icon: "Allergies" },
  { name: "Hives", icon: "Measles" },
  { name: "Flushing", icon: "FeverEmotions" },
  { name: "Bruising", icon: "Bandaged" },
  { name: "Sleep issues", icon: "Sleepy" },
  { name: "Insomnia", icon: "Sleepy" },
  { name: "Restlessness", icon: "Nervous" },
  { name: "Irritability", icon: "Angry" },
  { name: "Stiffness", icon: "Skeleton" },
  { name: "Swelling", icon: "Foot" },
  { name: "Spasticity", icon: "Body" },
  { name: "Heat sensitivity", icon: "ThermometerDigital" },
  { name: "Cold sensitivity", icon: "Chills" },
  { name: "Bladder urgency", icon: "Bladder" },
  { name: "Frequent urination", icon: "Kidneys" },
  { name: "Dry eyes", icon: "Eye" },
  { name: "Dry mouth", icon: "Tongue" },
  { name: "Weight change", icon: "Weight" },
];

// Legacy stored names that aren't catalog entries — resolve to an icon.
export const LEGACY_SYMPTOM_ICONS = {
  "Sleep disturbance": "Sleepy",
};

export const FALLBACK_SYMPTOM_ICON = "Symptom"; // custom/unknown entries

const iconIndex = Object.fromEntries(SYMPTOM_CATALOG.map((s) => [s.name, s.icon]));
export function symptomIconName(name) {
  return iconIndex[name] || LEGACY_SYMPTOM_ICONS[name] || FALLBACK_SYMPTOM_ICON;
}
