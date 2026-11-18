
!function(){try{var e="undefined"!=typeof window?window:"undefined"!=typeof global?global:"undefined"!=typeof globalThis?globalThis:"undefined"!=typeof self?self:{},n=(new e.Error).stack;n&&(e._sentryDebugIds=e._sentryDebugIds||{},e._sentryDebugIds[n]="e7619334-46cf-5e3a-99d7-37abecaa867f")}catch(e){}}();
const firedAtMs = { left: 0, right: 0 };
export function markOneOffAlarmFired(side, nowMs = Date.now()) {
    firedAtMs[side] = nowMs;
}
// True when the side's one-time alarm went off no longer than `withinMs` ago
export function didOneOffAlarmFireWithin(side, withinMs, nowMs = Date.now()) {
    return firedAtMs[side] > 0 && nowMs - firedAtMs[side] <= withinMs;
}
// For tests and for a side that was switched off by hand
export function forgetOneOffAlarm(side) {
    firedAtMs[side] = 0;
}
//# sourceMappingURL=oneOffAlarmState.js.map
//# debugId=e7619334-46cf-5e3a-99d7-37abecaa867f
