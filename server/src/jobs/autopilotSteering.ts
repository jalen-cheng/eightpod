// Whether the autopilot is steering a night. While it is, the temperature is its to set, and
// scheduled temperature changes are skipped; it hands the bed back to the schedule when the
// night ends. Bed on, bed off, the warm-up and the alarm are not affected.
// Keep this file free of runtime imports so tests can load it without a Pod environment.
let isSteering = false;

export function setAutopilotSteering(isSteeringNow: boolean) {
  isSteering = isSteeringNow;
}

export function isAutopilotSteering(): boolean {
  return isSteering;
}
