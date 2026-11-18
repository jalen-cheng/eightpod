// Follows one sleeper through a stay in bed, a minute at a time, and says whether they are
// awake, asleep or in deep sleep. It is a set of plain rules over heart rate and stillness, not
// a sleep-stage classifier: studies put heart-rate-only staging at moderate agreement with a
// sleep lab, and deep sleep is the hardest stage to tell. So "deep" here means "the heart is at
// its slowest and steadiest of the night and the body is still", which is a cue, not a diagnosis.
// Keep this file free of runtime imports so tests can load it without a Pod environment.
// A minute with this many moving seconds or fewer counts as lying still

!function(){try{var e="undefined"!=typeof window?window:"undefined"!=typeof global?global:"undefined"!=typeof globalThis?globalThis:"undefined"!=typeof self?self:{},n=(new e.Error).stack;n&&(e._sentryDebugIds=e._sentryDebugIds||{},e._sentryDebugIds[n]="5a74d4b4-4803-54ee-aa1f-27e80be7020c")}catch(e){}}();
const STILL_MINUTE_MAX_MOVEMENT_SECONDS = 3;
// A minute with this many or more counts as awake and moving
const RESTLESS_MINUTE_MIN_MOVEMENT_SECONDS = 12;
// Settling: the first minutes in bed set the heart rate that "asleep" is measured against
const SETTLING_MINUTES = 10;
// Asleep: still for this long, and the heart at least this much slower than while settling
const ASLEEP_STILL_MINUTES = 10;
const ASLEEP_HEART_RATE_DROP = 3;
// With no heart rate to go on, stillness alone has to last longer
const ASLEEP_STILL_MINUTES_WITHOUT_HEART_RATE = 20;
// Awake again: this many restless minutes among the last five
const AWAKE_RESTLESS_MINUTES = 3;
const RECENT_MINUTES = 5;
// Deep: asleep this long, nearly motionless, the heart a tenth slower than while settling, and
// steady to within a few beats over the last five minutes
const DEEP_MIN_MINUTES_ASLEEP = 15;
const DEEP_STILL_MINUTES = 10;
const DEEP_MAX_MOVEMENT_SECONDS = 1;
const DEEP_HEART_RATE_FRACTION = 0.9;
const DEEP_HEART_RATE_SPREAD = 4;
const median = (values) => {
    if (values.length === 0)
        return undefined;
    const sorted = [...values].sort((first, second) => first - second);
    return sorted[Math.floor(sorted.length / 2)];
};
// Creates a tracker for one side of the bed. Call `addMinute` once a minute.
export function createSleepTracker() {
    let minutes = [];
    let asleepSinceMinute;
    const reset = () => {
        minutes = [];
        asleepSinceMinute = undefined;
    };
    const lastMinutes = (count) => minutes.slice(-count);
    const heartRatesOf = (summaries) => summaries.flatMap(minute => (minute.heartRate === undefined ? [] : [minute.heartRate]));
    const addMinute = (minute) => {
        if (!minute.isInBed) {
            reset();
            return { stage: 'out', minutesInBed: 0 };
        }
        minutes.push(minute);
        const minutesInBed = minutes.length;
        const settlingHeartRate = median(heartRatesOf(minutes.slice(1, SETTLING_MINUTES + 1)));
        const recentHeartRate = median(heartRatesOf(lastMinutes(RECENT_MINUTES)));
        const isStillFor = (count, maxMovement) => minutesInBed >= count
            && lastMinutes(count).every(recent => recent.movementSeconds <= maxMovement);
        if (asleepSinceMinute === undefined) {
            const hasHeartSlowed = settlingHeartRate !== undefined && recentHeartRate !== undefined
                && recentHeartRate <= settlingHeartRate - ASLEEP_HEART_RATE_DROP;
            const isAsleep = minutesInBed > SETTLING_MINUTES && ((hasHeartSlowed && isStillFor(ASLEEP_STILL_MINUTES, STILL_MINUTE_MAX_MOVEMENT_SECONDS))
                || isStillFor(ASLEEP_STILL_MINUTES_WITHOUT_HEART_RATE, STILL_MINUTE_MAX_MOVEMENT_SECONDS));
            if (isAsleep)
                asleepSinceMinute = minutesInBed;
        }
        else {
            const restlessMinutes = lastMinutes(RECENT_MINUTES)
                .filter(recent => recent.movementSeconds >= RESTLESS_MINUTE_MIN_MOVEMENT_SECONDS).length;
            if (restlessMinutes >= AWAKE_RESTLESS_MINUTES)
                asleepSinceMinute = undefined;
        }
        if (asleepSinceMinute === undefined) {
            return { stage: 'awake', minutesInBed, settlingHeartRate, heartRate: recentHeartRate };
        }
        const minutesAsleep = minutesInBed - asleepSinceMinute;
        const recentRates = heartRatesOf(lastMinutes(RECENT_MINUTES));
        const isHeartSlowAndSteady = settlingHeartRate !== undefined && recentHeartRate !== undefined
            && recentRates.length >= RECENT_MINUTES - 1
            && recentHeartRate <= settlingHeartRate * DEEP_HEART_RATE_FRACTION
            && Math.max(...recentRates) - Math.min(...recentRates) <= DEEP_HEART_RATE_SPREAD;
        const isDeep = minutesAsleep >= DEEP_MIN_MINUTES_ASLEEP && isHeartSlowAndSteady && isStillFor(DEEP_STILL_MINUTES, DEEP_MAX_MOVEMENT_SECONDS);
        return { stage: isDeep ? 'deep' : 'asleep', minutesInBed, minutesAsleep, settlingHeartRate, heartRate: recentHeartRate };
    };
    return { addMinute, reset };
}
//# sourceMappingURL=sleepTracker.js.map
//# debugId=5a74d4b4-4803-54ee-aa1f-27e80be7020c
