// What each firmware level means as a water temperature. Shared by the server and the app, so it
// must not import anything.
//
// The firmware works in levels from -100 to 100. These are the temperatures it reported aiming
// for at each level on a Pod 5 (docs/pod5_temperature_calibration.json): three straight
// stretches, with levels between the points on the straight line between them. Level -100 alone
// is different: it drops to 10°C, "as cold as possible", while -99 is still on the first stretch.

!function(){try{var e="undefined"!=typeof window?window:"undefined"!=typeof global?global:"undefined"!=typeof globalThis?globalThis:"undefined"!=typeof self?self:{},n=(new e.Error).stack;n&&(e._sentryDebugIds=e._sentryDebugIds||{},e._sentryDebugIds[n]="56bb51bc-7e6d-5092-849a-9b9216e72443")}catch(e){}}();
const CURVE_POINTS_C = [
    [-100, 10],
    [-99, 15.12],
    [0, 27],
    [50, 36],
    [100, 42],
];
const celsiusToFahrenheit = (temperatureC) => temperatureC * 9 / 5 + 32;
const CURVE_POINTS_F = CURVE_POINTS_C.map(([level, temperatureC]) => [level, celsiusToFahrenheit(temperatureC)]);
export const MIN_FIRMWARE_LEVEL = -100;
export const MAX_FIRMWARE_LEVEL = 100;
// The coldest and hottest whole °F that can be asked for: 50°F and 108°F
export const MIN_TEMPERATURE_F = Math.round(CURVE_POINTS_F[0][1]);
export const MAX_TEMPERATURE_F = Math.round(CURVE_POINTS_F[CURVE_POINTS_F.length - 1][1]);
// Reads a value off a line drawn through points, holding the end values beyond the ends.
// `fromIndex` and `toIndex` pick which column of each point is the input and which the output.
function interpolate(points, input, fromIndex, toIndex) {
    if (input <= points[0][fromIndex])
        return points[0][toIndex];
    for (let pointIndex = 1; pointIndex < points.length; pointIndex++) {
        const lower = points[pointIndex - 1];
        const upper = points[pointIndex];
        if (input <= upper[fromIndex]) {
            const fraction = (input - lower[fromIndex]) / (upper[fromIndex] - lower[fromIndex]);
            return lower[toIndex] + fraction * (upper[toIndex] - lower[toIndex]);
        }
    }
    return points[points.length - 1][toIndex];
}
// The temperature (°F, not rounded) the firmware aims for at a level
export function levelToTemperatureF(level) {
    return interpolate(CURVE_POINTS_F, level, 0, 1);
}
// The whole firmware level whose temperature is closest to a temperature
export function temperatureFToLevel(temperatureF) {
    // `|| 0` turns -0 into 0
    return Math.round(interpolate(CURVE_POINTS_F, temperatureF, 1, 0)) || 0;
}
// Moves a temperature by some °F (negative: cooler), within a range, and makes sure the firmware
// level moves with it. On most of the curve a degree is several levels. But the coldest level
// sits 9°F below the next one, so a 1°F step from either side of that gap would land back on the
// level it started from and the bed would never move; such a step goes one level instead.
export function stepTemperatureF(temperatureF, deltaF, minTemperatureF, maxTemperatureF) {
    const clamp = (value) => Math.min(maxTemperatureF, Math.max(minTemperatureF, value));
    const steppedF = clamp(temperatureF + deltaF);
    const currentLevel = temperatureFToLevel(temperatureF);
    if (deltaF === 0 || temperatureFToLevel(steppedF) !== currentLevel)
        return steppedF;
    // Walk level by level until the whole degree it rounds to is a different level: near the cold
    // end several levels share one whole degree, so the next level alone can round back here
    const direction = Math.sign(deltaF);
    for (let level = currentLevel + direction; level >= MIN_FIRMWARE_LEVEL && level <= MAX_FIRMWARE_LEVEL; level += direction) {
        const candidateF = clamp(Math.round(levelToTemperatureF(level)));
        if (temperatureFToLevel(candidateF) !== currentLevel)
            return candidateF;
    }
    // Already at the coldest or hottest level
    return steppedF;
}
// Eight Sleep's dial runs from -10 to +10; one dial level is ten firmware levels
export const FIRMWARE_LEVELS_PER_DIAL_LEVEL = 10;
const MAX_DIAL_LEVEL = MAX_FIRMWARE_LEVEL / FIRMWARE_LEVELS_PER_DIAL_LEVEL;
// A dial level is about this many °F. Used only to turn a step saved in °F into a number of levels.
const DEGREES_F_PER_DIAL_LEVEL = 2.75;
// A step saved in °F as a whole number of dial levels, at least one
export const stepFToDialLevels = (stepF) => Math.max(1, Math.round(Math.abs(stepF) / DEGREES_F_PER_DIAL_LEVEL));
// The whole °F each dial level stands for, coldest first
const DIAL_LEVEL_TEMPERATURES_F = Array.from({ length: 2 * MAX_DIAL_LEVEL + 1 }, (_unused, index) => Math.round(levelToTemperatureF((index - MAX_DIAL_LEVEL) * FIRMWARE_LEVELS_PER_DIAL_LEVEL)));
// Moves a temperature by whole dial levels (negative: cooler) and returns the whole °F of the
// level it lands on. A temperature between two levels goes to the next level in that direction
// first, so one step is never more than one level.
export function stepDialLevels(temperatureF, levels, minTemperatureF, maxTemperatureF) {
    if (levels === 0)
        return temperatureF;
    const lastIndex = DIAL_LEVEL_TEMPERATURES_F.length - 1;
    let steppedIndex;
    if (levels > 0) {
        const firstWarmer = DIAL_LEVEL_TEMPERATURES_F.findIndex(levelF => levelF > temperatureF);
        steppedIndex = firstWarmer === -1 ? lastIndex : Math.min(lastIndex, firstWarmer + levels - 1);
    }
    else {
        // The count of levels cooler than this is one past the index of the nearest of them
        const coolerCount = DIAL_LEVEL_TEMPERATURES_F.filter(levelF => levelF < temperatureF).length;
        steppedIndex = Math.max(0, coolerCount + levels);
    }
    return Math.min(maxTemperatureF, Math.max(minTemperatureF, DIAL_LEVEL_TEMPERATURES_F[steppedIndex]));
}
// Before the curve was measured, levels were spread evenly over 55-110°F. Converts a whole °F
// saved under that assumption to the whole °F that means the same level now, so a saved schedule
// keeps setting the bed exactly as it did.
const EVEN_SPREAD_NEUTRAL_F = 82.5;
const EVEN_SPREAD_F_PER_LEVEL = 27.5 / 100;
export function convertFromEvenSpreadF(temperatureF) {
    const level = Math.round((temperatureF - EVEN_SPREAD_NEUTRAL_F) / EVEN_SPREAD_F_PER_LEVEL);
    const clampedLevel = Math.min(MAX_FIRMWARE_LEVEL, Math.max(MIN_FIRMWARE_LEVEL, level));
    return Math.round(levelToTemperatureF(clampedLevel));
}
//# sourceMappingURL=temperatureCurve.js.map
//# debugId=56bb51bc-7e6d-5092-849a-9b9216e72443
