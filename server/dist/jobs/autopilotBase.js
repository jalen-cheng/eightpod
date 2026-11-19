// Whether the autopilot is steering a night from a base temperature of its own (set in
// Settings > Autopilot). While it is, scheduled temperature changes are skipped: that night's
// temperature is the autopilot's, and it hands the bed back to the schedule when the night ends.
// Keep this file free of runtime imports so tests can load it without a Pod environment.

!function(){try{var e="undefined"!=typeof window?window:"undefined"!=typeof global?global:"undefined"!=typeof globalThis?globalThis:"undefined"!=typeof self?self:{},n=(new e.Error).stack;n&&(e._sentryDebugIds=e._sentryDebugIds||{},e._sentryDebugIds[n]="b727d9c3-8d55-5c8b-9bc6-81d1634db923")}catch(e){}}();
let isKeepingOwnBase = false;
export function setAutopilotKeepsOwnBase(isKeeping) {
    isKeepingOwnBase = isKeeping;
}
export function doesAutopilotKeepOwnBase() {
    return isKeepingOwnBase;
}
//# sourceMappingURL=autopilotBase.js.map
//# debugId=b727d9c3-8d55-5c8b-9bc6-81d1634db923
