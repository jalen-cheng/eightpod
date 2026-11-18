// What `GET /api/autopilot` returns. Types only, so the app can import this file.
import type { LearnedOffsets } from './nightPlan.js';
import type { SleepStage } from './sleepTracker.js';

export type AutopilotSideSnapshot = {
  stage: SleepStage;
  // Sleep is judged from this and from stillness; there is no deep-sleep stage
  heartRate?: number;
  minutesAsleep?: number;
  // How far the autopilot has the side from its set temperature right now, °F
  offsetF?: number;
  // The last change it made, in words
  lastChange?: string;
  // What it has learned from corrections, per part of the night, °F
  learned: LearnedOffsets;
};

export type AutopilotSnapshot = {
  // False on a Pod without the sensors this needs
  available: boolean;
  enabled: boolean;
  room?: { temperatureF: number; humidityPercent?: number };
  left: AutopilotSideSnapshot;
  right: AutopilotSideSnapshot;
};
