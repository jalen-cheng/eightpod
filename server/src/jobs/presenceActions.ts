// Works out what being in bed should set off: an alarm after so many hours in bed, and turning
// the bed on when someone gets in (and off again when they get out, if asked).
// Keep this file free of runtime imports so tests can load it without a Pod environment.
import type { Settings } from '../db/settingsSchema.js';

type PresenceSettings = Settings['presence'];

// Getting up for a few minutes does not end a night in bed; being out this long does
export const SESSION_GAP_MS = 15 * 60_000;
// The "stay on" choice that means: until the person gets out of bed
export const UNTIL_OUT_OF_BED = 'untilOutOfBed';
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
  // True when this stay turned the bed on "until I get out of bed", so its end turns it off
  turnsOffWhenOut: boolean;
  // Set when such a stay has just ended and the bed still has to be turned off
  isTurnOffDue: boolean;
};

export const createBedSession = (): BedSession => ({ hasWoken: false, hasTurnedOn: false, turnsOffWhenOut: false, isTurnOffDue: false });

// Updates a stay with the latest detection. A stay starts when someone is detected and ends
// once nobody has been for SESSION_GAP_MS. Changes the session in place and returns it.
export function trackBedSession(session: BedSession, present: boolean, nowMs: number): BedSession {
  if (present) {
    session.inBedSinceMs ??= nowMs;
    session.lastPresentMs = nowMs;
  } else if (session.inBedSinceMs !== undefined && nowMs - (session.lastPresentMs ?? 0) >= SESSION_GAP_MS) {
    session.isTurnOffDue = session.turnsOffWhenOut;
    session.inBedSinceMs = undefined;
    session.lastPresentMs = undefined;
    session.hasWoken = false;
    session.hasTurnedOn = false;
    session.turnsOffWhenOut = false;
  }
  return session;
}

export type PresenceAction = 'wake' | 'turnOn' | 'turnOff';

export type ActionContext = {
  nowMs: number;
  // Whether someone is detected right now (not only within the stay's grace period)
  isPresentNow: boolean;
  // Whether the side (any side, when linked) is already on
  isOn: boolean;
};

// The actions a stay has earned and not yet had. Marks them as done on the session.
export function takeDueActions(session: BedSession, presenceSettings: PresenceSettings, context: ActionContext): PresenceAction[] {
  const dueActions: PresenceAction[] = [];
  const { wakeAfterHours, turnOnWhenInBed } = presenceSettings;

  // A stay that turned the bed on "until I get out of bed" has ended
  if (session.isTurnOffDue) {
    session.isTurnOffDue = false;
    if (context.isOn) dueActions.push('turnOff');
  }
  if (session.inBedSinceMs === undefined) return dueActions;

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
