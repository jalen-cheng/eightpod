// What `GET /api/autopilot` returns. Types only, so the app can import this file.
import type { LearnedOffsets } from './nightPlan.js';
import type { SleepKind } from './nightRecord.js';
import type { SleepRules, SleepStage } from './sleepTracker.js';

// A worn sleep tracker that has sent this side's sleep and wake times, and how well the bed's
// own times agree with it
export type TrackerLink = {
  source: string;
  syncedAt: string;
  // How many tracker-reported nights the figures below come from
  nights: number;
  onsetErrorMinutes: number;
  wakeErrorMinutes: number;
};

export type AutopilotSideSnapshot = {
  stage: SleepStage;
  // While asleep: being treated as the night's sleep, or as a nap (followed but not steered)
  sleepKind?: SleepKind;
  // For showing only; sleep is judged from stillness
  heartRate?: number;
  // Breaths a minute
  breathingRate?: number;
  minutesAsleep?: number;
  // How far the autopilot has the side from its set temperature right now, °F
  offsetF?: number;
  // The last change it made, in words
  lastChange?: string;
  // What it has learned from corrections, per part of the night, °F
  learned: LearnedOffsets;
  // The stillness rules in use, default or fitted to a sleep tracker
  rules: SleepRules;
  tracker?: TrackerLink;
};

export type AutopilotSnapshot = {
  // False on a Pod without the sensors this needs
  available: boolean;
  enabled: boolean;
  room?: { temperatureF: number; humidityPercent?: number };
  left: AutopilotSideSnapshot;
  right: AutopilotSideSnapshot;
};
