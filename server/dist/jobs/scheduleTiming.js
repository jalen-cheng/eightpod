
!function(){try{var e="undefined"!=typeof window?window:"undefined"!=typeof global?global:"undefined"!=typeof globalThis?globalThis:"undefined"!=typeof self?self:{},n=(new e.Error).stack;n&&(e._sentryDebugIds=e._sentryDebugIds||{},e._sentryDebugIds[n]="f88841e5-5463-5995-8d85-bd7be6fa7f25")}catch(e){}}();
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
//# sourceMappingURL=scheduleTiming.js.map
//# debugId=f88841e5-5463-5995-8d85-bd7be6fa7f25
