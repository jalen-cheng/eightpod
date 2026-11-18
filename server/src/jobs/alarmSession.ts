// Tracks the running alarm per side and when its vibration ends.
// Keep this file free of runtime imports so tests can load it without a Pod environment.
import type { AlarmJob, Side } from '../db/schedulesSchema.js';
import type { AlarmTapConfig } from '../8sleep/gestures.js';

type SideAlarmState = {
  // The alarm that last started on this side, re-run if the other side's dismissal stops it
  lastAlarm?: AlarmJob;
  vibrationEndTimer?: ReturnType<typeof setTimeout>;
  // True from the alarm starting until it ends or is dismissed, including the moments between
  // two stretches when no timer is running
  isActive?: boolean;
};

// The firmware's "rise" pattern vibrates at one steady strength (felt on a Pod 5), and it ignores
// a new alarm while one is vibrating. So a ramp-up is made here: short stretches one after
// another, each stronger than the last, then full strength.
const RAMP_STEP_SECONDS = 10;
const RAMP_STRENGTH_FRACTIONS = [0.2, 0.4, 0.6, 0.8];
// The firmware does not run an alarm shorter than this
const MIN_ALARM_SECONDS = 10;

// Works out the next stretch of an alarm to send to the Pod: how strong, for how long, and what
// is left to run after it (undefined when this stretch finishes the alarm).
// `rampInSteps` is false for Pods whose own "rise" pattern has not been checked (Pod 3 and 4):
// they get the pattern exactly as the original project sent it, at the set strength throughout.
export function planAlarmStretch(
  alarmJob: AlarmJob,
  maxStretchSeconds: number,
  { rampInSteps }: { rampInSteps: boolean } = { rampInSteps: true },
) {
  const totalSeconds = Math.max(MIN_ALARM_SECONDS, alarmJob.duration);
  const rampStep = alarmJob.rampStep ?? 0;
  const isRamping = rampInSteps
    && alarmJob.vibrationPattern === 'rise'
    && rampStep < RAMP_STRENGTH_FRACTIONS.length
    && totalSeconds > RAMP_STEP_SECONDS;
  const seconds = Math.min(isRamping ? RAMP_STEP_SECONDS : maxStretchSeconds, totalSeconds);
  const strength = isRamping
    ? Math.max(1, Math.round(alarmJob.vibrationIntensity * RAMP_STRENGTH_FRACTIONS[rampStep]))
    : alarmJob.vibrationIntensity;
  const remainingSeconds = totalSeconds - seconds;
  const continuation: AlarmJob | undefined = remainingSeconds > 0
    ? { ...alarmJob, duration: remainingSeconds, rampStep: isRamping ? rampStep + 1 : RAMP_STRENGTH_FRACTIONS.length }
    : undefined;
  return { strength, seconds, continuation };
}

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

  // Call when an alarm has been sent to the Pod. Replaces the previous end-of-vibration timer,
  // so an older alarm's timer cannot clear the flag while this one is still vibrating.
  //
  // The firmware only vibrates for a few minutes per request. For a longer alarm, pass the rest
  // of it as `continuation`: when this stretch ends it is started, and the alarm counts as
  // vibrating throughout. Dismissing cancels the timer, which ends the chain.
  const alarmStarted = async (
    alarmJob: AlarmJob,
    durationSeconds: number,
    { continuation, isContinuation = false }: { continuation?: AlarmJob; isContinuation?: boolean } = {},
  ) => {
    const { side } = alarmJob;
    // A further stretch of an alarm that was dismissed while it was being sent is not tracked
    if (isContinuation && !sideStates[side].isActive) return;
    cancelVibrationEndTimer(side);
    // A restart re-runs the whole alarm, so later stretches must not replace it
    if (!isContinuation) sideStates[side].lastAlarm = alarmJob;
    sideStates[side].isActive = true;
    await setAlarmVibrating(side, true);
    const stretchTimer = setTimeout(() => {
      sideStates[side].vibrationEndTimer = undefined;
      if (!continuation) {
        sideStates[side].isActive = false;
        void setAlarmVibrating(side, false);
        return;
      }
      void startAlarm(continuation, { isContinuation: true }).then(() => {
        // The next stretch reports back through alarmStarted. If it did not start (the side
        // was switched off, say), nothing is vibrating any more.
        if (sideStates[side].vibrationEndTimer === undefined) {
          sideStates[side].isActive = false;
          void setAlarmVibrating(side, false);
        }
      });
    }, durationSeconds * 1_000);
    sideStates[side].vibrationEndTimer = stretchTimer;
  };

  // True while a side's alarm is going off. A further stretch checks this before it is sent, so
  // an alarm dismissed in the moment between two stretches does not start again.
  const isAlarmActive = (side: Side): boolean => Boolean(sideStates[side].isActive);

  // Call when the alarm was stopped on the Pod (dismissed from the app or by a tap).
  // Returns the alarm that was vibrating, or undefined if none was, so the caller can tell a
  // real dismissal from a clear sent when nothing was going off.
  const alarmCleared = async (side: Side): Promise<AlarmJob | undefined> => {
    const wasVibrating = Boolean(sideStates[side].isActive);
    sideStates[side].isActive = false;
    cancelVibrationEndTimer(side);
    await setAlarmVibrating(side, false);
    return wasVibrating ? sideStates[side].lastAlarm : undefined;
  };

  // The firmware's clear command stops the vibration on both sides. Call this for the side that
  // did not ask for it: if its alarm was still going off it is started again, so one sleeper
  // dismissing their alarm does not silence the other's. Returns whether it restarted one.
  const restartIfVibrating = async (side: Side): Promise<boolean> => {
    const { lastAlarm, isActive } = sideStates[side];
    if (!isActive || !lastAlarm) return false;
    logDebug(`Restarting ${side} alarm, which the other side's dismissal stopped`);
    cancelVibrationEndTimer(side);
    sideStates[side].isActive = false;
    await startAlarm(lastAlarm);
    // If it could not start again (the side was switched off, say), nothing is vibrating
    if (!sideStates[side].isActive) await setAlarmVibrating(side, false);
    return true;
  };

  return { alarmStarted, alarmCleared, restartIfVibrating, isAlarmActive };
}

export type AlarmSession = ReturnType<typeof createAlarmSession>;

export type AlarmGestureDeps = {
  isAlarmVibrating: boolean;
  isSideOn: boolean;
  // Stops the vibration on the Pod and clears the alarm state
  dismissAlarm: () => Promise<void>;
  setPower: (isOn: boolean) => Promise<void>;
};

export type AlarmGestureResult = 'dismissed' | 'power' | 'none';

// Decides what an alarm tap does. While an alarm vibrates it dismisses it; otherwise it toggles
// the side's power if configured to. (The saved config still carries a snooze choice, which
// upstream's settings define; it is not acted on.)
export async function handleAlarmGesture(tapConfig: AlarmTapConfig, deps: AlarmGestureDeps): Promise<AlarmGestureResult> {
  if (deps.isAlarmVibrating) {
    await deps.dismissAlarm();
    return 'dismissed';
  }
  if (tapConfig.inactiveAlarmBehavior === 'power') {
    await deps.setPower(!deps.isSideOn);
    return 'power';
  }
  return 'none';
}
