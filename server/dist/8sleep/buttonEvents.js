
!function(){try{var e="undefined"!=typeof window?window:"undefined"!=typeof global?global:"undefined"!=typeof globalThis?globalThis:"undefined"!=typeof self?self:{},n=(new e.Error).stack;n&&(e._sentryDebugIds=e._sentryDebugIds||{},e._sentryDebugIds[n]="a04f8123-03a5-543d-a634-b49b16e29c17")}catch(e){}}();
const PRESS_PATTERN = /\[TTC\] processing \[button\] side (left|right) \{ button: (top|bottom|middle)\b(?:.*?\bcount: (\d+))?/;
// Reported on its own line, without a side, once per press, before the line for the whole run
const MIDDLE_HELD_PATTERN = /\[buttons\] middle button held for (\d+)ms/;
// A hold duration older than this belongs to some earlier press
const HELD_LINE_MAX_AGE_MS = 4_000;
// Holding the middle button at least this long switches the side on or off
export const POWER_HOLD_MS = 1_000;
// Each button uses the settings of the tap gesture that does the same job on a Pod 4:
// "-" cools like a double tap, "+" warms like a triple tap, the middle button is the quadruple tap.
export const BUTTON_GESTURES = {
    bottom: 'doubleTap',
    top: 'tripleTap',
    middle: 'quadTap',
};
// Returns a function that is fed the firmware log one line at a time and returns a press when a
// line completes one. It keeps the longest recent "held for" duration to attach to the next
// middle press.
export function createButtonLineParser(getNowMs = Date.now) {
    let longestHeldMs;
    let lastHeldAtMs = 0;
    return (line) => {
        const heldMatch = MIDDLE_HELD_PATTERN.exec(line);
        if (heldMatch) {
            const isRunStale = getNowMs() - lastHeldAtMs > HELD_LINE_MAX_AGE_MS;
            const heldMs = Number(heldMatch[1]);
            longestHeldMs = isRunStale || longestHeldMs === undefined ? heldMs : Math.max(longestHeldMs, heldMs);
            lastHeldAtMs = getNowMs();
            return null;
        }
        const pressMatch = PRESS_PATTERN.exec(line);
        if (!pressMatch)
            return null;
        const press = {
            side: pressMatch[1],
            button: pressMatch[2],
            count: Math.max(1, Number(pressMatch[3] ?? 1)),
        };
        if (press.button === 'middle') {
            const isHeldFresh = longestHeldMs !== undefined && getNowMs() - lastHeldAtMs <= HELD_LINE_MAX_AGE_MS;
            if (isHeldFresh)
                press.heldMs = longestHeldMs;
            longestHeldMs = undefined;
        }
        return press;
    };
}
// True for a middle press held long enough to mean "switch this side on or off"
export function isPowerHold(press) {
    return press.button === 'middle' && (press.heldMs ?? 0) >= POWER_HOLD_MS;
}
// True when the presses include a short press of + or -. On a side that is off, that press
// switches the side on instead of changing a temperature nobody can feel.
export function hasTemperaturePress(presses) {
    return presses.some(press => press.button !== 'middle' && !isPowerHold(press));
}
// Counts one side's presses per gesture, in the shape the tap gesture code already works with.
// Power holds are left out; the caller handles those separately.
// - While an alarm is vibrating, any press only deals with the alarm: it must not also change
//   the temperature. (The firmware stops the vibration itself on any press.)
// - With no alarm, a short middle press does nothing. Power is the long hold, so a brush of the
//   middle button cannot switch the bed off.
export function countPressesAsGestures(presses, isAlarmVibrating) {
    const shortPresses = presses.filter(press => !isPowerHold(press));
    if (shortPresses.length === 0)
        return {};
    if (isAlarmVibrating)
        return { [BUTTON_GESTURES.middle]: 1 };
    const gestureCounts = {};
    for (const press of shortPresses) {
        if (press.button === 'middle')
            continue;
        const gesture = BUTTON_GESTURES[press.button];
        gestureCounts[gesture] = (gestureCounts[gesture] ?? 0) + press.count;
    }
    return gestureCounts;
}
//# sourceMappingURL=buttonEvents.js.map
//# debugId=a04f8123-03a5-543d-a634-b49b16e29c17
