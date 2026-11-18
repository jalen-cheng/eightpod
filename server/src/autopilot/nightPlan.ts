// Works out the temperature the autopilot wants for one side, as an offset from the temperature
// the schedule set. Four things add up to the offset, in this order of priority:
//   1. what the sleeper's own corrections have taught it, for this part of the night
//   2. a fixed curve over the night, from falling asleep to the wake time
//   3. a little cooler through the stretch after falling asleep where deep sleep usually falls
//   4. the room getting warmer or cooler than it was at sleep onset
// When they add up to more than the limit, the later ones give way first, so what the sleeper
// asked for is the last thing to be cut.
// Keep this file free of runtime imports so tests can load it without a Pod environment.

// Raised when the way the temperature is decided changes, and saved with each night, so nights
// under different rules are not compared as if they were the same
export const POLICY_VERSION = 2;

// The offset never goes further than this from the base temperature, whatever adds up
export const MAX_OFFSET_F = 4;
// One change by the autopilot moves the bed at most this far
export const MAX_STEP_F = 1;
const MIN_TEMPERATURE_F = 55;
const MAX_TEMPERATURE_F = 110;

const clamp = (value: number, limit: number) => Math.min(limit, Math.max(-limit, value));

// ---------------------------------------------------------------------------------------------
// The curve. `progress` runs from 0 (fell asleep) to 1 (wake time): cooler through the first
// half, back to the base by late night, a degree warm at the end. The shape is a starting
// guess, not a finding: studies of cooling the body in sleep (docs/AUTOPILOT.md lists them)
// used other equipment and none tested this curve or these sizes. The sizes are small on
// purpose, and the sleeper's corrections reshape them.
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

// Deep sleep is not detected. Most of a night's deep sleep falls in the first sleep cycle,
// which starts some minutes after falling asleep and runs to about an hour and a half, so the
// bed is one degree cooler for that fixed stretch.
export const DEEP_SLEEP_OFFSET_F = -1;
export const DEEP_SLEEP_STARTS_AFTER_MINUTES = 20;
export const DEEP_SLEEP_ENDS_AFTER_MINUTES = 90;

export const isDeepSleepStretch = (minutesSinceSleepOnset: number | undefined): boolean => minutesSinceSleepOnset !== undefined
  && minutesSinceSleepOnset >= DEEP_SLEEP_STARTS_AFTER_MINUTES && minutesSinceSleepOnset < DEEP_SLEEP_ENDS_AFTER_MINUTES;

// ---------------------------------------------------------------------------------------------
// Learning from corrections. The night is cut into three parts. When the sleeper sets a
// temperature by hand, how far that was from what the autopilot wanted moves that part's
// learned offset a little toward it.
// ---------------------------------------------------------------------------------------------
export const NIGHT_PARTS = ['early', 'middle', 'late'] as const;
export type NightPart = typeof NIGHT_PARTS[number];
export type LearnedOffsets = Record<NightPart, number>;
export const NO_LEARNED_OFFSETS: LearnedOffsets = { early: 0, middle: 0, late: 0 };

// How much of a correction is kept for later nights. At three tenths, a one-degree correction
// takes two nights that agree before it shows, and one odd night (a fever, a hot room) fades.
const LEARNING_RATE = 0.3;
const MAX_LEARNED_OFFSET_F = 3;

export const nightPartAt = (progress: number): NightPart => (progress < 1 / 3 ? 'early' : progress < 2 / 3 ? 'middle' : 'late');

// The learned offsets after the sleeper set the temperature `correctionF` away from what the
// autopilot wanted, during `part` of the night
export function learnFromCorrection(learned: LearnedOffsets, part: NightPart, correctionF: number): LearnedOffsets {
  return { ...learned, [part]: clamp(learned[part] + correctionF * LEARNING_RATE, MAX_LEARNED_OFFSET_F) };
}

// ---------------------------------------------------------------------------------------------
// The room. The air temperature is compared with what it was at sleep onset: a room that warms
// makes the same bed setting feel warmer, so the bed goes the other way. The mattress surface
// is not used: it follows the water, so the autopilot would be answering its own changes.
// ---------------------------------------------------------------------------------------------
// Half a degree of bed for each degree of room
const ROOM_GAIN = 0.5;
const MAX_ROOM_OFFSET_F = 2;

export function roomOffsetF(roomAtSleepOnsetF: number | undefined, roomNowF: number | undefined): number {
  if (roomAtSleepOnsetF === undefined || roomNowF === undefined) return 0;
  // `|| 0` turns -0 into 0
  return clamp(-(roomNowF - roomAtSleepOnsetF) * ROOM_GAIN, MAX_ROOM_OFFSET_F) || 0;
}

// ---------------------------------------------------------------------------------------------
// Putting it together
// ---------------------------------------------------------------------------------------------
export type PlanInput = {
  // The temperature the schedule set, °F
  baseTemperatureF: number;
  // 0 at sleep onset, 1 at the wake time
  progress: number;
  // Minutes since first falling asleep tonight
  minutesSinceSleepOnset?: number;
  learned: LearnedOffsets;
  roomAtSleepOnsetF?: number;
  roomNowF?: number;
};

export type Plan = {
  targetTemperatureF: number;
  offsetF: number;
  // What made up the offset, for showing why the bed changed, after any cutting to the limit
  parts: { learnedF: number; curveF: number; deepF: number; roomF: number };
  // True when the parts added up to more than the limit and some were cut
  isLimited: boolean;
};

// The temperature the autopilot wants at this point of a night under way. Once a night has
// begun it runs by the clock: a restless few minutes does not send the bed back to the base
// and down again.
export function planTemperature(input: PlanInput): Plan {
  const wanted = {
    learnedF: input.learned[nightPartAt(input.progress)],
    curveF: curveOffsetF(input.progress),
    deepF: isDeepSleepStretch(input.minutesSinceSleepOnset) ? DEEP_SLEEP_OFFSET_F : 0,
    roomF: roomOffsetF(input.roomAtSleepOnsetF, input.roomNowF),
  };
  // Each part in turn gets what is left of the limit, so the first ones are cut last
  let total = 0;
  const allow = (partF: number): number => {
    const allowedTotal = clamp(total + partF, MAX_OFFSET_F);
    const allowedF = allowedTotal - total;
    total = allowedTotal;
    return allowedF;
  };
  const parts = { learnedF: allow(wanted.learnedF), curveF: allow(wanted.curveF), deepF: allow(wanted.deepF), roomF: allow(wanted.roomF) };
  const isLimited = parts.learnedF !== wanted.learnedF || parts.curveF !== wanted.curveF || parts.deepF !== wanted.deepF
    || parts.roomF !== wanted.roomF;
  const baseF = Math.round(input.baseTemperatureF);
  const targetTemperatureF = Math.min(MAX_TEMPERATURE_F, Math.max(MIN_TEMPERATURE_F, baseF + Math.round(total)));
  return { targetTemperatureF, offsetF: targetTemperatureF - baseF, parts, isLimited };
}

// The next temperature on the way from where the bed is set to where the plan wants it, moving
// no more than one step
export function stepToward(currentTemperatureF: number, wantedTemperatureF: number): number {
  return currentTemperatureF + clamp(wantedTemperatureF - currentTemperatureF, MAX_STEP_F);
}
