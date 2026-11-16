
!function(){try{var e="undefined"!=typeof window?window:"undefined"!=typeof global?global:"undefined"!=typeof globalThis?globalThis:"undefined"!=typeof self?self:{},n=(new e.Error).stack;n&&(e._sentryDebugIds=e._sentryDebugIds||{},e._sentryDebugIds[n]="ce46da8c-f5ab-5235-8106-cd2bdf6bcb07")}catch(e){}}();
export const DAYS_OF_WEEK = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const MINUTES_PER_DAY = 24 * 60;
// Returns the HH:mm that is `minutes` before `time`, wrapping past midnight ("00:10" - 30 -> "23:40")
export function subtractMinutesFromTime(time, minutes) {
    const [hour, minute] = time.split(':').map(Number);
    const totalMinutes = (((hour * 60 + minute - minutes) % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
    const pad = (value) => String(value).padStart(2, '0');
    return `${pad(Math.floor(totalMinutes / 60))}:${pad(totalMinutes % 60)}`;
}
export function getDayOfWeekIndex(day) {
    return DAYS_OF_WEEK.indexOf(day);
}
// Times before power-on belong to the following day, including after noon.
export function getDayIndexForSchedule(scheduleDay, time, powerOnTime) {
    const dayIndex = getDayOfWeekIndex(scheduleDay);
    return time < powerOnTime ? (dayIndex + 1) % DAYS_OF_WEEK.length : dayIndex;
}
// The next moment a side's weekly schedule will sound an alarm, or undefined when no alarm is on.
// `now` must already be in the Pod's time zone.
export function findNextScheduledAlarm(sideSchedule, now) {
    let nextAlarm;
    for (const day of DAYS_OF_WEEK) {
        const { alarm, power } = sideSchedule[day];
        if (!power.enabled || !alarm.enabled)
            continue;
        const [hour, minute] = alarm.time.split(':').map(Number);
        const dayIndex = getDayIndexForSchedule(day, alarm.time, power.on);
        const candidate = now.clone().day(dayIndex).hour(hour).minute(minute).second(0).millisecond(0);
        if (candidate.isSameOrBefore(now))
            candidate.add(7, 'days');
        if (!nextAlarm || candidate.isBefore(nextAlarm))
            nextAlarm = candidate;
    }
    return nextAlarm;
}
//# sourceMappingURL=scheduleTiming.js.map
//# debugId=ce46da8c-f5ab-5235-8106-cd2bdf6bcb07
