import { DayOfWeek } from '@api/schedulesSchema.ts';

// Monday first, the order days are listed in a sentence
export const WEEK_ORDER: DayOfWeek[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

export const SHORT_DAY_NAMES: Record<DayOfWeek, string> = {
  monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed', thursday: 'Thu', friday: 'Fri', saturday: 'Sat', sunday: 'Sun',
};

export const DAY_NAMES: Record<DayOfWeek, string> = {
  monday: 'Monday', tuesday: 'Tuesday', wednesday: 'Wednesday', thursday: 'Thursday',
  friday: 'Friday', saturday: 'Saturday', sunday: 'Sunday',
};
