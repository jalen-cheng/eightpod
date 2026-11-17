// Decides whether someone is on a side of the bed from its capacitive sensors.
// Keep this file free of runtime imports so tests can load it without a Pod environment.
//
// The firmware reports three zones per side twice a second. The numbers rise when a body is on
// the bed. There is no fixed "empty" value: it differs per Pod and drifts, so the detector
// learns it as a baseline and looks for a rise above that.
// How far above the empty baseline the three zones together must rise to count as someone in
// bed. An empty bed was seen to wobble by about 100; nobody has been measured in the bed yet,
// so these are starting points to be adjusted from real readings.

!function(){try{var e="undefined"!=typeof window?window:"undefined"!=typeof global?global:"undefined"!=typeof globalThis?globalThis:"undefined"!=typeof self?self:{},n=(new e.Error).stack;n&&(e._sentryDebugIds=e._sentryDebugIds||{},e._sentryDebugIds[n]="6e8672b3-7ff7-5cd2-8ed1-16ca6b3e0330")}catch(e){}}();
export const PRESENCE_DELTAS = { low: 300, medium: 150, high: 80 };
// Readings are noisy one by one, so the middle of the last few is used (5 seconds' worth)
const SMOOTHING_SAMPLES = 10;
// A rise must last this long to count as getting in, so leaning or sitting on the bed for a
// moment does not
const ENTER_HOLD_MS = 30_000;
// A drop must last this long to count as getting out, so turning over does not
const LEAVE_HOLD_MS = 60_000;
// Once in bed, the signal may fall to this fraction of the rise before it counts as a drop
const LEAVE_FRACTION = 0.6;
// Below this fraction of the rise the bed is taken as empty and the baseline follows the signal
const EMPTY_FRACTION = 0.5;
// How much of the gap the baseline closes per reading while empty (a few minutes to catch up)
const BASELINE_DRIFT_RATE = 0.002;
const median = (values) => {
    const sorted = [...values].sort((first, second) => first - second);
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
};
// Creates the detector for one side. Feed it every reading with the time it arrived.
export function createPresenceDetector() {
    const recentSignals = [];
    let baseline;
    let present = false;
    // When the signal first disagreed with `present`; cleared when it agrees again
    let disagreeingSinceMs;
    const update = (reading, nowMs, presenceDelta) => {
        recentSignals.push(reading.out + reading.cen + reading.in);
        if (recentSignals.length > SMOOTHING_SAMPLES)
            recentSignals.shift();
        const signal = median(recentSignals);
        // The baseline drops at once (a lower reading can only be an emptier bed) and creeps up
        // slowly, and only while the bed looks empty, so a sleeper is never learned as "empty".
        // If the server starts with someone already in bed, it corrects itself when they get out.
        if (baseline === undefined || signal < baseline)
            baseline = signal;
        else if (signal - baseline < presenceDelta * EMPTY_FRACTION)
            baseline += (signal - baseline) * BASELINE_DRIFT_RATE;
        const rise = signal - baseline;
        const looksPresent = present ? rise > presenceDelta * LEAVE_FRACTION : rise > presenceDelta;
        if (looksPresent === present) {
            disagreeingSinceMs = undefined;
        }
        else {
            disagreeingSinceMs ??= nowMs;
            if (nowMs - disagreeingSinceMs >= (present ? LEAVE_HOLD_MS : ENTER_HOLD_MS)) {
                present = looksPresent;
                disagreeingSinceMs = undefined;
            }
        }
        return { present, signal, baseline };
    };
    return { update };
}
//# sourceMappingURL=presenceDetector.js.map
//# debugId=6e8672b3-7ff7-5cd2-8ed1-16ca6b3e0330
