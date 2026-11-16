
!function(){try{var e="undefined"!=typeof window?window:"undefined"!=typeof global?global:"undefined"!=typeof globalThis?globalThis:"undefined"!=typeof self?self:{},n=(new e.Error).stack;n&&(e._sentryDebugIds=e._sentryDebugIds||{},e._sentryDebugIds[n]="86702dfd-fa10-538a-beff-a802074c1ab8")}catch(e){}}();
import { copyFileSync, existsSync, writeFileSync } from 'fs';
import { convertFromEvenSpreadF } from './temperatureCurve.js';
const convertDailySchedule = (dailySchedule) => ({
    ...dailySchedule,
    temperatures: Object.fromEntries(Object.entries(dailySchedule.temperatures).map(([time, temperatureF]) => [time, convertFromEvenSpreadF(temperatureF)])),
    power: { ...dailySchedule.power, onTemperature: convertFromEvenSpreadF(dailySchedule.power.onTemperature) },
    alarm: { ...dailySchedule.alarm, alarmTemperature: convertFromEvenSpreadF(dailySchedule.alarm.alarmTemperature) },
});
// Rewrites every saved temperature from the old even 55-110°F spread to the measured curve, so
// each schedule keeps setting the bed to the same level as before.
export function convertScheduleTemperatures(schedules) {
    const convertSide = (sideSchedule) => Object.fromEntries(Object.entries(sideSchedule).map(([day, dailySchedule]) => [day, convertDailySchedule(dailySchedule)]));
    return { left: convertSide(schedules.left), right: convertSide(schedules.right) };
}
// Runs the conversion once per Pod. A marker file records that it has been done, and the
// schedules as they were are kept next to it in case they are wanted back.
export function migrateTemperatureScaleOnce(schedules, { schedulesFile, dataFolder }) {
    const markerFile = `${dataFolder}temperature_scale_version.txt`;
    if (existsSync(markerFile))
        return schedules;
    if (existsSync(schedulesFile))
        copyFileSync(schedulesFile, `${dataFolder}schedulesDB.before-measured-temperatures.json`);
    const converted = convertScheduleTemperatures(schedules);
    writeFileSync(markerFile, 'measured-curve-1\n');
    return converted;
}
//# sourceMappingURL=migrateTemperatureScale.js.map
//# debugId=86702dfd-fa10-538a-beff-a802074c1ab8
