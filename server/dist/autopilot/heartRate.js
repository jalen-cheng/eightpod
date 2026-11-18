// Heart rate and movement from the bed's piezo sensor, which feels each heartbeat as a small
// knock through the mattress. A Pod 5 publishes it at 500 samples a second, one channel a side.
// The steps follow the cleaning the sleep analysis in `biometrics/` does (clip outliers, keep
// the band a heartbeat lives in), then find the beat's period by self-similarity, which needs
// no peak picking. Checked against that analysis on one sleeper: 65 to 71 beats a minute here
// where it gave 65 to 78.
// Keep this file free of runtime imports so tests can load it without a Pod environment.

!function(){try{var e="undefined"!=typeof window?window:"undefined"!=typeof global?global:"undefined"!=typeof globalThis?globalThis:"undefined"!=typeof self?self:{},n=(new e.Error).stack;n&&(e._sentryDebugIds=e._sentryDebugIds||{},e._sentryDebugIds[n]="4536bb18-cc46-5e11-959c-989e0f2b67f9")}catch(e){}}();
export const PIEZO_SAMPLES_PER_SECOND = 500;
// The signal is averaged down to this rate before filtering; a heartbeat's knock sits well under it
const WORKING_SAMPLES_PER_SECOND = 50;
const DECIMATION = PIEZO_SAMPLES_PER_SECOND / WORKING_SAMPLES_PER_SECOND;
// How much signal one estimate looks at
export const HEART_RATE_WINDOW_SECONDS = 15;
const OUTLIER_LOW_FRACTION = 0.02;
const OUTLIER_HIGH_FRACTION = 0.98;
const MIN_BEATS_PER_MINUTE = 40;
const MAX_BEATS_PER_MINUTE = 110;
// The filter needs a moment to settle; that much of the window's start is left out
const SETTLE_SAMPLES = WORKING_SAMPLES_PER_SECOND;
// The envelope is smoothed over this many samples (a fifth of a second)
const ENVELOPE_SMOOTH_SAMPLES = 10;
// A shorter period is chosen over the best one if it is nearly as good, so a beat is not
// mistaken for every second beat
const SHORTER_PERIOD_FRACTION = 0.85;
// A second-order Butterworth band-pass, 4 to 11 Hz at 50 samples a second, as two sections of
// [b0, b1, b2, a1, a2]. This is the band the knock of a heartbeat shows up in.
const HEARTBEAT_BAND_SECTIONS = [
    [0.11735103672460911, 0.23470207344921823, 0.11735103672460911, -0.4426445671634647, 0.45313623872695685],
    [1, -2, 1, -1.3926563592871113, 0.6502162096231102],
];
// Averages each run of `DECIMATION` samples into one
const decimate = (samples) => {
    const decimated = [];
    for (let start = 0; start + DECIMATION <= samples.length; start += DECIMATION) {
        let sum = 0;
        for (let offset = 0; offset < DECIMATION; offset++)
            sum += samples[start + offset];
        decimated.push(sum / DECIMATION);
    }
    return decimated;
};
// Pulls the few extreme values (a bump, a sensor glitch) in to the edge of the usual range
const clipOutliers = (values) => {
    const sorted = [...values].sort((first, second) => first - second);
    const low = sorted[Math.floor(sorted.length * OUTLIER_LOW_FRACTION)];
    const high = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * OUTLIER_HIGH_FRACTION))];
    return values.map(value => Math.min(high, Math.max(low, value)));
};
// Runs the values through the band-pass sections one after another
const keepHeartbeatBand = (values) => {
    let filtered = values;
    for (const [b0, b1, b2, a1, a2] of HEARTBEAT_BAND_SECTIONS) {
        const output = new Array(filtered.length);
        let input1 = 0, input2 = 0, output1 = 0, output2 = 0;
        for (let index = 0; index < filtered.length; index++) {
            const input = filtered[index];
            const result = b0 * input + b1 * input1 + b2 * input2 - a1 * output1 - a2 * output2;
            input2 = input1;
            input1 = input;
            output2 = output1;
            output1 = result;
            output[index] = result;
        }
        filtered = output;
    }
    return filtered;
};
// The strength of the knocking over time: its size, smoothed, with the average taken out
const takeEnvelope = (values) => {
    const sizes = values.map(Math.abs);
    const half = Math.floor(ENVELOPE_SMOOTH_SAMPLES / 2);
    const smoothed = sizes.map((_size, index) => {
        let sum = 0;
        let count = 0;
        for (let near = Math.max(0, index - half); near < Math.min(sizes.length, index + half); near++) {
            sum += sizes[near];
            count++;
        }
        return sum / count;
    }).slice(SETTLE_SAMPLES);
    const mean = smoothed.reduce((sum, value) => sum + value, 0) / smoothed.length;
    return smoothed.map(value => value - mean);
};
// Estimates the heart rate from a window of piezo samples (use HEART_RATE_WINDOW_SECONDS of them).
// Returns undefined when the window is too short or flat to say anything.
export function estimateHeartRate(samples) {
    if (samples.length < PIEZO_SAMPLES_PER_SECOND * 5)
        return undefined;
    const values = decimate(samples);
    const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
    const envelope = takeEnvelope(keepHeartbeatBand(clipOutliers(values).map(value => value - mean)));
    const energy = envelope.reduce((sum, value) => sum + value * value, 0);
    if (energy === 0)
        return undefined;
    // How alike the envelope is to itself one beat later, for every beat length a heart can have
    const shortestLag = Math.floor(WORKING_SAMPLES_PER_SECOND * 60 / MAX_BEATS_PER_MINUTE);
    const longestLag = Math.ceil(WORKING_SAMPLES_PER_SECOND * 60 / MIN_BEATS_PER_MINUTE);
    const scores = [];
    for (let lag = shortestLag; lag <= longestLag; lag++) {
        let sum = 0;
        for (let index = 0; index + lag < envelope.length; index++)
            sum += envelope[index] * envelope[index + lag];
        scores.push(sum / energy);
    }
    const peaks = scores
        .map((score, index) => ({ score, lag: shortestLag + index }))
        // A true peak has a lower score on both sides. The two ends of the range cannot show that,
        // and a "best" there is the edge of something outside it (shaking, a vibrating alarm).
        .filter((_entry, index) => index > 0 && index < scores.length - 1
        && scores[index] >= scores[index - 1] && scores[index] >= scores[index + 1]);
    if (peaks.length === 0)
        return undefined;
    const bestScore = Math.max(...peaks.map(peak => peak.score));
    const chosen = peaks.find(peak => peak.score >= SHORTER_PERIOD_FRACTION * bestScore);
    if (!chosen || chosen.score <= 0)
        return undefined;
    return { beatsPerMinute: WORKING_SAMPLES_PER_SECOND * 60 / chosen.lag, confidence: Math.min(1, chosen.score) };
}
// The spread between the highest and lowest sample of one second of signal. Lying still it is
// small and steady; turning over makes it many times larger.
export function measureSwing(secondOfSamples) {
    let low = Infinity;
    let high = -Infinity;
    for (let index = 0; index < secondOfSamples.length; index++) {
        if (secondOfSamples[index] < low)
            low = secondOfSamples[index];
        if (secondOfSamples[index] > high)
            high = secondOfSamples[index];
    }
    return high - low;
}
// A second counts as movement when its swing is this many times the usual swing of the last minute
const MOVEMENT_SWING_RATIO = 3;
// How many of the given seconds had movement in them, judged against their own median
export function countMovementSeconds(swings) {
    if (swings.length === 0)
        return 0;
    const sorted = [...swings].sort((first, second) => first - second);
    const usualSwing = sorted[Math.floor(sorted.length / 2)];
    return swings.filter(swing => swing > usualSwing * MOVEMENT_SWING_RATIO).length;
}
//# sourceMappingURL=heartRate.js.map
//# debugId=4536bb18-cc46-5e11-959c-989e0f2b67f9
