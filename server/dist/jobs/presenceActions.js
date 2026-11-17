// Getting up for a few minutes does not end a night in bed; being out this long does

!function(){try{var e="undefined"!=typeof window?window:"undefined"!=typeof global?global:"undefined"!=typeof globalThis?globalThis:"undefined"!=typeof self?self:{},n=(new e.Error).stack;n&&(e._sentryDebugIds=e._sentryDebugIds||{},e._sentryDebugIds[n]="ab683408-ba2f-5265-b3b6-a30b5ebf92eb")}catch(e){}}();
export const SESSION_GAP_MS = 15 * 60_000;
// The "stay on" choice that means: until the person gets out of bed
export const UNTIL_OUT_OF_BED = 'untilOutOfBed';
const MS_PER_HOUR = 3_600_000;
export const createBedSession = () => ({ hasWoken: false, hasTurnedOn: false, turnsOffWhenOut: false, isTurnOffDue: false });
// Updates a stay with the latest detection. A stay starts when someone is detected and ends
// once nobody has been for SESSION_GAP_MS. Changes the session in place and returns it.
export function trackBedSession(session, present, nowMs) {
    if (present) {
        session.inBedSinceMs ??= nowMs;
        session.lastPresentMs = nowMs;
    }
    else if (session.inBedSinceMs !== undefined && nowMs - (session.lastPresentMs ?? 0) >= SESSION_GAP_MS) {
        session.isTurnOffDue = session.turnsOffWhenOut;
        session.inBedSinceMs = undefined;
        session.lastPresentMs = undefined;
        session.hasWoken = false;
        session.hasTurnedOn = false;
        session.turnsOffWhenOut = false;
    }
    return session;
}
// The actions a stay has earned and not yet had. Marks them as done on the session.
export function takeDueActions(session, presenceSettings, context) {
    const dueActions = [];
    const { wakeAfterHours, turnOnWhenInBed } = presenceSettings;
    // A stay that turned the bed on "until I get out of bed" has ended
    if (session.isTurnOffDue) {
        session.isTurnOffDue = false;
        if (context.isOn)
            dueActions.push('turnOff');
    }
    if (session.inBedSinceMs === undefined)
        return dueActions;
    // Turn the bed on: once per stay, only if it is off, only for someone who is there now
    if (turnOnWhenInBed.enabled && !session.hasTurnedOn && context.isPresentNow) {
        session.hasTurnedOn = true;
        if (!context.isOn) {
            session.turnsOffWhenOut = turnOnWhenInBed.stayOn === UNTIL_OUT_OF_BED;
            dueActions.push('turnOn');
        }
    }
    if (wakeAfterHours.enabled && !session.hasWoken && context.isPresentNow
        && context.nowMs - session.inBedSinceMs >= wakeAfterHours.hours * MS_PER_HOUR) {
        session.hasWoken = true;
        dueActions.push('wake');
    }
    return dueActions;
}
//# sourceMappingURL=presenceActions.js.map
//# debugId=ab683408-ba2f-5265-b3b6-a30b5ebf92eb
