// What the app puts front and centre. This is data, not a component, and it is
// read by both the Profile modal and the welcome step — so it lives here rather
// than being exported from a component file, which also breaks fast refresh.
//
// Kept identical to mobile/components/TrackingFocusSheet.jsx.

export const TRACKING_OPTIONS = [
  { value: "physical", label: "My body", hint: "Physical symptoms lead." },
  { value: "mental", label: "My mind", hint: "Mood and mind symptoms lead, and the pain question is skipped." },
  { value: "both", label: "Both", hint: "Everything, physical first." },
];

export const trackingLabel = (mode) =>
  (TRACKING_OPTIONS.find((o) => o.value === mode) || TRACKING_OPTIONS[2]).label;
