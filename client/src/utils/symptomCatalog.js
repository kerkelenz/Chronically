// Symptom catalog — names are what gets stored on check-ins; icon is a
// healthicons export name resolved per-platform in SymptomIcon.
// COMMON_SYMPTOMS is the default quick-pick grid; the full catalog is searchable.
//
// `kind` decides which quick-pick grid an entry appears in — physical, mental,
// or both. It never hides anything: search always covers the whole catalog
// whatever the user's tracking mode, so a mode only changes what is offered
// first.
//
// It also drives the insight engine's tautology guard: a `mental` symptom is
// never correlated against mood or anxiety, because "Low mood weighs on your
// mood" is a restatement, not a finding. server/lib/insights.js keeps its own
// copy of the mental names, and a parity test fails if the two drift.

export const COMMON_SYMPTOMS = [
  "Fatigue", "Brain fog", "Nausea", "Vision issues",
  "Pain flare", "Headache", "Dizziness", "Joint pain",
  "Muscle aches", "Numbness", "Stomach issues", "Sleep issues",
  "Shortness of breath",
];

// The quick-pick grid for the mind side. COMMON_SYMPTOMS (above) is unchanged.
export const COMMON_MENTAL_SYMPTOMS = [
  "Low mood", "Anxiety spike", "Overwhelm", "Low motivation",
  "Racing thoughts", "Trouble concentrating", "Irritability", "Panic attack",
];

