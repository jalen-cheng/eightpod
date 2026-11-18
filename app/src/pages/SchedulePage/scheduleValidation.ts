const TIME_FORMAT = /^([01]\d|2[0-3]):[0-5]\d$/;
const MINUTES_PER_DAY = 24 * 60;

// The server refuses the same nights, so the rule lives in the file both share. A relative
// path, not the @api alias, so the tests can load this file with plain Node.
export { isNightLengthValid } from '../../../../server/src/db/automaticOffTime.ts';

const toMinutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));

// Minutes from one time of day to the next time the clock shows another (past midnight counts as later)
export function minutesBetween(fromTime: string, toTime: string): number {
  return (toMinutes(toTime) - toMinutes(fromTime) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
}

// Distinct wall-clock times define a span under 24 hours, including overnight schedules.
export function isPowerScheduleDurationValid(powerOn: string, powerOff: string): boolean {
  return TIME_FORMAT.test(powerOn) && TIME_FORMAT.test(powerOff) && powerOn !== powerOff;
}

// True when a time falls between the bed-on time and the time the bed turns off
export function isTimeDuringNight(time: string, bedtime: string, offTime: string): boolean {
  return TIME_FORMAT.test(time) && minutesBetween(bedtime, time) <= minutesBetween(bedtime, offTime);
}

// True when a temperature change comes after the bed-on time and before the wake time. A change
// at or after the wake time would land on the alarm or after the bed has turned off.
export function isChangeBeforeWake(time: string, bedtime: string, wakeTime: string): boolean {
  if (!TIME_FORMAT.test(time)) return false;
  const offset = minutesBetween(bedtime, time);
  return offset > 0 && offset < minutesBetween(bedtime, wakeTime);
}

// Why a temperature change's time cannot be saved. A time outside the night is blamed on
// whichever end it is nearer: just past the wake time, or just short of the bed-on time.
// Undefined when the time is fine.
export function findChangeProblem(time: string, bedtime: string, wakeTime: string): 'notAfterBedOn' | 'notBeforeWake' | undefined {
  if (isChangeBeforeWake(time, bedtime, wakeTime)) return undefined;
  if (!TIME_FORMAT.test(time)) return 'notBeforeWake';
  return minutesBetween(time, bedtime) < minutesBetween(wakeTime, time) ? 'notAfterBedOn' : 'notBeforeWake';
}

// A free time for a new temperature change: an hour after the last one if that is still before
// the wake time, otherwise halfway between the last one and the wake time. Undefined when the
// night has no room left.
export function findNewChangeTime(lastTime: string, bedtime: string, wakeTime: string, takenTimes: string[]): string | undefined {
  const lastOffset = minutesBetween(bedtime, lastTime);
  const wakeOffset = minutesBetween(bedtime, wakeTime);
  const hourLater = lastOffset + 60;
  // Rounded down to five minutes so the time looks chosen
  const halfway = Math.floor((lastOffset + wakeOffset) / 2 / 5) * 5;
  const candidates = hourLater < wakeOffset ? [hourLater, halfway] : [halfway];
  for (const offset of candidates) {
    if (offset <= lastOffset || offset >= wakeOffset) continue;
    const total = (toMinutes(bedtime) + offset) % MINUTES_PER_DAY;
    const time = `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
    if (!takenTimes.includes(time)) return time;
  }
  return undefined;
}
