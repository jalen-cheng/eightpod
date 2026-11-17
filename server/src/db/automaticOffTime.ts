// When a night has an alarm, the bed's off time is not chosen: it follows the alarm.
// WARNING! This file is shared with the app (app/src/api/automaticOffTime.ts), so it must not
// import anything.

// The bed turns off this long after the alarm time. A one-off alarm moves it: this long after
// that alarm goes off (see scheduleAlarmOverride in jobs/alarmScheduler.ts).
export const OFF_AFTER_ALARM_MINUTES = 30;

const MINUTES_PER_HOUR = 60;
const MINUTES_PER_DAY = 24 * MINUTES_PER_HOUR;

// "08:45" plus 30 is "09:15"; wraps past midnight in either direction
export function addMinutesToTime(time: string, minutes: number): string {
  const [hour, minute] = time.split(':').map(Number);
  const total = (((hour * MINUTES_PER_HOUR + minute + minutes) % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  const padded = (value: number) => String(value).padStart(2, '0');
  return `${padded(Math.floor(total / MINUTES_PER_HOUR))}:${padded(total % MINUTES_PER_HOUR)}`;
}

export const offTimeAfterAlarm = (alarmTime: string): string => addMinutesToTime(alarmTime, OFF_AFTER_ALARM_MINUTES);

type NightWithAlarm = {
  alarm: { enabled: boolean; time: string };
  power: { off: string };
};

// Sets a night's off time from its alarm when the alarm is on. A night without an alarm keeps
// the off time that was chosen for it. Changes the night in place and returns it.
export function applyAutomaticOffTime<Night extends NightWithAlarm>(night: Night): Night {
  if (night.alarm.enabled) night.power.off = offTimeAfterAlarm(night.alarm.time);
  return night;
}
