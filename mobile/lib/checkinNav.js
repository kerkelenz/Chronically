import { router } from "expo-router";

let deliberate = false;

// `prefill` (optional) copies a previous check-in's answers into the flow and
// opens it straight on the review step — the low-spoon "Same as last time" path.
// Sleep is never carried over; last night isn't yesterday.
export function openCheckIn(askSleep = true, prefill = null) {
  deliberate = true;
  const params = { askSleep: askSleep ? "true" : "false" };
  if (prefill) params.prefill = JSON.stringify(prefill);
  router.push({ pathname: "/checkin", params });
}

export function consumeDeliberateOpen() {
  const was = deliberate;
  deliberate = false;
  return was;
}
