// Tracks the running alarm per side: when its vibration ends, and any pending snooze.
// Keep this file free of runtime imports so tests can load it without a Pod environment.
import type { AlarmJob, Side } from '../db/schedulesSchema.js';
import type { AlarmTapConfig } from '../8sleep/gestures.js';

type SideAlarmState = {
  // The alarm that last started on this side, re-run when it is snoozed
  lastAlarm?: AlarmJob;
  vibrationEndTimer?: ReturnType<typeof setTimeout>;
  snoozeTimer?: ReturnType<typeof setTimeout>;
};

export type AlarmSessionDeps = {
  // Sends the alarm to the Pod. It must report back through alarmStarted once vibration begins.
  // `isContinuation` marks a further stretch of an alarm that is already going off.
  startAlarm: (alarmJob: AlarmJob, options?: { isContinuation: boolean }) => Promise<void>;
  // Persists the "alarm is vibrating" flag the app reads
  setAlarmVibrating: (side: Side, isAlarmVibrating: boolean) => Promise<void>;
  logDebug: (message: string) => void;
};

// Creates the alarm state tracker. The Pod cannot tell us whether an alarm is vibrating,
// so this is the single owner of that knowledge and of every timer attached to it.
export function createAlarmSession({ startAlarm, setAlarmVibrating, logDebug }: AlarmSessionDeps) {
  const sideStates: Record<Side, SideAlarmState> = { left: {}, right: {} };

  const cancelVibrationEndTimer = (side: Side) => {
    clearTimeout(sideStates[side].vibrationEndTimer);
    sideStates[side].vibrationEndTimer = undefined;
  };

  const cancelSnooze = (side: Side) => {
    if (sideStates[side].snoozeTimer) logDebug(`Cancelling pending snooze for ${side}`);
    clearTimeout(sideStates[side].snoozeTimer);
    sideStates[side].snoozeTimer = undefined;
  };

  // Call when an alarm has been sent to the Pod. Replaces the previous end-of-vibration timer,
  // so an older alarm's timer cannot clear the flag while this one is still vibrating.
  //
  // The firmware only vibrates for a few minutes per request. For a longer alarm, pass the rest
  // of it as `continuation`: when this stretch ends it is started, and the alarm counts as
  // vibrating throughout. Dismissing or snoozing cancels the timer, which ends the chain.
  const alarmStarted = async (
    alarmJob: AlarmJob,
    durationSeconds: number,
    { continuation, isContinuation = false }: { continuation?: AlarmJob; isContinuation?: boolean } = {},
  ) => {
    const { side } = alarmJob;
    cancelVibrationEndTimer(side);
    cancelSnooze(side);
    // A snooze re-runs the whole alarm, so later stretches must not replace it
    if (!isContinuation) sideStates[side].lastAlarm = alarmJob;
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
        if (sideStates[side].vibrationEndTimer === undefined) void setAlarmVibrating(side, false);
      });
    }, durationSeconds * 1_000);
    sideStates[side].vibrationEndTimer = stretchTimer;
  };

  // Call when the alarm was stopped on the Pod (dismissed from the app or by a tap).
  // Returns the alarm that was vibrating, or undefined if none was, so the caller can tell a
  // real dismissal from a clear sent when nothing was going off.
  const alarmCleared = async (side: Side): Promise<AlarmJob | undefined> => {
    const wasVibrating = sideStates[side].vibrationEndTimer !== undefined;
    cancelVibrationEndTimer(side);
    cancelSnooze(side);
    await setAlarmVibrating(side, false);
    return wasVibrating ? sideStates[side].lastAlarm : undefined;
  };

  // The firmware's clear command stops the vibration on both sides. Call this for the side that
  // did not ask for it: if its alarm was still going off it is started again, so one sleeper
  // dismissing their alarm does not silence the other's. Returns whether it restarted one.
  const restartIfVibrating = async (side: Side): Promise<boolean> => {
    const { lastAlarm, vibrationEndTimer } = sideStates[side];
    if (vibrationEndTimer === undefined || !lastAlarm) return false;
    logDebug(`Restarting ${side} alarm, which the other side's dismissal stopped`);
    cancelVibrationEndTimer(side);
    await startAlarm(lastAlarm);
    return true;
  };

  // Re-runs the last alarm of a side after snoozeSeconds. Returns false when there is nothing to snooze.
  const snooze = (side: Side, snoozeSeconds: number): boolean => {
    const { lastAlarm } = sideStates[side];
    if (!lastAlarm) return false;
    cancelSnooze(side);
    logDebug(`Snoozing ${side} alarm for ${snoozeSeconds}s`);
    sideStates[side].snoozeTimer = setTimeout(() => {
      sideStates[side].snoozeTimer = undefined;
      void startAlarm(lastAlarm);
    }, snoozeSeconds * 1_000);
    return true;
  };

  const hasPendingSnooze = (side: Side) => sideStates[side].snoozeTimer !== undefined;

  return { alarmStarted, alarmCleared, restartIfVibrating, snooze, cancelSnooze, hasPendingSnooze };
}

export type AlarmSession = ReturnType<typeof createAlarmSession>;

export type AlarmGestureDeps = {
  isAlarmVibrating: boolean;
  isSideOn: boolean;
  // Stops the vibration on the Pod and clears the alarm state
  dismissAlarm: () => Promise<void>;
  snoozeAlarm: (snoozeSeconds: number) => boolean;
  setPower: (isOn: boolean) => Promise<void>;
};

export type AlarmGestureResult = 'dismissed' | 'snoozed' | 'power' | 'none';

// Decides what an alarm tap does. While an alarm vibrates it dismisses or snoozes it;
// otherwise it toggles the side's power if configured to.
export async function handleAlarmGesture(tapConfig: AlarmTapConfig, deps: AlarmGestureDeps): Promise<AlarmGestureResult> {
  if (deps.isAlarmVibrating) {
    // Dismiss first: it cancels any earlier snooze, then the new snooze is scheduled
    await deps.dismissAlarm();
    if (tapConfig.behavior === 'snooze' && deps.snoozeAlarm(tapConfig.snoozeDuration)) return 'snoozed';
    return 'dismissed';
  }
  if (tapConfig.inactiveAlarmBehavior === 'power') {
    await deps.setPower(!deps.isSideOn);
    return 'power';
  }
  return 'none';
}
