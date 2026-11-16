import moment from 'moment-timezone';
import type { DayOfWeek, SideSchedule, Time } from '../db/schedulesSchema.js';

export const DAYS_OF_WEEK = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

const MINUTES_PER_DAY = 24 * 60;

// Returns the HH:mm that is `minutes` before `time`, wrapping past midnight ("00:10" - 30 -> "23:40")
export function subtractMinutesFromTime(time: Time, minutes: number): Time {
  const [hour, minute] = time.split(':').map(Number);
  const totalMinutes = (((hour * 60 + minute - minutes) % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${pad(Math.floor(totalMinutes / 60))}:${pad(totalMinutes % 60)}`;
}

export function getDayOfWeekIndex(day: DayOfWeek): number {
  return DAYS_OF_WEEK.indexOf(day);
}

// Times before power-on belong to the following day, including after noon.
export function getDayIndexForSchedule(scheduleDay: DayOfWeek, time: Time, powerOnTime: Time): number {
  const dayIndex = getDayOfWeekIndex(scheduleDay);
  return time < powerOnTime ? (dayIndex + 1) % DAYS_OF_WEEK.length : dayIndex;
}

// The next moment a side's weekly schedule will sound an alarm, or undefined when no alarm is on.
// `now` must already be in the Pod's time zone.
export function findNextScheduledAlarm(sideSchedule: SideSchedule, now: moment.Moment): moment.Moment | undefined {
  let nextAlarm: moment.Moment | undefined;
  for (const day of DAYS_OF_WEEK as DayOfWeek[]) {
    const { alarm, power } = sideSchedule[day];
    if (!power.enabled || !alarm.enabled) continue;
    const [hour, minute] = alarm.time.split(':').map(Number);
    const dayIndex = getDayIndexForSchedule(day, alarm.time, power.on);
    const candidate = now.clone().day(dayIndex).hour(hour).minute(minute).second(0).millisecond(0);
    if (candidate.isSameOrBefore(now)) candidate.add(7, 'days');
    if (!nextAlarm || candidate.isBefore(nextAlarm)) nextAlarm = candidate;
  }
  return nextAlarm;
}
