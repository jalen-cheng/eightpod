// What `GET /api/autopilot` returns. Types only, so the app can import this file.
import type { LearnedOffsets } from './nightPlan.js';
import type { SleepKind } from './nightRecord.js';
import type { SleepRules, SleepStage } from './sleepTracker.js';

// A worn sleep tracker that has sent this side's sleep and wake times, and how well the bed's
// own times agree with it
export type TrackerLink = {
  source: string;
  syncedAt: string;
  // How many tracker-reported nights the figure below comes from
  nights: number;
  // The share of minutes on which the bed and the tracker agree about asleep or awake
  agreementPercent: number;
  // True once the bed's sleep rules have been changed from the default to fit the tracker
  isTuned: boolean;
};

export type AutopilotSideSnapshot = {
  stage: SleepStage;
  // While asleep: being treated as the night's sleep, or as a nap (followed but not steered)
  sleepKind?: SleepKind;
  // Not worked out for now (see USES_HEART_AND_BREATHING in autopilotMonitor.ts), so both are absent
  heartRate?: number;
  // Breaths a minute
  breathingRate?: number;
  minutesAsleep?: number;
  // How far the autopilot has the side from its set temperature right now, °F
  offsetF?: number;
  // A temperature set by hand that the autopilot is holding and not adjusting, °F
  holdingF?: number;
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
