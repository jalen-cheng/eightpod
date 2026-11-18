
!function(){try{var e="undefined"!=typeof window?window:"undefined"!=typeof global?global:"undefined"!=typeof globalThis?globalThis:"undefined"!=typeof self?self:{},n=(new e.Error).stack;n&&(e._sentryDebugIds=e._sentryDebugIds||{},e._sentryDebugIds[n]="2c8f5343-7e45-5956-8606-09d2cf4f5fda")}catch(e){}}();
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
//# sourceMappingURL=scheduledBase.js.map
//# debugId=2c8f5343-7e45-5956-8606-09d2cf4f5fda
