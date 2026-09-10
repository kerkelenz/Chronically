import { router } from "expo-router";

let deliberate = false;

export function openCheckIn(askSleep = true) {
  deliberate = true;
  router.push({
    pathname: "/checkin",
    params: { askSleep: askSleep ? "true" : "false" },
  });
}

export function consumeDeliberateOpen() {
  const was = deliberate;
  deliberate = false;
  return was;
}
