
!function(){try{var e="undefined"!=typeof window?window:"undefined"!=typeof global?global:"undefined"!=typeof globalThis?globalThis:"undefined"!=typeof self?self:{},n=(new e.Error).stack;n&&(e._sentryDebugIds=e._sentryDebugIds||{},e._sentryDebugIds[n]="a5f11a83-7b94-58ca-9097-8c6c193f0746")}catch(e){}}();
const MS_PER_MINUTE = 60_000;
const preWarmEndsAtMs = { left: 0, right: 0 };
// Marks a side as warming up for the next `minutes`, i.e. until its alarm time
export function startPreWarm(side, minutes, nowMs = Date.now()) {
    preWarmEndsAtMs[side] = nowMs + minutes * MS_PER_MINUTE;
}
export function isPreWarmActive(side, nowMs = Date.now()) {
    return nowMs < preWarmEndsAtMs[side];
}
// Ends a warm-up early, e.g. when the side is switched off
export function cancelPreWarm(side) {
    preWarmEndsAtMs[side] = 0;
}
//# sourceMappingURL=preWarmState.js.map
//# debugId=a5f11a83-7b94-58ca-9097-8c6c193f0746
