export const METRIC_LABELS = {
  pain:     { 1: "Very Severe", 2: "Severe",   3: "Moderate", 4: "Light",  5: "Very Light" },
  mood:     { 1: "Very Low",    2: "Low",       3: "Okay",     4: "Good",   5: "Great" },
  energy:   { 1: "Exhausted",   2: "Drained",   3: "Low",      4: "Good",   5: "Full" },
  anxiety:  { 1: "Severe",      2: "High",      3: "Moderate", 4: "Mild",   5: "Calm" },
  appetite: { 1: "None",        2: "Poor",      3: "Fair",     4: "Good",   5: "Great" },
};

// dial order + colors mirror the web dashboard
export const METRICS = [
  { key: "painLevel",     label: "Pain",     color: "rgba(255,255,255,0.9)"  },
  { key: "moodLevel",     label: "Mood",     color: "rgba(222,200,218,0.95)" },
  { key: "energyLevel",   label: "Energy",   color: "rgba(143,175,155,0.95)" },
  { key: "anxietyLevel",  label: "Anxiety",  color: "rgba(155,175,196,0.95)" },
  { key: "appetiteLevel", label: "Appetite", color: "rgba(196,168,130,0.95)" },
];

// full 16-symptom list (used in Phase 4; defined here for reuse)
export const SYMPTOM_LIST = [
  "Fatigue", "Brain fog", "Pain flare", "Numbness",
  "Spasticity", "Vision issues", "Heat sensitivity", "Balance issues",
  "Dizziness", "Headache", "Muscle weakness", "Joint pain",
  "Shortness of breath", "Nausea", "Sleep disturbance", "Bladder urgency",
];
