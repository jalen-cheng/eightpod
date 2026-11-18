// Follows one sleeper through a stay in bed, a minute at a time, and says whether they are
// awake or asleep. It goes by stillness, the way a wrist tracker's movement sensor does: asleep
// after lying still long enough, awake again after a run of restless minutes. Steady breathing
// can be asked for as well, but only once calibration against a worn tracker has shown it
// helps. The heart rate is carried along for showing, and decides nothing. It does not try to tell deep sleep
// from the rest: the night plan assumes deep sleep by the clock instead.
// Keep this file free of runtime imports so tests can load it without a Pod environment.

!function(){try{var e="undefined"!=typeof window?window:"undefined"!=typeof global?global:"undefined"!=typeof globalThis?globalThis:"undefined"!=typeof self?self:{},n=(new e.Error).stack;n&&(e._sentryDebugIds=e._sentryDebugIds||{},e._sentryDebugIds[n]="3c431125-f36c-5d6a-a4f3-c11840293e40")}catch(e){}}();
export const DEFAULT_SLEEP_RULES = { stillMinutesToSleep: 15, restlessSecondsToWake: 12 };
// A minute with this many moving seconds or fewer counts as lying still
const STILL_MINUTE_MAX_MOVEMENT_SECONDS = 3;
// Awake again: this many restless minutes among the last five. One turn in bed is not waking.
const AWAKE_RESTLESS_MINUTES = 3;
const RECENT_MINUTES = 5;
const median = (values) => {
    if (values.length === 0)
        return undefined;
    const sorted = [...values].sort((first, second) => first - second);
    return sorted[Math.floor(sorted.length / 2)];
};
// Creates a tracker for one side of the bed. Call `addMinute` once a minute. `getRules` is read
// every minute, so rules changed by calibration apply at once.
export function createSleepTracker(getRules = () => DEFAULT_SLEEP_RULES) {
    let minutes = [];
    let asleepSinceMinute;
    const reset = () => {
        minutes = [];
        asleepSinceMinute = undefined;
    };
    const lastMinutes = (count) => minutes.slice(-count);
    const addMinute = (minute) => {
        if (!minute.isInBed) {
            reset();
            return { stage: 'out', minutesInBed: 0 };
        }
        minutes.push(minute);
        const rules = getRules();
        const minutesInBed = minutes.length;
        const recentMiddle = (read) => median(lastMinutes(RECENT_MINUTES).flatMap((recent) => {
            const value = read(recent);
            return value === undefined ? [] : [value];
        }));
        const heartRate = recentMiddle(recent => recent.heartRate);
        const breathingRate = recentMiddle(recent => recent.breathingRate);
        if (asleepSinceMinute === undefined) {
            const stillStretch = lastMinutes(rules.stillMinutesToSleep);
            const hasLainStill = minutesInBed >= rules.stillMinutesToSleep
                && stillStretch.every(recent => recent.movementSeconds <= STILL_MINUTE_MAX_MOVEMENT_SECONDS);
            // With too few breathing readings in the stretch to judge by, stillness alone decides
            const spreads = stillStretch.flatMap(recent => (recent.breathingSpread === undefined ? [] : [recent.breathingSpread]));
            const isBreathingSteady = rules.maxBreathingSpread === undefined || spreads.length < stillStretch.length / 2
                || (median(spreads) ?? 0) <= rules.maxBreathingSpread;
            // Sleep began when the stillness did, not when it had lasted long enough to be believed
            if (hasLainStill && isBreathingSteady)
                asleepSinceMinute = minutesInBed - rules.stillMinutesToSleep;
        }
        else {
            const restlessMinutes = lastMinutes(RECENT_MINUTES)
                .filter(recent => recent.movementSeconds >= rules.restlessSecondsToWake).length;
            if (restlessMinutes >= AWAKE_RESTLESS_MINUTES)
                asleepSinceMinute = undefined;
        }
        if (asleepSinceMinute === undefined)
            return { stage: 'awake', minutesInBed, heartRate, breathingRate };
        return { stage: 'asleep', minutesInBed, minutesAsleep: minutesInBed - asleepSinceMinute, heartRate, breathingRate };
    };
    return { addMinute, reset };
}
// Fewer nights than this and the rules are left alone: one odd night should not set them
export const MIN_NIGHTS_TO_CALIBRATE = 3;
const STILL_MINUTES_CANDIDATES = [5, 8, 10, 15, 20, 30];
const RESTLESS_SECONDS_CANDIDATES = [8, 12, 20, 30];
// Breathing is tried last and has to beat stillness alone to be used
const BREATHING_SPREAD_CANDIDATES = [undefined, 2, 4];
// When the bed's rules would have called the sleeper asleep and awake over a saved stay, in
// minutes from its first row. The longest sleep counts, so a doze before the real one does not.
export function detectSleepTimes(minutes, rules) {
    const tracker = createSleepTracker(() => rules);
    let longest;
    let current;
    minutes.forEach((minute, index) => {
        const state = tracker.addMinute(minute);
        if (state.stage === 'asleep') {
            current ??= { asleepAtMinute: index + 1 - (state.minutesAsleep ?? 0), awakeAtMinute: index + 1 };
            current.awakeAtMinute = index + 1;
            if (!longest || current.awakeAtMinute - current.asleepAtMinute > longest.awakeAtMinute - longest.asleepAtMinute)
                longest = current;
        }
        else {
            current = undefined;
        }
    });
    return longest ?? {};
}
const average = (values) => values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
// How far a set of rules lands from the worn tracker over some nights. A night where the rules
// see no sleep at all counts as wrong by the whole length of the tracker's sleep.
export function measureRules(nights, rules) {
    const onsetErrors = [];
    const wakeErrors = [];
    for (const night of nights) {
        const detected = detectSleepTimes(night.minutes, rules);
        const missedBy = night.trackerAwakeAtMinute - night.trackerAsleepAtMinute;
        onsetErrors.push(detected.asleepAtMinute === undefined ? missedBy : Math.abs(detected.asleepAtMinute - night.trackerAsleepAtMinute));
        wakeErrors.push(detected.awakeAtMinute === undefined ? missedBy : Math.abs(detected.awakeAtMinute - night.trackerAwakeAtMinute));
    }
    return {
        rules, nights: nights.length, onsetErrorMinutes: Math.round(average(onsetErrors)), wakeErrorMinutes: Math.round(average(wakeErrors)),
    };
}
// The rules that fit these nights best. With too few nights the default rules are kept and only
// measured. The default is tried first and has to be beaten, so a tie changes nothing.
export function calibrateSleepRules(nights) {
    let best = measureRules(nights, DEFAULT_SLEEP_RULES);
    if (nights.length < MIN_NIGHTS_TO_CALIBRATE)
        return best;
    for (const stillMinutesToSleep of STILL_MINUTES_CANDIDATES) {
        for (const restlessSecondsToWake of RESTLESS_SECONDS_CANDIDATES) {
            for (const maxBreathingSpread of BREATHING_SPREAD_CANDIDATES) {
                const candidate = measureRules(nights, { stillMinutesToSleep, restlessSecondsToWake, maxBreathingSpread });
                if (candidate.onsetErrorMinutes + candidate.wakeErrorMinutes < best.onsetErrorMinutes + best.wakeErrorMinutes)
                    best = candidate;
            }
        }
    }
    return best;
}
// Health apps record a night as many short samples, some of them "awake" or "in bed"
const NOT_ASLEEP = /awake|in ?bed/i;
// Samples closer together than this are one sleep; further apart, a night and a nap
const SAME_SLEEP_GAP_MS = 60 * 60_000;
const SHORTEST_SLEEP_MS = 15 * 60_000;
// Joins a tracker's sleep samples into whole sleeps, oldest first
export function findSleepPeriods(samples) {
    const asleep = samples
        .filter(sample => sample.endMs > sample.startMs && !NOT_ASLEEP.test(sample.value ?? ''))
        .sort((first, second) => first.startMs - second.startMs);
    const periods = [];
    for (const sample of asleep) {
        const last = periods[periods.length - 1];
        if (last && sample.startMs - last.awakeAtMs <= SAME_SLEEP_GAP_MS)
            last.awakeAtMs = Math.max(last.awakeAtMs, sample.endMs);
        else
            periods.push({ asleepAtMs: sample.startMs, awakeAtMs: sample.endMs });
    }
    return periods.filter(period => period.awakeAtMs - period.asleepAtMs >= SHORTEST_SLEEP_MS);
}
// The iPhone app Health Auto Export can post Apple Health data on its own schedule. Its sleep
// rows come either one a night (`sleepStart`, `sleepEnd`) or as the health app's own samples
// (`start`/`startDate`, `end`/`endDate`, `value`), with dates like "2024-02-06 14:30:00 -0800".
// Written from the app's documentation; not yet run against the app.
const EXPORT_DATE = /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2}) ([+-]\d{2}):?(\d{2})$/;
const parseExportDate = (text) => {
    if (typeof text !== 'string')
        return undefined;
    const parts = EXPORT_DATE.exec(text.trim());
    const timeMs = Date.parse(parts ? `${parts[1]}T${parts[2]}${parts[3]}:${parts[4]}` : text);
    return Number.isNaN(timeMs) ? undefined : timeMs;
};
// The sleep samples in a Health Auto Export body, or undefined when it is not one
export function readHealthExportSleep(body) {
    const metrics = body?.data?.metrics;
    if (!Array.isArray(metrics))
        return undefined;
    const rows = metrics.filter(metric => metric.name === 'sleep_analysis').flatMap(metric => metric.data ?? []);
    return rows.flatMap((row) => {
        const startMs = parseExportDate(row.sleepStart ?? row.start ?? row.startDate);
        const endMs = parseExportDate(row.sleepEnd ?? row.end ?? row.endDate);
        if (startMs === undefined || endMs === undefined)
            return [];
        return [{ startMs, endMs, value: typeof row.value === 'string' ? row.value : undefined }];
    });
}
//# sourceMappingURL=sleepTracker.js.map
//# debugId=3c431125-f36c-5d6a-a4f3-c11840293e40
