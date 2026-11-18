// One stay in bed as it is saved on the Pod: a row per minute, when the bed thought the sleeper
// fell asleep and woke, and what a linked sleep tracker said about the same stay.
// Types only, so the app and the tests can import this file.
import type { Side } from '../db/schedulesSchema.js';
import type { SleepStage } from './sleepTracker.js';

// A sleep that starts in or near the scheduled night, or one at another time of day
export type SleepKind = 'night' | 'nap';

export type NightMinute = {
  movementSeconds: number;
  heartRate?: number;
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

// A night without its minute rows, for listing
export type NightSummary = Omit<NightRecord, 'minutes'> & { minutesLogged: number };
