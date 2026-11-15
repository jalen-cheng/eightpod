import _ from 'lodash';
import { DayOfWeek, SideSchedule } from '@api/schedulesSchema.ts';

// Monday first, the order the day chips are shown in
export const WEEK_ORDER: DayOfWeek[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const WEEKDAYS = WEEK_ORDER.slice(0, 5);
const WEEKEND = WEEK_ORDER.slice(5);

const SHORT_NAMES: Record<DayOfWeek, string> = {
  monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed', thursday: 'Thu', friday: 'Fri', saturday: 'Sat', sunday: 'Sun',
};

const isSameSet = (days: DayOfWeek[], otherDays: DayOfWeek[]) => _.isEqual(_.sortBy(days), _.sortBy(otherDays));

// Every day whose saved schedule is identical to the given day's, including that day
export function findDaysWithSameSchedule(sideSchedule: SideSchedule, day: DayOfWeek): DayOfWeek[] {
  return WEEK_ORDER.filter(otherDay => _.isEqual(sideSchedule[otherDay], sideSchedule[day]));
}

// Names a set of days the way a person would: "every day", "weekdays", "the weekend", "Mon, Wed"
export function describeDays(days: DayOfWeek[]): string {
  if (isSameSet(days, WEEK_ORDER)) return 'every day';
  if (isSameSet(days, WEEKDAYS)) return 'weekdays';
  if (isSameSet(days, WEEKEND)) return 'the weekend';
  return WEEK_ORDER.filter(day => days.includes(day)).map(day => SHORT_NAMES[day]).join(', ');
}
