// Works out the temperature the autopilot wants for one side, a minute at a time, as an offset
// from the temperature the schedule (or the sleeper) set. Four things add up to the offset:
//   1. a fixed curve over the night, from falling asleep to the wake time
//   2. a little cooler through the stretch after falling asleep where deep sleep usually falls
//   3. what the sleeper's own corrections have taught it, for this part of the night
//   4. the room and the mattress getting warmer or cooler than they were at sleep onset
// Keep this file free of runtime imports so tests can load it without a Pod environment.
import type { SleepStage } from './sleepTracker.js';

// The offset never goes further than this from the base temperature, whatever adds up
export const MAX_OFFSET_F = 4;
const MIN_TEMPERATURE_F = 55;
const MAX_TEMPERATURE_F = 110;

// ---------------------------------------------------------------------------------------------
// 1. The curve. `progress` runs from 0 (fell asleep) to 1 (wake time).
//
// Why this shape:
// - Cooler through the first half, where most deep sleep falls. Taking heat from the body by
//   conduction raised deep sleep in crossover trials (Kräuchi et al. 2018, Physiol Behav 185:23,
//   +16% slow-wave sleep; Herberger et al. 2024, Sci Rep, +7.5 min N3 and -2.4 bpm), and a
//   vendor-funded trial of a cover like this one found the same with a cooler first half
//   (Moyen et al. 2024, Bioengineering 11:352).
// - Back to the base through the second half. Temperature regulation is weak in REM sleep,
//   which fills the late night, and both heat and cold then cost sleep (Okamoto-Mizuno and
//   Mizuno 2012, J Physiol Anthropol 31:14).
// - A degree warmer in the last stretch. Mild skin warming cut early-morning waking (Raymann,
//   Swaab and Van Someren 2008, Brain 131:500) and body temperature is rising then anyway.
// None of these papers gives a setting for a water-cooled cover in degrees; the sizes here are
// small on purpose and the sleeper's corrections (step 3) reshape them.
// ---------------------------------------------------------------------------------------------
const CURVE_POINTS: [progress: number, offsetF: number][] = [
  [0, 0],
  [0.1, -2],
  [0.5, -2],
  [0.85, 0],
  [1, 1],
];

// The curve's offset at a point in the night, joining its points with straight lines
export function curveOffsetF(progress: number): number {
  const clamped = Math.min(1, Math.max(0, progress));
  for (let index = 1; index < CURVE_POINTS.length; index++) {
    const [fromProgress, fromOffset] = CURVE_POINTS[index - 1];
    const [toProgress, toOffset] = CURVE_POINTS[index];
    if (clamped <= toProgress) {
      return fromOffset + (toOffset - fromOffset) * (clamped - fromProgress) / (toProgress - fromProgress);
    }
  }
  return CURVE_POINTS[CURVE_POINTS.length - 1][1];
}

// 2. Deep sleep is not detected. Most of a night's deep sleep falls in the first sleep cycle,
//    which starts some minutes after falling asleep and runs to about an hour and a half, so the
//    bed is one degree cooler for that fixed stretch.
export const DEEP_SLEEP_OFFSET_F = -1;
export const DEEP_SLEEP_STARTS_AFTER_MINUTES = 20;
export const DEEP_SLEEP_ENDS_AFTER_MINUTES = 90;

export const isDeepSleepStretch = (minutesSinceSleepOnset: number | undefined): boolean => minutesSinceSleepOnset !== undefined
  && minutesSinceSleepOnset >= DEEP_SLEEP_STARTS_AFTER_MINUTES && minutesSinceSleepOnset < DEEP_SLEEP_ENDS_AFTER_MINUTES;

// ---------------------------------------------------------------------------------------------
// 3. Learning from corrections. The night is cut into three parts; a correction made by hand
//    (app or side button) moves that part's learned offset part of the way toward it.
// ---------------------------------------------------------------------------------------------
export const NIGHT_PARTS = ['early', 'middle', 'late'] as const;
export type NightPart = typeof NIGHT_PARTS[number];
export type LearnedOffsets = Record<NightPart, number>;
export const NO_LEARNED_OFFSETS: LearnedOffsets = { early: 0, middle: 0, late: 0 };

// How much of a correction is kept for later nights. Half: one night does not rewrite the rest.
const LEARNING_RATE = 0.5;
const MAX_LEARNED_OFFSET_F = 3;

