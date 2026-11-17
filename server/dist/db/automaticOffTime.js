// When a night has an alarm, the bed's off time is not chosen: it follows the alarm.
// WARNING! This file is shared with the app (app/src/api/automaticOffTime.ts), so it must not
// import anything.
// The bed turns off this long after the alarm time. A one-off alarm moves it: this long after
// that alarm goes off (see scheduleAlarmOverride in jobs/alarmScheduler.ts).

!function(){try{var e="undefined"!=typeof window?window:"undefined"!=typeof global?global:"undefined"!=typeof globalThis?globalThis:"undefined"!=typeof self?self:{},n=(new e.Error).stack;n&&(e._sentryDebugIds=e._sentryDebugIds||{},e._sentryDebugIds[n]="f2cfd15d-e822-518d-a8d1-2f480112c049")}catch(e){}}();
export const OFF_AFTER_ALARM_MINUTES = 30;
const MINUTES_PER_HOUR = 60;
const MINUTES_PER_DAY = 24 * MINUTES_PER_HOUR;
// "08:45" plus 30 is "09:15"; wraps past midnight in either direction
export function addMinutesToTime(time, minutes) {
    const [hour, minute] = time.split(':').map(Number);
    const total = (((hour * MINUTES_PER_HOUR + minute + minutes) % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
    const padded = (value) => String(value).padStart(2, '0');
    return `${padded(Math.floor(total / MINUTES_PER_HOUR))}:${padded(total % MINUTES_PER_HOUR)}`;
}
export const offTimeAfterAlarm = (alarmTime) => addMinutesToTime(alarmTime, OFF_AFTER_ALARM_MINUTES);
// Sets a night's off time from its alarm when the alarm is on. A night without an alarm keeps
// the off time that was chosen for it. Changes the night in place and returns it.
export function applyAutomaticOffTime(night) {
    if (night.alarm.enabled)
        night.power.off = offTimeAfterAlarm(night.alarm.time);
    return night;
}
//# sourceMappingURL=automaticOffTime.js.map
//# debugId=f2cfd15d-e822-518d-a8d1-2f480112c049
