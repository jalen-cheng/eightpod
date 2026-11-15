
!function(){try{var e="undefined"!=typeof window?window:"undefined"!=typeof global?global:"undefined"!=typeof globalThis?globalThis:"undefined"!=typeof self?self:{},n=(new e.Error).stack;n&&(e._sentryDebugIds=e._sentryDebugIds||{},e._sentryDebugIds[n]="bfb2c0cc-4405-5e97-96ab-7533d0f7e2f8")}catch(e){}}();
import schedule from 'node-schedule';
import { getDayIndexForSchedule, logJob } from './utils.js';
import { updateDeviceStatus } from '../routes/deviceStatus/updateDeviceStatus.js';
import serverStatus from '../serverStatus.js';
import logger from '../logger.js';
import { isPreWarmActive } from './preWarmState.js';
const scheduleAdjustment = (timeZone, side, day, time, temperature, powerOnTime) => {
    const onRule = new schedule.RecurrenceRule();
    const dayOfWeekIndex = getDayIndexForSchedule(day, time, powerOnTime);
    const [onHour, onMinute] = time.split(':').map(Number);
    logJob('Scheduling temperature adjustment job', side, day, dayOfWeekIndex, time);
    onRule.dayOfWeek = dayOfWeekIndex;
    onRule.hour = onHour;
    onRule.minute = onMinute;
    onRule.tz = timeZone;
    schedule.scheduleJob(`${side}-${day}-${time}-${temperature}-temperature-adjustment`, onRule, async () => {
        try {
            if (isPreWarmActive(side)) {
                logJob('Skipping temperature adjustment job, warming up for the alarm', side, day, dayOfWeekIndex, time);
                return;
            }
            logJob('Executing temperature adjustment job', side, day, dayOfWeekIndex, time);
            await updateDeviceStatus({
                [side]: {
                    targetTemperatureF: temperature,
                }
            });
            serverStatus.status.temperatureSchedule.status = 'healthy';
            serverStatus.status.temperatureSchedule.message = '';
        }
        catch (error) {
            serverStatus.status.temperatureSchedule.status = 'failed';
            const message = error instanceof Error ? error.message : String(error);
            serverStatus.status.temperatureSchedule.message = message;
            logger.error(error);
        }
    });
};
export const scheduleTemperatures = (settingsData, side, day, dailySchedule) => {
    if (settingsData[side].awayMode)
        return;
    const { timeZone } = settingsData;
    if (timeZone === null)
        return;
    Object.entries(dailySchedule.temperatures).forEach(([time, temperature]) => {
        scheduleAdjustment(timeZone, side, day, time, temperature, dailySchedule.power.on);
    });
};
//# sourceMappingURL=temperatureScheduler.js.map
//# debugId=bfb2c0cc-4405-5e97-96ab-7533d0f7e2f8
