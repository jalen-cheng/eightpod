// One stay in bed as it is saved on the Pod: a row per minute, when the bed thought the sleeper
// fell asleep and woke, and what a linked sleep tracker said about the same stay.
// Types only, so the app and the tests can import this file.
import type { Side } from '../db/schedulesSchema.js';
import type { SleepStage } from './sleepTracker.js';

// A sleep of three hours or more is a night's; a shorter one is a nap
export type SleepKind = 'night' | 'nap';

export type NightMinute = {
  movementSeconds: number;
  heartRate?: number;
  breathingRate?: number;
  breathingSpread?: number;
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
export type NightSummary = Omit<NightRecord, 'minutes'> & { minutesLogged: number; heartRate?: number; breathingRate?: number };
