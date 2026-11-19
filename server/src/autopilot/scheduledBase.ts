// What the schedule wants a side set to at a given time of a night: the bed-on temperature, or
// the latest temperature change that has come up since. The autopilot adds its offset to this.
// Keep this file free of runtime imports so tests can load it without a Pod environment.
import type { DailySchedule, Time } from '../db/schedulesSchema.js';
import type { SleepKind } from './nightRecord.js';

const MINUTES_PER_DAY = 24 * 60;
const toMinutes = (time: Time) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
// Minutes from bedtime to a time later that night (past midnight counts as later)
const minutesAfterBedtime = (time: Time, bedtime: Time) => (toMinutes(time) - toMinutes(bedtime) + MINUTES_PER_DAY) % MINUTES_PER_DAY;

// Whether a time falls between a night's bed-on and bed-off times
export function isWithinScheduledNight(night: Pick<DailySchedule, 'power'>, clock: Time): boolean {
  return minutesAfterBedtime(clock, night.power.on) < minutesAfterBedtime(night.power.off, night.power.on);
}

export function findScheduledTemperatureF(night: Pick<DailySchedule, 'power' | 'temperatures'>, clock: Time): number {
  const minutesIntoNight = minutesAfterBedtime(clock, night.power.on);
  let latestMinutes = -1;
  let temperatureF = night.power.onTemperature;
  for (const [time, changeTemperatureF] of Object.entries(night.temperatures)) {
    const changeMinutes = minutesAfterBedtime(time, night.power.on);
    if (changeMinutes <= minutesIntoNight && changeMinutes > latestMinutes) {
      latestMinutes = changeMinutes;
      temperatureF = changeTemperatureF;
    }
  }
  return temperatureF;
}

export type NightBaseInput = {
  // What the schedule wants now; undefined at an hour it does not cover
  scheduledNowF?: number;
  // What the schedule wanted when sleep began, if it covered that hour
  scheduledAtOnsetF?: number;
  // What the bed was set to when sleep began
  temperatureAtOnsetF: number;
  // True when the sleeper had set the bed to something other than the schedule's temperature
  // before falling asleep
  isOnsetTemperatureOwn: boolean;
  // The base in use until now
  lastBaseF?: number;
};

// The temperature a night's offset is counted from:
//   - a temperature the sleeper set before falling asleep, for as long as the schedule still
//     wants what it wanted then: the night does not undo their choice
//   - otherwise what the schedule wants now
//   - at an hour the schedule does not cover, whatever it was last, so the base never jumps
//     back to an earlier temperature in the middle of a night
export function findNightBaseF(input: NightBaseInput): number {
  if (input.scheduledNowF === undefined) return input.lastBaseF ?? input.temperatureAtOnsetF;
  const isScheduleUnchanged = input.scheduledAtOnsetF !== undefined && input.scheduledNowF === input.scheduledAtOnsetF;
  return input.isOnsetTemperatureOwn && isScheduleUnchanged ? input.temperatureAtOnsetF : input.scheduledNowF;
}

// A sleep shorter than this is a nap
export const NAP_UNDER_MINUTES = 3 * 60;

export const kindOfSleep = (minutesAsleep: number): SleepKind => (minutesAsleep < NAP_UNDER_MINUTES ? 'nap' : 'night');

// When this sleeper usually falls asleep and wakes, as clock minutes, worked out from saved nights
export type UsualSleep = { asleepMinutes: number; awakeMinutes: number };

// Falling asleep up to this long before the usual time still looks like the night
const EARLY_NIGHT_MINUTES = 3 * 60;
// With nothing else to go by, sleep that begins between these hours looks like a nap
const NAP_HOURS_WITH_NOTHING_TO_GO_BY = { from: 9, until: 19 };
// Fewer saved nights than this say too little about habit
const MIN_NIGHTS_FOR_USUAL = 3;

const middleOf = (values: number[]) => [...values].sort((first, second) => first - second)[Math.floor(values.length / 2)];

// The usual times from some nights' sleep and wake clock minutes. Bedtimes straddle midnight,
// so they are lined up from noon before the middle one is taken.
export function findUsualSleep(nights: { asleepMinutes: number; awakeMinutes: number }[]): UsualSleep | undefined {
  if (nights.length < MIN_NIGHTS_FOR_USUAL) return undefined;
  const half = MINUTES_PER_DAY / 2;
  const fromNoon = (minutes: number) => (minutes + half) % MINUTES_PER_DAY;
  return {
    asleepMinutes: (middleOf(nights.map(night => fromNoon(night.asleepMinutes))) + half) % MINUTES_PER_DAY,
    awakeMinutes: middleOf(nights.map(night => night.awakeMinutes)),
  };
}

const isWithinNight = (onsetMinutes: number, nightStartMinutes: number, nightEndMinutes: number): boolean => {
  const sinceStart = (onsetMinutes - nightStartMinutes + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  const nightMinutes = (nightEndMinutes - nightStartMinutes + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  return sinceStart < nightMinutes || sinceStart >= MINUTES_PER_DAY - EARLY_NIGHT_MINUTES;
};

// Whether a sleep that has just begun looks like the night's, so the autopilot may steer it
// from the start. Nobody can know yet how long it will last, so this goes by when it began:
// first against when this sleeper has actually been sleeping (the schedule's times are when the
// bed runs, not when anyone sleeps), then against the schedule, then by the hour. A sleep that
// does not look like the night is left alone until it has lasted too long to be a nap.
export function isNightExpected(
  onsetClock: Time,
  usual: UsualSleep | undefined,
  night: Pick<DailySchedule, 'power' | 'alarm'> | undefined,
): boolean {
  const onsetMinutes = toMinutes(onsetClock);
  if (usual) return isWithinNight(onsetMinutes, usual.asleepMinutes, usual.awakeMinutes);
  if (night?.power.enabled) return isWithinNight(onsetMinutes, toMinutes(night.power.on), toMinutes(night.alarm.time));
  const hour = onsetMinutes / 60;
  return hour < NAP_HOURS_WITH_NOTHING_TO_GO_BY.from || hour >= NAP_HOURS_WITH_NOTHING_TO_GO_BY.until;
}