export const SYMPTOM_CATALOG = [
  { name: "Fatigue",               icon: "Sleepy",             kind: "both" },
  { name: "Fever",                 icon: "Fever",              kind: "physical" },
  { name: "Chills",                icon: "Chills",             kind: "physical" },
  { name: "Night sweats",          icon: "Sweating",           kind: "physical" },
  { name: "Flu-like feeling",      icon: "Virus",              kind: "physical" },
  { name: "Pain flare",            icon: "Symptom",            kind: "physical" },
  { name: "Headache",              icon: "Headache",           kind: "physical" },
  { name: "Migraine",              icon: "Headache",           kind: "physical" },
  { name: "Joint pain",            icon: "Joints",             kind: "physical" },
  { name: "Back pain",             icon: "BackPain",           kind: "physical" },
  { name: "Neck pain",             icon: "Spine",              kind: "physical" },
  { name: "Muscle aches",          icon: "Arm",                kind: "physical" },
  { name: "Muscle weakness",       icon: "WalkSupported",      kind: "physical" },
  { name: "Muscle cramps",         icon: "Leg",                kind: "physical" },
  { name: "Nerve pain",            icon: "Neurology",          kind: "physical" },
  { name: "Chest pain",            icon: "Heart",              kind: "physical" },
  { name: "Abdominal pain",        icon: "IntestinalPain",     kind: "physical" },
  { name: "Eye pain",              icon: "Eye",                kind: "physical" },
  { name: "Brain fog",             icon: "Confused",           kind: "both" },
  { name: "Dizziness",             icon: "Dizzy",              kind: "physical" },
  { name: "Vertigo",               icon: "Woozy",              kind: "physical" },
  { name: "Fainting",              icon: "Woozy",              kind: "physical" },
  { name: "Numbness",              icon: "Leg",                kind: "physical" },
  { name: "Tingling",              icon: "Foot",               kind: "physical" },
  { name: "Tremor",                icon: "Symptom",            kind: "physical" },
  { name: "Balance issues",        icon: "Walking",            kind: "physical" },
  { name: "Vision issues",         icon: "LowVision",          kind: "physical" },
  { name: "Light sensitivity",     icon: "Eye",                kind: "physical" },
  { name: "Sound sensitivity",     icon: "Ear",                kind: "physical" },
  { name: "Ringing ears",          icon: "Deaf",               kind: "physical" },
  { name: "Memory issues",         icon: "Neurology",          kind: "both" },
  { name: "Nausea",                icon: "Nauseous",           kind: "physical" },
  { name: "Vomiting",              icon: "Vomiting",           kind: "physical" },
  { name: "Diarrhea",              icon: "Diarrhea",           kind: "physical" },
  { name: "Constipation",          icon: "IntestinalPain",     kind: "physical" },
  { name: "Bloating",              icon: "Stomach",            kind: "physical" },
  { name: "Stomach issues",        icon: "Stomach",            kind: "physical" },
  { name: "Acid reflux",           icon: "Expectorate",        kind: "physical" },
  { name: "Shortness of breath",   icon: "Lungs",              kind: "physical" },
  { name: "Cough",                 icon: "Coughing",           kind: "physical" },
  { name: "Congestion",            icon: "Nose",               kind: "physical" },
  { name: "Sore throat",           icon: "Mouth",              kind: "physical" },
  { name: "Runny nose",            icon: "Tissue",             kind: "physical" },
  { name: "Palpitations",          icon: "Heartbeat",          kind: "physical" },
  { name: "Rapid heartbeat",       icon: "Cardiogram",         kind: "physical" },
  { name: "Rash",                  icon: "Allergies",          kind: "physical" },
  { name: "Itching",               icon: "Allergies",          kind: "physical" },
  { name: "Hives",                 icon: "Measles",            kind: "physical" },
  { name: "Flushing",              icon: "FeverEmotions",      kind: "physical" },
  { name: "Bruising",              icon: "Bandaged",           kind: "physical" },
  { name: "Sleep issues",          icon: "Sleepy",             kind: "both" },
  { name: "Insomnia",              icon: "Sleepy",             kind: "both" },
  { name: "Restlessness",          icon: "Nervous",            kind: "mental" },
  { name: "Irritability",          icon: "Angry",              kind: "mental" },
  { name: "Stiffness",             icon: "Skeleton",           kind: "physical" },
  { name: "Swelling",              icon: "Foot",               kind: "physical" },
  { name: "Spasticity",            icon: "Body",               kind: "physical" },
  { name: "Heat sensitivity",      icon: "ThermometerDigital", kind: "physical" },
  { name: "Cold sensitivity",      icon: "Chills",             kind: "physical" },
  { name: "Bladder urgency",       icon: "Bladder",            kind: "physical" },
  { name: "Frequent urination",    icon: "Kidneys",            kind: "physical" },
  { name: "Dry eyes",              icon: "Eye",                kind: "physical" },
  { name: "Dry mouth",             icon: "Tongue",             kind: "physical" },
  { name: "Weight change",         icon: "Weight",             kind: "physical" },

  // ── Mood & mind ──────────────────────────────────────────────────────────
  // Plain language on purpose: "Low motivation", never "anhedonia". These are
  // things to notice and log, not a diagnosis and not a screener.
  { name: "Low mood",              icon: "Sad",                kind: "mental" },
  { name: "Hopelessness",          icon: "MentalHealth",       kind: "mental" },
  { name: "Anxiety spike",         icon: "Nervous",            kind: "mental" },
  { name: "Panic attack",          icon: "SweatingEmotions",   kind: "mental" },
  { name: "Racing thoughts",       icon: "Neurology",          kind: "mental" },
  { name: "Intrusive thoughts",    icon: "MentalHealth",       kind: "mental" },
  { name: "Rumination",            icon: "Neurology",          kind: "mental" },
  { name: "Overwhelm",             icon: "Confused",           kind: "mental" },
  { name: "Sensory overload",      icon: "Neurology",          kind: "mental" },
  { name: "Low motivation",        icon: "Sleepy",             kind: "mental" },
  { name: "Emotional numbness",    icon: "MentalHealth",       kind: "mental" },
  { name: "Dissociation",          icon: "Woozy",              kind: "mental" },
  { name: "Social withdrawal",     icon: "MentalHealth",       kind: "mental" },
  { name: "Trouble concentrating", icon: "Confused",           kind: "mental" },
  { name: "Crying spells",         icon: "Sad",                kind: "mental" },
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
