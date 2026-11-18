// A night has a bedtime and a wake-up time. The wake-up time is stored as the alarm's time,
// whether or not the alarm is switched on to vibrate, and the bed's off time is never chosen:
// it follows the wake-up time.
// WARNING! This file is shared with the app (app/src/api/automaticOffTime.ts), so it must not
// import anything.
// The bed turns off this long after the wake-up time. A one-off alarm moves it: this long after
// that alarm goes off (see scheduleAlarmOverride in jobs/alarmScheduler.ts).

!function(){try{var e="undefined"!=typeof window?window:"undefined"!=typeof global?global:"undefined"!=typeof globalThis?globalThis:"undefined"!=typeof self?self:{},n=(new e.Error).stack;n&&(e._sentryDebugIds=e._sentryDebugIds||{},e._sentryDebugIds[n]="87b59ca0-b28c-57b1-8b1d-164ebd9d71df")}catch(e){}}();
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
const CLOCK_TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
// A night shorter than this is a mistake, and one longer leaves no gap before the next
const MIN_NIGHT_MINUTES = 60;
const MAX_NIGHT_MINUTES = 23 * MINUTES_PER_HOUR;
// True when the wake-up time is a sensible distance after the bed-on time: 1 to 23 hours.
// Outside that, the off time (30 minutes after waking) lands on the wrong side of the bed-on time.
export function isNightLengthValid(bedtime, wakeTime) {
    if (!CLOCK_TIME.test(bedtime) || !CLOCK_TIME.test(wakeTime))
        return false;
    const toMinutes = (time) => Number(time.slice(0, 2)) * MINUTES_PER_HOUR + Number(time.slice(3, 5));
    const nightMinutes = (toMinutes(wakeTime) - toMinutes(bedtime) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
    return nightMinutes >= MIN_NIGHT_MINUTES && nightMinutes <= MAX_NIGHT_MINUTES;
}
// Sets a night's off time from its wake-up time. Used on every write: whatever off time was
// sent, the wake-up time (the alarm's time, alarm on or off) decides it. Changes the night in
// place and returns it.
export function applyAutomaticOffTime(night) {
    night.power.off = offTimeAfterAlarm(night.alarm.time);
    return night;
}
// For nights saved before there was a wake-up time, run once when the schedules are loaded.
// With the alarm on, the alarm's time already is the wake-up time. With it off, the only time
// worth keeping is the off time, so the wake-up time is taken from that. Then the rule above
// holds for every night, and this changes nothing on later loads.
export function adoptSavedOffTime(night) {
    if (!night.alarm.enabled && night.power.off !== offTimeAfterAlarm(night.alarm.time)) {
        night.alarm.time = addMinutesToTime(night.power.off, -OFF_AFTER_ALARM_MINUTES);
    }
    return applyAutomaticOffTime(night);
}
//# sourceMappingURL=automaticOffTime.js.map
//# debugId=87b59ca0-b28c-57b1-8b1d-164ebd9d71df
