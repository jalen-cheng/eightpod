// Lets the code that sets a temperature by hand (the app, a shortcut, a side button) tell the
// autopilot about it, without depending on the autopilot, which itself sets temperatures. The
// autopilot registers a listener when it starts; with none registered nothing happens.
// Keep this file free of runtime imports so tests can load it without a Pod environment.
import type { Side } from '../db/schedulesSchema.js';

type ManualChangeListener = (side: Side, temperatureF: number) => void;

let registeredListener: ManualChangeListener | undefined;

export function registerManualChangeListener(listener: ManualChangeListener | undefined) {
  registeredListener = listener;
}

// Call when a person, not the schedule or the autopilot, set a side's temperature
export function noteManualTemperature(side: Side, temperatureF: number) {
  registeredListener?.(side, temperatureF);
}
