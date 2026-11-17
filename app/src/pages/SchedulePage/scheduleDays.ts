import _ from 'lodash';
import { DayOfWeek } from '@api/schedulesSchema.ts';

// Monday first, the order days are listed in a sentence
export const WEEK_ORDER: DayOfWeek[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
export const WEEKDAYS = WEEK_ORDER.slice(0, 5);
export const WEEKEND = WEEK_ORDER.slice(5);

export const SHORT_DAY_NAMES: Record<DayOfWeek, string> = {
  monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed', thursday: 'Thu', friday: 'Fri', saturday: 'Sat', sunday: 'Sun',
};

export const DAY_NAMES: Record<DayOfWeek, string> = {
  monday: 'Monday', tuesday: 'Tuesday', wednesday: 'Wednesday', thursday: 'Thursday',
  friday: 'Friday', saturday: 'Saturday', sunday: 'Sunday',
};

const isSameSet = (days: DayOfWeek[], otherDays: DayOfWeek[]) => _.isEqual(_.sortBy(days), _.sortBy(otherDays));

// Names a set of days the way a person would: "every day", "weekdays", "the weekend", "Mon, Wed"
export function describeDays(days: DayOfWeek[]): string {
  if (isSameSet(days, WEEK_ORDER)) return 'every day';
  if (isSameSet(days, WEEKDAYS)) return 'weekdays';
  if (isSameSet(days, WEEKEND)) return 'the weekend';
  if (days.length === 1) return DAY_NAMES[days[0]];
  return WEEK_ORDER.filter(day => days.includes(day)).map(day => SHORT_DAY_NAMES[day]).join(', ');
}
