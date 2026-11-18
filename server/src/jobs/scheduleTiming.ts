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

// The schedule day a moment belongs to. A night is filed under the day it starts on, so a
// morning alarm belongs to the day before: anything before noon counts as the previous day.
// The exception is a night that itself starts after midnight (bed on at 00:30): given the side's
// schedule, a morning moment at or after that day's bed-on time belongs to its own day.
export function findNightDay(at: moment.Moment, sideSchedule?: SideSchedule): DayOfWeek {
  const calendarDay = at.format('dddd').toLowerCase() as DayOfWeek;
  const bedOn = sideSchedule?.[calendarDay]?.power;
  const clock = at.format('HH:mm');
  if (bedOn?.enabled && bedOn.on < '12:00' && clock < '12:00' && bedOn.on <= clock) return calendarDay;
  return at.clone().subtract(12, 'hours').format('dddd').toLowerCase() as DayOfWeek;
}

const DEFAULT_ON_MINUTES = 12 * 60;
// Kept on a little past the off time, so the Pod's own timer never beats the off job
const ON_MARGIN_MINUTES = 30;

// How long the Pod is told to stay on when the schedule turns a side on. The Pod switches itself
// off when this runs out, so it must outlast the night: 12 hours, or longer for a longer night.
export function getScheduledOnSeconds(onTime: string, offTime: string): number {
  const toMinutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
  const nightMinutes = (toMinutes(offTime) - toMinutes(onTime) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  return Math.max(DEFAULT_ON_MINUTES, nightMinutes + ON_MARGIN_MINUTES) * 60;
}

// The scheduled alarm a one-off alarm stands in for: the side's next scheduled alarm, when the
// two are no more than `withinHours` apart. An alarm set for 6:00 replaces the 8:45 of the same
// morning; an afternoon nap alarm leaves tomorrow morning's alone, and so does one set in the
// evening for the next evening.
export function findAlarmReplacedByOneOff(
  sideSchedule: SideSchedule,
  now: moment.Moment,
  oneOffFiresAt: moment.Moment,
  withinHours: number,
): moment.Moment | undefined {
  const nextScheduled = findNextScheduledAlarm(sideSchedule, now);
  if (!nextScheduled) return undefined;
  const hoursApart = Math.abs(nextScheduled.diff(oneOffFiresAt, 'minutes')) / 60;
  return hoursApart <= withinHours ? nextScheduled : undefined;
}

// Until when scheduled alarms stay quiet once a one-off alarm is set: until the one-off itself,
// or the scheduled alarm it replaces, or the end of a skip that is still running, whichever is last.
export function findHoldBackUntil(
  oneOffFiresAt: moment.Moment,
  replacedAlarm: moment.Moment | undefined,
  skipEndsAt: moment.Moment | undefined,
  now: moment.Moment,
): moment.Moment {
  const candidates = [oneOffFiresAt, ...(replacedAlarm ? [replacedAlarm] : [])];
  if (skipEndsAt?.isAfter(now)) candidates.push(skipEndsAt);
  return moment.max(candidates);
}

// "9:05", "09:05:00", or either inside a longer text such as a full date
const CLOCK_WITH_COLON = /(\d{1,2}):(\d{2})(?::\d{2})?\s*(a\.?m|p\.?m)?/i;
// "9.05 pm". A dot only counts with AM or PM after it, so a date such as 16.11.2026 is not a time
const CLOCK_WITH_DOT = /(\d{1,2})\.(\d{2})\s*(a\.?m|p\.?m)/i;
// "9 pm"
const CLOCK_HOUR_ONLY = /\b(\d{1,2})\s*(a\.?m|p\.?m)/i;

// Reads a time of day however a phone writes it ("21:30", "9:30 PM", "Nov 16, 2026 at 9:30 PM",
// "2026-11-16T21:30:00-08:00", "9 pm") and returns it as HH:mm, or undefined if there is none.
// Phones on a 12-hour clock send AM/PM even when asked for 24-hour time.
export function parseClockTime(text: string): Time | undefined {
  const withMinutes = CLOCK_WITH_COLON.exec(text) ?? CLOCK_WITH_DOT.exec(text);
  const hourOnly = withMinutes ? null : CLOCK_HOUR_ONLY.exec(text);
  const hourText = withMinutes?.[1] ?? hourOnly?.[1];
  if (hourText === undefined) return undefined;
  const meridiem = (withMinutes?.[3] ?? hourOnly?.[2])?.toLowerCase();
  const minute = Number(withMinutes?.[2] ?? 0);
  let hour = Number(hourText);
  if (meridiem) {
    if (hour < 1 || hour > 12) return undefined;
    const isAfternoon = meridiem.startsWith('p');
    hour = (hour % 12) + (isAfternoon ? 12 : 0);
  }
  if (hour > 23 || minute > 59) return undefined;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

// Minutes from bedtime to a time later that night (past midnight counts as later)
export function minutesAfterBedtime(time: Time, bedtime: Time): number {
  const toMinutes = (clockTime: Time) => {
    const [hour, minute] = clockTime.split(':').map(Number);
    return hour * 60 + minute;
  };
  return (toMinutes(time) - toMinutes(bedtime) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
}

// How long after a night's off time its alarm goes off, in minutes. Zero or less: at or before it.
export function minutesAlarmIsAfterOff(alarmTime: Time, power: { on: Time; off: Time }): number {
  return minutesAfterBedtime(alarmTime, power.on) - minutesAfterBedtime(power.off, power.on);
}
