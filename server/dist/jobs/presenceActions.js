// Getting up for a few minutes does not end a night in bed; being out this long does

!function(){try{var e="undefined"!=typeof window?window:"undefined"!=typeof global?global:"undefined"!=typeof globalThis?globalThis:"undefined"!=typeof self?self:{},n=(new e.Error).stack;n&&(e._sentryDebugIds=e._sentryDebugIds||{},e._sentryDebugIds[n]="3d17e496-e682-5231-8790-f0bddbc55b48")}catch(e){}}();
export const SESSION_GAP_MS = 15 * 60_000;
// "Getting into bed in the evening" runs from the chosen time until this time the next morning
export const TURN_ON_WINDOW_END = '06:00';
const MS_PER_HOUR = 3_600_000;
export const createBedSession = () => ({ hasWoken: false, hasTurnedOn: false });
// Updates a stay with the latest detection. A stay starts when someone is detected and ends
// once nobody has been for SESSION_GAP_MS. Changes the session in place and returns it.
export function trackBedSession(session, present, nowMs) {
    if (present) {
        session.inBedSinceMs ??= nowMs;
        session.lastPresentMs = nowMs;
    }
    else if (session.inBedSinceMs !== undefined && nowMs - (session.lastPresentMs ?? 0) >= SESSION_GAP_MS) {
        session.inBedSinceMs = undefined;
        session.lastPresentMs = undefined;
        session.hasWoken = false;
        session.hasTurnedOn = false;
    }
    return session;
}
// True when a time of day (HH:mm) is in the evening window that starts at `after` and runs
// to TURN_ON_WINDOW_END the next morning
export function isInTurnOnWindow(clockTime, after) {
    if (after <= TURN_ON_WINDOW_END)
        return clockTime >= after && clockTime < TURN_ON_WINDOW_END;
    return clockTime >= after || clockTime < TURN_ON_WINDOW_END;
}
// The actions a stay has earned and not yet had. Marks them as done on the session.
export function takeDueActions(session, presenceSettings, context) {
    const dueActions = [];
    if (session.inBedSinceMs === undefined)
        return dueActions;
    const { wakeAfterHours, turnOnWhenInBed } = presenceSettings;
    // Turn the bed on: once per stay, only if it is off, only for someone who is there now
    if (turnOnWhenInBed.enabled && !session.hasTurnedOn && context.isPresentNow
        && isInTurnOnWindow(context.clockTime, turnOnWhenInBed.after)) {
        session.hasTurnedOn = true;
        if (!context.isOn)
            dueActions.push('turnOn');
    }
    if (wakeAfterHours.enabled && !session.hasWoken && context.isPresentNow
        && context.nowMs - session.inBedSinceMs >= wakeAfterHours.hours * MS_PER_HOUR) {
        session.hasWoken = true;
        dueActions.push('wake');
    }
    return dueActions;
}
//# sourceMappingURL=presenceActions.js.map
//# debugId=3d17e496-e682-5231-8790-f0bddbc55b48
