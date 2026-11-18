// One stay in bed as it is saved on the Pod: a row per minute, when the bed thought the sleeper
// fell asleep and woke, and what a linked sleep tracker said about the same stay.
// Keep this file free of runtime imports so the app and the tests can load it.
import type { Side } from '../db/schedulesSchema.js';
import type { SleepStage } from './sleepTracker.js';

// A sleep of three hours or more is a night's; a shorter one is a nap
export type SleepKind = 'night' | 'nap';

export type NightMinute = {
  movementSeconds: number;
  heartRate?: number;
  breathingRate?: number;
  breathingSpread?: number;
  // How far the side's pressure sensors read above the empty bed (their own units)
  pressure?: number;
  stage: SleepStage;
  // How far the autopilot had the side from its set temperature, °F
  offsetF?: number;
  roomF?: number;
};

export type TrackerSleep = {
  // Whatever the sender called itself: "Apple Health", "Whoop", "Fitbit"
  source: string;
  asleepAtMs: number;
  awakeAtMs: number;
  receivedAtMs: number;
};

export type NightRecord = {
  side: Side;
  // When the first minute began; every later row is one minute on
  startedAtMs: number;
  minutes: NightMinute[];
  kind?: SleepKind;
  // By the bed's own reckoning; both undefined when no sleep was seen
  asleepAtMs?: number;
  awakeAtMs?: number;
  tracker?: TrackerSleep;
};

// A night without its minute rows, for listing, with the middle readings of its asleep minutes
export type NightSummary = Omit<NightRecord, 'minutes'> & {
  minutesLogged: number;
  heartRate?: number;
  breathingRate?: number;
  // How many times sleep was broken between falling asleep and the last waking
  wakeUps: number;
};

// A night in full: its summary and every minute
export type NightDetail = NightSummary & Pick<NightRecord, 'minutes'>;

// Counts the times a sleeper stopped being asleep and later slept again
export function countWakeUps(minutes: Pick<NightMinute, 'stage'>[]): number {
  let wakeUps = 0;
  let hasSlept = false;
  let isBroken = false;
  for (const minute of minutes) {
    if (minute.stage === 'asleep') {
      if (isBroken) wakeUps++;
      hasSlept = true;
      isBroken = false;
    } else if (hasSlept) {
      isBroken = true;
    }
  }
  return wakeUps;
}
