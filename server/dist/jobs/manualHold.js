
!function(){try{var e="undefined"!=typeof window?window:"undefined"!=typeof global?global:"undefined"!=typeof globalThis?globalThis:"undefined"!=typeof self?self:{},n=(new e.Error).stack;n&&(e._sentryDebugIds=e._sentryDebugIds||{},e._sentryDebugIds[n]="1d71cd06-8ca9-5459-972e-18ea81ab76e5")}catch(e){}}();
const MS_PER_SECOND = 1_000;
const holdEndsAtMs = { left: 0, right: 0 };
// Marks a side as held by hand for the next `seconds`, the length it was switched on for
export function startManualHold(side, seconds, nowMs = Date.now()) {
    holdEndsAtMs[side] = nowMs + seconds * MS_PER_SECOND;
}
export function isManualHoldActive(side, nowMs = Date.now()) {
    return nowMs < holdEndsAtMs[side];
}
// Ends a hold, e.g. when the side is switched off
export function cancelManualHold(side) {
    holdEndsAtMs[side] = 0;
}
//# sourceMappingURL=manualHold.js.map
//# debugId=1d71cd06-8ca9-5459-972e-18ea81ab76e5
