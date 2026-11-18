// What the schedule wants a side set to at a given time of a night: the bed-on temperature, or
// the latest temperature change that has come up since. The autopilot adds its offset to this.
// Keep this file free of runtime imports so tests can load it without a Pod environment.
import type { DailySchedule, Time } from '../db/schedulesSchema.js';
import type { SleepKind } from './nightRecord.js';

const MINUTES_PER_DAY = 24 * 60;
const toMinutes = (time: Time) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
// Minutes from bedtime to a time later that night (past midnight counts as later)
const minutesAfterBedtime = (time: Time, bedtime: Time) => (toMinutes(time) - toMinutes(bedtime) + MINUTES_PER_DAY) % MINUTES_PER_DAY;

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

// Falling asleep up to this long before the scheduled bedtime still counts as the night
const EARLY_NIGHT_MINUTES = 3 * 60;
// With no schedule to go by, sleep that begins between these hours is a nap
const NAP_HOURS_WITHOUT_SCHEDULE = { from: 9, until: 19 };

// Whether a sleep that began at `onsetClock` is the night's sleep or a nap. It is the night when
// it begins between a little before the scheduled bedtime and the wake-up time.
export function classifySleep(onsetClock: Time, night: Pick<DailySchedule, 'power' | 'alarm'> | undefined): SleepKind {
  if (!night?.power.enabled) {
    const hour = toMinutes(onsetClock) / 60;
    return hour >= NAP_HOURS_WITHOUT_SCHEDULE.from && hour < NAP_HOURS_WITHOUT_SCHEDULE.until ? 'nap' : 'night';
  }
  const minutesSinceBedtime = minutesAfterBedtime(onsetClock, night.power.on);
  const nightMinutes = minutesAfterBedtime(night.alarm.time, night.power.on);
  return minutesSinceBedtime < nightMinutes || minutesSinceBedtime >= MINUTES_PER_DAY - EARLY_NIGHT_MINUTES ? 'night' : 'nap';
}
