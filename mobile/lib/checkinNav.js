import { router } from "expo-router";

let deliberate = false;

export function openCheckIn() {
  deliberate = true;
  router.push("/checkin");
}

export function consumeDeliberateOpen() {
  const was = deliberate;
  deliberate = false;
  return was;
}
