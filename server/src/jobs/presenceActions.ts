// Works out what being in bed should set off: an alarm after so many hours in bed, and turning
// the bed on when someone gets in during the evening.
// Keep this file free of runtime imports so tests can load it without a Pod environment.
import type { Settings } from '../db/settingsSchema.js';

type PresenceSettings = Settings['presence'];

// Getting up for a few minutes does not end a night in bed; being out this long does
export const SESSION_GAP_MS = 15 * 60_000;
// "Getting into bed in the evening" runs from the chosen time until this time the next morning
export const TURN_ON_WINDOW_END = '06:00';
const MS_PER_HOUR = 3_600_000;

// One stay in bed, for a side or for the whole bed when the sides are linked
export type BedSession = {
  // When this stay began; undefined while nobody is in bed
  inBedSinceMs?: number;
  // The last moment someone was detected, to bridge short gaps
  lastPresentMs?: number;
  // Each action runs once per stay
  hasWoken: boolean;
  hasTurnedOn: boolean;
};

export const createBedSession = (): BedSession => ({ hasWoken: false, hasTurnedOn: false });

// Updates a stay with the latest detection. A stay starts when someone is detected and ends
// once nobody has been for SESSION_GAP_MS. Changes the session in place and returns it.
export function trackBedSession(session: BedSession, present: boolean, nowMs: number): BedSession {
  if (present) {
    session.inBedSinceMs ??= nowMs;
    session.lastPresentMs = nowMs;
  } else if (session.inBedSinceMs !== undefined && nowMs - (session.lastPresentMs ?? 0) >= SESSION_GAP_MS) {
    session.inBedSinceMs = undefined;
    session.lastPresentMs = undefined;
    session.hasWoken = false;
    session.hasTurnedOn = false;
  }
  return session;
}

// True when a time of day (HH:mm) is in the evening window that starts at `after` and runs
// to TURN_ON_WINDOW_END the next morning
export function isInTurnOnWindow(clockTime: string, after: string): boolean {
  if (after <= TURN_ON_WINDOW_END) return clockTime >= after && clockTime < TURN_ON_WINDOW_END;
  return clockTime >= after || clockTime < TURN_ON_WINDOW_END;
}

export type PresenceAction = 'wake' | 'turnOn';

export type ActionContext = {
  nowMs: number;
  // The time of day in the Pod's time zone, HH:mm
  clockTime: string;
  // Whether someone is detected right now (not only within the stay's grace period)
  isPresentNow: boolean;
  // Whether the side (any side, when linked) is already on
  isOn: boolean;
};

// The actions a stay has earned and not yet had. Marks them as done on the session.
export function takeDueActions(session: BedSession, presenceSettings: PresenceSettings, context: ActionContext): PresenceAction[] {
  const dueActions: PresenceAction[] = [];
  if (session.inBedSinceMs === undefined) return dueActions;
  const { wakeAfterHours, turnOnWhenInBed } = presenceSettings;

  // Turn the bed on: once per stay, only if it is off, only for someone who is there now
  if (turnOnWhenInBed.enabled && !session.hasTurnedOn && context.isPresentNow
    && isInTurnOnWindow(context.clockTime, turnOnWhenInBed.after)) {
    session.hasTurnedOn = true;
    if (!context.isOn) dueActions.push('turnOn');
  }

  if (wakeAfterHours.enabled && !session.hasWoken && context.isPresentNow
    && context.nowMs - session.inBedSinceMs >= wakeAfterHours.hours * MS_PER_HOUR) {
    session.hasWoken = true;
    dueActions.push('wake');
  }
  return dueActions;
}
