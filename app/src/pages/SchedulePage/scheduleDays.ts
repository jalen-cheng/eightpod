import _ from 'lodash';
import { DayOfWeek, SideSchedule } from '@api/schedulesSchema.ts';

// Monday first, the order days are shown in
export const WEEK_ORDER: DayOfWeek[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
export const WEEKDAYS = WEEK_ORDER.slice(0, 5);
export const WEEKEND = WEEK_ORDER.slice(5);

// How the week is split into schedules:
// - everyDay: one schedule for all seven days
// - weekdaysWeekend: one for Monday to Friday, one for Saturday and Sunday
// - eachDay: every day has its own
export type DayMode = 'everyDay' | 'weekdaysWeekend' | 'eachDay';

const SHORT_NAMES: Record<DayOfWeek, string> = {
  monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed', thursday: 'Thu', friday: 'Fri', saturday: 'Sat', sunday: 'Sun',
};

const isSameSet = (days: DayOfWeek[], otherDays: DayOfWeek[]) => _.isEqual(_.sortBy(days), _.sortBy(otherDays));
const haveSameSchedule = (sideSchedule: SideSchedule, days: DayOfWeek[]) => (
  days.every(day => _.isEqual(sideSchedule[day], sideSchedule[days[0]]))
);

// The days that are edited and saved together with `day` in a mode
export function getDayGroup(day: DayOfWeek, dayMode: DayMode): DayOfWeek[] {
  if (dayMode === 'everyDay') return WEEK_ORDER;
  if (dayMode === 'weekdaysWeekend') return WEEKEND.includes(day) ? WEEKEND : WEEKDAYS;
  return [day];
}

// The simplest mode that matches what is saved, so the page opens showing the week as it is
export function detectDayMode(sideSchedule: SideSchedule): DayMode {
  if (haveSameSchedule(sideSchedule, WEEK_ORDER)) return 'everyDay';
  if (haveSameSchedule(sideSchedule, WEEKDAYS) && haveSameSchedule(sideSchedule, WEEKEND)) return 'weekdaysWeekend';
  return 'eachDay';
}

// Names a set of days the way a person would: "every day", "weekdays", "the weekend", "Mon, Wed"
export function describeDays(days: DayOfWeek[]): string {
  if (isSameSet(days, WEEK_ORDER)) return 'every day';
  if (isSameSet(days, WEEKDAYS)) return 'weekdays';
  if (isSameSet(days, WEEKEND)) return 'the weekend';
  return WEEK_ORDER.filter(day => days.includes(day)).map(day => SHORT_NAMES[day]).join(', ');
}
