// Creates the alarm state tracker. The Pod cannot tell us whether an alarm is vibrating,
// so this is the single owner of that knowledge and of every timer attached to it.

!function(){try{var e="undefined"!=typeof window?window:"undefined"!=typeof global?global:"undefined"!=typeof globalThis?globalThis:"undefined"!=typeof self?self:{},n=(new e.Error).stack;n&&(e._sentryDebugIds=e._sentryDebugIds||{},e._sentryDebugIds[n]="d578d42f-cfc8-5a71-ab51-b77f024b39e8")}catch(e){}}();
export function createAlarmSession({ startAlarm, setAlarmVibrating, logDebug }) {
    const sideStates = { left: {}, right: {} };
    const cancelVibrationEndTimer = (side) => {
        clearTimeout(sideStates[side].vibrationEndTimer);
        sideStates[side].vibrationEndTimer = undefined;
    };
    const cancelSnooze = (side) => {
        if (sideStates[side].snoozeTimer)
            logDebug(`Cancelling pending snooze for ${side}`);
        clearTimeout(sideStates[side].snoozeTimer);
        sideStates[side].snoozeTimer = undefined;
    };
    // Call when an alarm has been sent to the Pod. Replaces the previous end-of-vibration timer,
    // so an older alarm's timer cannot clear the flag while this one is still vibrating.
    //
    // The firmware only vibrates for a few minutes per request. For a longer alarm, pass the rest
    // of it as `continuation`: when this stretch ends it is started, and the alarm counts as
    // vibrating throughout. Dismissing or snoozing cancels the timer, which ends the chain.
    const alarmStarted = async (alarmJob, durationSeconds, { continuation, isContinuation = false } = {}) => {
        const { side } = alarmJob;
        cancelVibrationEndTimer(side);
        cancelSnooze(side);
        // A snooze re-runs the whole alarm, so later stretches must not replace it
        if (!isContinuation)
            sideStates[side].lastAlarm = alarmJob;
        await setAlarmVibrating(side, true);
        const stretchTimer = setTimeout(() => {
            sideStates[side].vibrationEndTimer = undefined;
            if (!continuation) {
                void setAlarmVibrating(side, false);
                return;
            }
            void startAlarm(continuation, { isContinuation: true }).then(() => {
                // The next stretch reports back through alarmStarted. If it did not start (the side
                // was switched off, say), nothing is vibrating any more.
                if (sideStates[side].vibrationEndTimer === undefined)
                    void setAlarmVibrating(side, false);
            });
        }, durationSeconds * 1_000);
        sideStates[side].vibrationEndTimer = stretchTimer;
    };
    // Call when the alarm was stopped on the Pod (dismissed from the app or by a tap).
    // Returns the alarm that was vibrating, or undefined if none was, so the caller can tell a
    // real dismissal from a clear sent when nothing was going off.
    const alarmCleared = async (side) => {
        const wasVibrating = sideStates[side].vibrationEndTimer !== undefined;
        cancelVibrationEndTimer(side);
        cancelSnooze(side);
        await setAlarmVibrating(side, false);
        return wasVibrating ? sideStates[side].lastAlarm : undefined;
    };
    // The firmware's clear command stops the vibration on both sides. Call this for the side that
    // did not ask for it: if its alarm was still going off it is started again, so one sleeper
    // dismissing their alarm does not silence the other's. Returns whether it restarted one.
    const restartIfVibrating = async (side) => {
        const { lastAlarm, vibrationEndTimer } = sideStates[side];
        if (vibrationEndTimer === undefined || !lastAlarm)
            return false;
        logDebug(`Restarting ${side} alarm, which the other side's dismissal stopped`);
        cancelVibrationEndTimer(side);
        await startAlarm(lastAlarm);
        return true;
    };
    // Re-runs the last alarm of a side after snoozeSeconds. Returns false when there is nothing to snooze.
    const snooze = (side, snoozeSeconds) => {
        const { lastAlarm } = sideStates[side];
        if (!lastAlarm)
            return false;
        cancelSnooze(side);
        logDebug(`Snoozing ${side} alarm for ${snoozeSeconds}s`);
        sideStates[side].snoozeTimer = setTimeout(() => {
            sideStates[side].snoozeTimer = undefined;
            void startAlarm(lastAlarm);
        }, snoozeSeconds * 1_000);
        return true;
    };
    const hasPendingSnooze = (side) => sideStates[side].snoozeTimer !== undefined;
    return { alarmStarted, alarmCleared, restartIfVibrating, snooze, cancelSnooze, hasPendingSnooze };
}
// Decides what an alarm tap does. While an alarm vibrates it dismisses or snoozes it;
// otherwise it toggles the side's power if configured to.
export async function handleAlarmGesture(tapConfig, deps) {
    if (deps.isAlarmVibrating) {
        // Dismiss first: it cancels any earlier snooze, then the new snooze is scheduled
        await deps.dismissAlarm();
        if (tapConfig.behavior === 'snooze' && deps.snoozeAlarm(tapConfig.snoozeDuration))
            return 'snoozed';
        return 'dismissed';
    }
    if (tapConfig.inactiveAlarmBehavior === 'power') {
        await deps.setPower(!deps.isSideOn);
        return 'power';
    }
    return 'none';
}
//# sourceMappingURL=alarmSession.js.map
//# debugId=d578d42f-cfc8-5a71-ab51-b77f024b39e8
