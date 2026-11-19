// Whether the autopilot is steering a night. While it is, the temperature is its to set, and
// scheduled temperature changes are skipped; it hands the bed back to the schedule when the
// night ends. Bed on, bed off, the warm-up and the alarm are not affected.
// Keep this file free of runtime imports so tests can load it without a Pod environment.

!function(){try{var e="undefined"!=typeof window?window:"undefined"!=typeof global?global:"undefined"!=typeof globalThis?globalThis:"undefined"!=typeof self?self:{},n=(new e.Error).stack;n&&(e._sentryDebugIds=e._sentryDebugIds||{},e._sentryDebugIds[n]="3a02bebd-a085-5f04-9190-3f418986e7c3")}catch(e){}}();
let isSteering = false;
export function setAutopilotSteering(isSteeringNow) {
    isSteering = isSteeringNow;
}
export function isAutopilotSteering() {
    return isSteering;
}
//# sourceMappingURL=autopilotSteering.js.map
//# debugId=3a02bebd-a085-5f04-9190-3f418986e7c3
