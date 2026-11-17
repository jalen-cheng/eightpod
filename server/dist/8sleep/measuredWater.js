// The firmware reports hundredths of a degree Celsius

!function(){try{var e="undefined"!=typeof window?window:"undefined"!=typeof global?global:"undefined"!=typeof globalThis?globalThis:"undefined"!=typeof self?self:{},n=(new e.Error).stack;n&&(e._sentryDebugIds=e._sentryDebugIds||{},e._sentryDebugIds[n]="3feb295b-4b1c-550f-81d2-f4b56a74c855")}catch(e){}}();
const REPORTED_UNITS_PER_DEGREE_C = 100;
// A reading older than this is not shown as current
const STALE_READING_MS = 60_000;
const latestReadings = {};
export const reportedWaterToF = (reportedValue) => (reportedValue / REPORTED_UNITS_PER_DEGREE_C) * 9 / 5 + 32;
// Stores one side's reading as it arrives (in the firmware's units)
export function recordWaterReading(side, reportedValue, nowMs = Date.now()) {
    latestReadings[side] = { temperatureF: reportedWaterToF(reportedValue), receivedAtMs: nowMs };
}
// A side's measured water temperature in °F to one decimal, or undefined when there is no
// recent reading (for example on a Pod whose firmware does not report it)
export function getMeasuredWaterF(side, nowMs = Date.now()) {
    const reading = latestReadings[side];
    if (!reading || nowMs - reading.receivedAtMs > STALE_READING_MS)
        return undefined;
    return Math.round(reading.temperatureF * 10) / 10;
}
//# sourceMappingURL=measuredWater.js.map
//# debugId=3feb295b-4b1c-550f-81d2-f4b56a74c855
