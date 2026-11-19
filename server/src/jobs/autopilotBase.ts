// Whether the autopilot is steering a night from a base temperature of its own (set in
// Settings > Autopilot). While it is, scheduled temperature changes are skipped: that night's
// temperature is the autopilot's, and it hands the bed back to the schedule when the night ends.
// Keep this file free of runtime imports so tests can load it without a Pod environment.
let isKeepingOwnBase = false;

export function setAutopilotKeepsOwnBase(isKeeping: boolean) {
  isKeepingOwnBase = isKeeping;
}

export function doesAutopilotKeepOwnBase(): boolean {
  return isKeepingOwnBase;
}
