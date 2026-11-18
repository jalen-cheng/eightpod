// Reads a breathing rate from the piezo sensor under one side of the bed. Each breath lifts and
// lowers the chest, which the sensor feels as a slow swell far larger than a heartbeat, so the
// rate is read from how the slow part of the signal repeats. One sensor sample is a 32-bit
// number; there are 500 a second.
// Keep this file free of runtime imports so tests can load it without a Pod environment.

!function(){try{var e="undefined"!=typeof window?window:"undefined"!=typeof global?global:"undefined"!=typeof globalThis?globalThis:"undefined"!=typeof self?self:{},n=(new e.Error).stack;n&&(e._sentryDebugIds=e._sentryDebugIds||{},e._sentryDebugIds[n]="2a4e6922-2e01-5ac0-9646-85d60169cee1")}catch(e){}}();
export const BREATHING_SAMPLES_PER_SECOND = 500;
// Long enough for five breaths at the slowest rate looked for
export const BREATHING_WINDOW_SECONDS = 30;
// The signal is averaged down to this rate first: breathing is far slower than a heartbeat
const WORKING_SAMPLES_PER_SECOND = 10;
// The rates looked for, in breaths a minute. A sleeping adult is at 10 to 20.
const SLOWEST_BREATHS_PER_MINUTE = 8;
const FASTEST_BREATHS_PER_MINUTE = 30;
// Drift slower than a breath is taken out by subtracting the average over this long
const DRIFT_WINDOW_SECONDS = 6;
// Heartbeats and noise are taken out by averaging over this long
const SMOOTHING_WINDOW_SECONDS = 1;
// Samples beyond these percentiles are pulled in, so a twitch does not drown the breathing
const CLIP_LOW_PERCENTILE = 2;
const CLIP_HIGH_PERCENTILE = 98;
// The average of each run of `size` values
const averageBlocks = (values, size) => {
    const blocks = [];
    for (let start = 0; start + size <= values.length; start += size) {
        let sum = 0;
        for (let index = start; index < start + size; index++)
            sum += values[index];
        blocks.push(sum / size);
    }
    return blocks;
};
// Each value replaced by the average of the `width` values centred on it (fewer at the ends)
const movingAverage = (values, width) => {
    const half = Math.floor(width / 2);
    return values.map((_value, index) => {
        const from = Math.max(0, index - half);
        const until = Math.min(values.length, index + half + 1);
        let sum = 0;
        for (let position = from; position < until; position++)
            sum += values[position];
        return sum / (until - from);
    });
};
const clipToPercentiles = (values) => {
    const sorted = [...values].sort((first, second) => first - second);
    const low = sorted[Math.floor(sorted.length * CLIP_LOW_PERCENTILE / 100)];
    const high = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * CLIP_HIGH_PERCENTILE / 100))];
    return values.map(value => Math.min(high, Math.max(low, value)));
};
// How alike the signal is to itself shifted by `lag` samples, from -1 to 1
const selfSimilarity = (values, lag) => {
    let product = 0;
    let firstPower = 0;
    let secondPower = 0;
    for (let index = 0; index + lag < values.length; index++) {
        product += values[index] * values[index + lag];
        firstPower += values[index] ** 2;
        secondPower += values[index + lag] ** 2;
    }
    const scale = Math.sqrt(firstPower * secondPower);
    return scale === 0 ? 0 : product / scale;
};
// The breathing rate in a window of raw piezo samples, or undefined when there is too little
// signal to say. The slow part of the signal is kept (drift out, heartbeats out), and the rate
// is the shift at which that slow part best matches itself.
export function estimateBreathingRate(samples) {
    const blockSize = BREATHING_SAMPLES_PER_SECOND / WORKING_SAMPLES_PER_SECOND;
    const slow = clipToPercentiles(averageBlocks(samples, blockSize));
    if (slow.length < WORKING_SAMPLES_PER_SECOND * BREATHING_WINDOW_SECONDS * 0.9)
        return undefined;
    const drift = movingAverage(slow, DRIFT_WINDOW_SECONDS * WORKING_SAMPLES_PER_SECOND);
    const breathing = movingAverage(slow.map((value, index) => value - drift[index]), SMOOTHING_WINDOW_SECONDS * WORKING_SAMPLES_PER_SECOND);
    const shortestLag = Math.floor(60 / FASTEST_BREATHS_PER_MINUTE * WORKING_SAMPLES_PER_SECOND);
    const longestLag = Math.ceil(60 / SLOWEST_BREATHS_PER_MINUTE * WORKING_SAMPLES_PER_SECOND);
    const similarities = [];
    for (let lag = shortestLag - 1; lag <= longestLag + 1; lag++)
        similarities.push(selfSimilarity(breathing, lag));
    // The first clear peak is one breath; later peaks are two and three breaths
    let bestLag;
    let bestSimilarity = 0;
    for (let position = 1; position < similarities.length - 1; position++) {
        const isPeak = similarities[position] > similarities[position - 1] && similarities[position] >= similarities[position + 1];
        if (!isPeak || similarities[position] <= bestSimilarity)
            continue;
        // A later peak has to be clearly better to be preferred over the first: it is likely a multiple
        if (bestLag !== undefined && similarities[position] < bestSimilarity * 1.15)
            continue;
        bestLag = shortestLag - 1 + position;
        bestSimilarity = similarities[position];
    }
    if (bestLag === undefined || bestSimilarity <= 0)
        return undefined;
    return { breathsPerMinute: 60 * WORKING_SAMPLES_PER_SECOND / bestLag, confidence: bestSimilarity };
}
// How much a minute's breathing-rate readings differ, in breaths a minute. Breathing in sleep
// is steadier than awake, so a small spread is a cue for sleep. Undefined with too few readings.
export function measureBreathingSpread(ratesInMinute) {
    if (ratesInMinute.length < 3)
        return undefined;
    return Math.max(...ratesInMinute) - Math.min(...ratesInMinute);
}
//# sourceMappingURL=breathingRate.js.map
//# debugId=2a4e6922-2e01-5ac0-9646-85d60169cee1
