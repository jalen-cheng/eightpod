
!function(){try{var e="undefined"!=typeof window?window:"undefined"!=typeof global?global:"undefined"!=typeof globalThis?globalThis:"undefined"!=typeof self?self:{},n=(new e.Error).stack;n&&(e._sentryDebugIds=e._sentryDebugIds||{},e._sentryDebugIds[n]="9b4e6760-f9ed-5ee8-a0c8-f3ad51073c99")}catch(e){}}();
let registeredListener;
export function registerManualChangeListener(listener) {
    registeredListener = listener;
}
// Call when a person, not the schedule or the autopilot, set a side's temperature.
// `isPersonsOwn` is false when a rule they set up did it for them (being in bed turns the bed
// on): that temperature stands like any other, but says nothing new about their taste.
export function noteManualTemperature(side, temperatureF, isPersonsOwn = true) {
    registeredListener?.(side, temperatureF, isPersonsOwn);
}
//# sourceMappingURL=manualChanges.js.map
//# debugId=9b4e6760-f9ed-5ee8-a0c8-f3ad51073c99
