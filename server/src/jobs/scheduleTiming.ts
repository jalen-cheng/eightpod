import type { DayOfWeek, Time } from '../db/schedulesSchema.js';

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