export const nightPartAt = (progress: number): NightPart => (progress < 1 / 3 ? 'early' : progress < 2 / 3 ? 'middle' : 'late');

// The learned offsets after the sleeper moved the temperature `correctionF` away from what the
// autopilot had set, during `part` of the night
export function learnFromCorrection(learned: LearnedOffsets, part: NightPart, correctionF: number): LearnedOffsets {
  const moved = learned[part] + correctionF * LEARNING_RATE;
  return { ...learned, [part]: Math.min(MAX_LEARNED_OFFSET_F, Math.max(-MAX_LEARNED_OFFSET_F, moved)) };
}

// ---------------------------------------------------------------------------------------------
// 4. The room and the mattress. Readings are compared with what they were at sleep onset: a
//    room that warms makes the same bed setting feel warmer, so the bed goes the other way.
// ---------------------------------------------------------------------------------------------
export type Surroundings = {
  // Air temperature at the cover, °F
  roomF?: number;
  // The mattress surface under the sleeper, °F
  surfaceF?: number;
};
// Half a degree of bed for each degree of room
const ROOM_GAIN = 0.5;
// The surface runs with the water, so only a clear drift from where it settled counts
const SURFACE_DRIFT_F = 2;
const MAX_SURROUNDINGS_OFFSET_F = 2;

export function surroundingsOffsetF(atSleepOnset: Surroundings, now: Surroundings): number {
  let offset = 0;
  if (atSleepOnset.roomF !== undefined && now.roomF !== undefined) offset -= (now.roomF - atSleepOnset.roomF) * ROOM_GAIN;
  if (atSleepOnset.surfaceF !== undefined && now.surfaceF !== undefined) {
    const drift = now.surfaceF - atSleepOnset.surfaceF;
    if (Math.abs(drift) >= SURFACE_DRIFT_F) offset -= Math.sign(drift);
  }
  return Math.min(MAX_SURROUNDINGS_OFFSET_F, Math.max(-MAX_SURROUNDINGS_OFFSET_F, offset));
}

// ---------------------------------------------------------------------------------------------
// Putting it together
// ---------------------------------------------------------------------------------------------
export type PlanInput = {
  // The temperature the schedule or the sleeper set, °F
  baseTemperatureF: number;
  stage: SleepStage;
  // 0 at sleep onset, 1 at the wake time; undefined before falling asleep
  progress?: number;
  // Minutes since first falling asleep tonight
  minutesSinceSleepOnset?: number;
  learned: LearnedOffsets;
  // A correction made by hand earlier in this part of this night, kept in full until the part ends
  correctionTonightF: number;
  surroundingsAtSleepOnset: Surroundings;
  surroundingsNow: Surroundings;
};

export type Plan = {
  targetTemperatureF: number;
  offsetF: number;
  // What made up the offset, for showing why the bed changed
  parts: { curveF: number; deepF: number; learnedF: number; correctionF: number; surroundingsF: number };
};

// The temperature the autopilot wants now. Awake or out of bed, it wants the base: it only
// acts on someone who is asleep.
export function planTemperature(input: PlanInput): Plan {
  const isAsleep = input.stage === 'asleep';
  const progress = input.progress ?? 0;
  const parts = isAsleep
    ? {
      curveF: curveOffsetF(progress),
      deepF: isDeepSleepStretch(input.minutesSinceSleepOnset) ? DEEP_SLEEP_OFFSET_F : 0,
      learnedF: input.learned[nightPartAt(progress)],
      correctionF: input.correctionTonightF,
      surroundingsF: surroundingsOffsetF(input.surroundingsAtSleepOnset, input.surroundingsNow),
    }
    : { curveF: 0, deepF: 0, learnedF: 0, correctionF: input.correctionTonightF, surroundingsF: 0 };
  const total = parts.curveF + parts.deepF + parts.learnedF + parts.correctionF + parts.surroundingsF;
  const offsetF = Math.round(Math.min(MAX_OFFSET_F, Math.max(-MAX_OFFSET_F, total)));
  const targetTemperatureF = Math.min(MAX_TEMPERATURE_F, Math.max(MIN_TEMPERATURE_F, Math.round(input.baseTemperatureF) + offsetF));
  return { targetTemperatureF, offsetF: targetTemperatureF - Math.round(input.baseTemperatureF), parts };
}
