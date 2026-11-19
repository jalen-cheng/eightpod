// Tells a body from a thing left on the bed, by how hard the piezo sensor is shaken. The
// capacitive sensors cannot: a laptop raises them much as a person does. But an empty bed only
// hums with the Pod's own pumps, with or without a laptop on it, while a body knocks the sensor
// with every heartbeat and breath even when it lies still. Measured on one Pod 5 (18 Nov 2026),
// as the swing of a quiet second: empty, or under a laptop, 13,000 to 24,000; one person lying
// still, 1,100,000 to 2,100,000 on their own side and 225,000 to 440,000 on the other side.
// Keep this file free of runtime imports so tests can load it without a Pod environment.

// A minute has a body in it when its quiet second swings at least this many times the empty
// bed's. Far above anything an empty bed showed, far below a person on either side.
export const BODY_SWING_RATIO = 5;
// The empty bed's level is measured once per Pod, when it is set up, and has to fall in this
// range to be believed: a few times either way of what an empty bed read on the test Pod. A
// level under it is a sensor sending next to nothing; one over it is a bed that was not empty.
export const MIN_EMPTY_SWING = 5_000;
export const MAX_EMPTY_SWING = 50_000;
// It comes from this many of the newest minutes with nothing on either side
const EMPTY_MINUTES_KEPT = 120;
// It is not trusted before this many have been seen
const MIN_EMPTY_MINUTES = 10;
// Their lower quartile is taken: whatever else happens in an empty minute (someone sitting on
// the edge, the bed priming) only ever makes it louder
const EMPTY_LEVEL_FRACTION = 0.25;

// Adds an empty minute's quiet swing to the ones kept, newest last
export function addEmptyMinute(quietSwings: number[], quietSwing: number): number[] {
  return [...quietSwings, quietSwing].slice(-EMPTY_MINUTES_KEPT);
}

// The swing of a quiet second on the empty bed, once enough empty minutes have been seen.
// Undefined while there are too few, and when what they add up to is outside the range an
// empty bed can read: the measuring then goes on until it is not.
export function findEmptySwing(quietSwings: number[]): number | undefined {
  if (quietSwings.length < MIN_EMPTY_MINUTES) return undefined;
  const sorted = [...quietSwings].sort((first, second) => first - second);
  const level = sorted[Math.floor(sorted.length * EMPTY_LEVEL_FRACTION)];
  return level >= MIN_EMPTY_SWING && level <= MAX_EMPTY_SWING ? level : undefined;
}

// Whether a minute's quiet second shows a body on the bed. Undefined when that cannot be said:
// the sensor sent too little that minute, or the empty bed's level is not known yet.
export function isBodyFelt(quietSwing: number | undefined, emptySwing: number | undefined): boolean | undefined {
  if (quietSwing === undefined || emptySwing === undefined || emptySwing <= 0) return undefined;
  return quietSwing >= emptySwing * BODY_SWING_RATIO;
}
