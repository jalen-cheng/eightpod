
!function(){try{var e="undefined"!=typeof window?window:"undefined"!=typeof global?global:"undefined"!=typeof globalThis?globalThis:"undefined"!=typeof self?self:{},n=(new e.Error).stack;n&&(e._sentryDebugIds=e._sentryDebugIds||{},e._sentryDebugIds[n]="340dab5c-e7d7-51e4-9e6b-3e48f5bd8850")}catch(e){}}();
const MINUTES_PER_DAY = 24 * 60;
const toMinutes = (time) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
// Minutes from bedtime to a time later that night (past midnight counts as later)
const minutesAfterBedtime = (time, bedtime) => (toMinutes(time) - toMinutes(bedtime) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
export function findScheduledTemperatureF(night, clock) {
    const minutesIntoNight = minutesAfterBedtime(clock, night.power.on);
    let latestMinutes = -1;
    let temperatureF = night.power.onTemperature;
    for (const [time, changeTemperatureF] of Object.entries(night.temperatures)) {
        const changeMinutes = minutesAfterBedtime(time, night.power.on);
        if (changeMinutes <= minutesIntoNight && changeMinutes > latestMinutes) {
            latestMinutes = changeMinutes;
            temperatureF = changeTemperatureF;
        }
    }
    return temperatureF;
}
// Falling asleep up to this long before the scheduled bedtime still counts as the night
const EARLY_NIGHT_MINUTES = 3 * 60;
// With no schedule to go by, sleep that begins between these hours is a nap
const NAP_HOURS_WITHOUT_SCHEDULE = { from: 9, until: 19 };
// Whether a sleep that began at `onsetClock` is the night's sleep or a nap. It is the night when
// it begins between a little before the scheduled bedtime and the wake-up time.
export function classifySleep(onsetClock, night) {
    if (!night?.power.enabled) {
        const hour = toMinutes(onsetClock) / 60;
        return hour >= NAP_HOURS_WITHOUT_SCHEDULE.from && hour < NAP_HOURS_WITHOUT_SCHEDULE.until ? 'nap' : 'night';
    }
    const minutesSinceBedtime = minutesAfterBedtime(onsetClock, night.power.on);
    const nightMinutes = minutesAfterBedtime(night.alarm.time, night.power.on);
    return minutesSinceBedtime < nightMinutes || minutesSinceBedtime >= MINUTES_PER_DAY - EARLY_NIGHT_MINUTES ? 'night' : 'nap';
}
//# sourceMappingURL=scheduledBase.js.map
//# debugId=340dab5c-e7d7-51e4-9e6b-3e48f5bd8850
