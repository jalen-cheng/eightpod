import moment from 'moment-timezone';
import { Time } from '@api/schedulesSchema.ts';

// When the bed turns off with the alarm, this is how long after the alarm time it turns off
// anyway if the alarm is never dismissed. Longer than the longest alarm.
export const OFF_AFTER_ALARM_MINUTES = 60;

export const addMinutes = (time: Time, minutes: number): Time => moment(time, 'HH:mm').add(minutes, 'minutes').format('HH:mm');

// The off time to save for a night: an hour after the alarm while the bed turns off with the
// alarm (a fallback for an alarm nobody dismisses), otherwise the time already chosen.
export const offTimeFor = (turnsOffWithAlarm: boolean, alarmTime: Time, chosenOffTime: Time): Time => (
  turnsOffWithAlarm ? addMinutes(alarmTime, OFF_AFTER_ALARM_MINUTES) : chosenOffTime
);
