
!function(){try{var e="undefined"!=typeof window?window:"undefined"!=typeof global?global:"undefined"!=typeof globalThis?globalThis:"undefined"!=typeof self?self:{},n=(new e.Error).stack;n&&(e._sentryDebugIds=e._sentryDebugIds||{},e._sentryDebugIds[n]="8ad694da-048d-514e-b842-edd56bbe429d")}catch(e){}}();
const MINUTES_PER_DAY = 24 * 60;
const toMinutes = (time) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
// Minutes from bedtime to a time later that night (past midnight counts as later)
const minutesAfterBedtime = (time, bedtime) => (toMinutes(time) - toMinutes(bedtime) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
// Whether a time falls between a night's bed-on and bed-off times
export function isWithinScheduledNight(night, clock) {
    return minutesAfterBedtime(clock, night.power.on) < minutesAfterBedtime(night.power.off, night.power.on);
}
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
// The temperature a night's offset is counted from:
//   - a temperature the sleeper set before falling asleep, for as long as the schedule still
//     wants what it wanted then: the night does not undo their choice
//   - otherwise what the schedule wants now
//   - at an hour the schedule does not cover, whatever it was last, so the base never jumps
//     back to an earlier temperature in the middle of a night
export function findNightBaseF(input) {
    if (input.scheduledNowF === undefined)
        return input.lastBaseF ?? input.temperatureAtOnsetF;
    const isScheduleUnchanged = input.scheduledAtOnsetF !== undefined && input.scheduledNowF === input.scheduledAtOnsetF;
    return input.isOnsetTemperatureOwn && isScheduleUnchanged ? input.temperatureAtOnsetF : input.scheduledNowF;
}
// A sleep shorter than this is a nap
export const NAP_UNDER_MINUTES = 3 * 60;
export const kindOfSleep = (minutesAsleep) => (minutesAsleep < NAP_UNDER_MINUTES ? 'nap' : 'night');
// Falling asleep up to this long before the usual time still looks like the night
const EARLY_NIGHT_MINUTES = 3 * 60;
// With nothing else to go by, sleep that begins between these hours looks like a nap
const NAP_HOURS_WITH_NOTHING_TO_GO_BY = { from: 9, until: 19 };
// Fewer saved nights than this say too little about habit
const MIN_NIGHTS_FOR_USUAL = 3;
const middleOf = (values) => [...values].sort((first, second) => first - second)[Math.floor(values.length / 2)];
// The usual times from some nights' sleep and wake clock minutes. Bedtimes straddle midnight,
// so they are lined up from noon before the middle one is taken.
export function findUsualSleep(nights) {
    if (nights.length < MIN_NIGHTS_FOR_USUAL)
        return undefined;
    const half = MINUTES_PER_DAY / 2;
    const fromNoon = (minutes) => (minutes + half) % MINUTES_PER_DAY;
    return {
        asleepMinutes: (middleOf(nights.map(night => fromNoon(night.asleepMinutes))) + half) % MINUTES_PER_DAY,
        awakeMinutes: middleOf(nights.map(night => night.awakeMinutes)),
    };
}
const isWithinNight = (onsetMinutes, nightStartMinutes, nightEndMinutes) => {
    const sinceStart = (onsetMinutes - nightStartMinutes + MINUTES_PER_DAY) % MINUTES_PER_DAY;
    const nightMinutes = (nightEndMinutes - nightStartMinutes + MINUTES_PER_DAY) % MINUTES_PER_DAY;
    return sinceStart < nightMinutes || sinceStart >= MINUTES_PER_DAY - EARLY_NIGHT_MINUTES;
};
// Whether a sleep that has just begun looks like the night's, so the autopilot may steer it
// from the start. Nobody can know yet how long it will last, so this goes by when it began:
// first against when this sleeper has actually been sleeping (the schedule's times are when the
// bed runs, not when anyone sleeps), then against the schedule, then by the hour. A sleep that
// does not look like the night is left alone until it has lasted too long to be a nap.
export function isNightExpected(onsetClock, usual, night) {
    const onsetMinutes = toMinutes(onsetClock);
    if (usual)
        return isWithinNight(onsetMinutes, usual.asleepMinutes, usual.awakeMinutes);
    if (night?.power.enabled)
        return isWithinNight(onsetMinutes, toMinutes(night.power.on), toMinutes(night.alarm.time));
    const hour = onsetMinutes / 60;
    return hour < NAP_HOURS_WITH_NOTHING_TO_GO_BY.from || hour >= NAP_HOURS_WITH_NOTHING_TO_GO_BY.until;
}
//# sourceMappingURL=scheduledBase.js.map
//# debugId=8ad694da-048d-514e-b842-edd56bbe429d
