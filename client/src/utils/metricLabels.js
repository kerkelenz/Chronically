// Per-metric level wording. All metrics are 5 = best, so pain/anxiety read
// inverted against a generic magnitude scale — these labels are the truth.
// Kept identical in content to mobile/theme/metrics.js's METRIC_LABELS.
export const METRIC_LABELS = {
  pain:     { 1: "Very Severe",  2: "Severe",  3: "Moderate", 4: "Light",  5: "Very Light" },
  mood:     { 1: "Very Low",     2: "Low",     3: "Okay",     4: "Good",   5: "Great" },
  energy:   { 1: "Exhausted",    2: "Drained", 3: "Low",      4: "Good",   5: "Full" },
  anxiety:  { 1: "Severe",       2: "High",    3: "Moderate", 4: "Mild",   5: "Calm" },
  appetite: { 1: "None",         2: "Poor",    3: "Fair",     4: "Good",   5: "Great" },
  sleep:    { 1: "Barely slept", 2: "Poorly",  3: "Okay",     4: "Well",   5: "Wonderfully" },
};
