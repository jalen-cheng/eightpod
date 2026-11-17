// A night has a bedtime and a wake-up time. The wake-up time is stored as the alarm's time,
// whether or not the alarm is switched on to vibrate, and the bed's off time is never chosen:
// it follows the wake-up time.
// WARNING! This file is shared with the app (app/src/api/automaticOffTime.ts), so it must not
// import anything.
// The bed turns off this long after the wake-up time. A one-off alarm moves it: this long after
// that alarm goes off (see scheduleAlarmOverride in jobs/alarmScheduler.ts).

!function(){try{var e="undefined"!=typeof window?window:"undefined"!=typeof global?global:"undefined"!=typeof globalThis?globalThis:"undefined"!=typeof self?self:{},n=(new e.Error).stack;n&&(e._sentryDebugIds=e._sentryDebugIds||{},e._sentryDebugIds[n]="d789e58d-e949-5091-8dd0-59ca9915041d")}catch(e){}}();
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
// Keeps a night's off time OFF_AFTER_ALARM_MINUTES after its wake-up time. Changes the night in
// place and returns it.
// - Alarm on: the alarm's time is the wake-up time, and the off time follows it.
// - Alarm off: nights saved before there was a wake-up time only have an off time worth keeping,
//   so the wake-up time is taken from it. Once the two agree this changes nothing.
export function applyAutomaticOffTime(night) {
    if (night.alarm.enabled) {
        night.power.off = offTimeAfterAlarm(night.alarm.time);
    }
    else if (night.power.off !== offTimeAfterAlarm(night.alarm.time)) {
        night.alarm.time = addMinutesToTime(night.power.off, -OFF_AFTER_ALARM_MINUTES);
    }
    return night;
}
//# sourceMappingURL=automaticOffTime.js.map
//# debugId=d789e58d-e949-5091-8dd0-59ca9915041d
