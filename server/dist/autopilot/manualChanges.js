
!function(){try{var e="undefined"!=typeof window?window:"undefined"!=typeof global?global:"undefined"!=typeof globalThis?globalThis:"undefined"!=typeof self?self:{},n=(new e.Error).stack;n&&(e._sentryDebugIds=e._sentryDebugIds||{},e._sentryDebugIds[n]="6966b032-874d-5ebb-967c-42816fded2be")}catch(e){}}();
let registeredListener;
export function registerManualChangeListener(listener) {
    registeredListener = listener;
}
// Call when a person, not the schedule or the autopilot, set a side's temperature
export function noteManualTemperature(side, temperatureF) {
    registeredListener?.(side, temperatureF);
}
//# sourceMappingURL=manualChanges.js.map
//# debugId=6966b032-874d-5ebb-967c-42816fded2be
