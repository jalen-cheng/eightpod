
!function(){try{var e="undefined"!=typeof window?window:"undefined"!=typeof global?global:"undefined"!=typeof globalThis?globalThis:"undefined"!=typeof self?self:{},n=(new e.Error).stack;n&&(e._sentryDebugIds=e._sentryDebugIds||{},e._sentryDebugIds[n]="f7a11f5c-62d7-50db-944e-94239ee02855")}catch(e){}}();
import schedule from 'node-schedule';
import cbor from 'cbor';
import moment from 'moment-timezone';
import logger from '../logger.js';
import memoryDB from '../db/memoryDB.js';
import serverStatus from '../serverStatus.js';
import schedulesDB from '../db/schedules.js';
import settingsDB from '../db/settings.js';
import { LATE_ALARM_WINDOW_HOURS, MAX_ALARM_SECONDS, MAX_FIRMWARE_ALARM_SECONDS, } from '../db/schedulesSchema.js';
import { minutesAlarmIsAfterOff } from './scheduleTiming.js';
import { executeFunction } from '../8sleep/deviceApi.js';
import { getDayIndexForSchedule, logJob, subtractMinutesFromTime } from './utils.js';
import { startPreWarm } from './preWarmState.js';
import { updateDeviceStatus } from '../routes/deviceStatus/updateDeviceStatus.js';
import { connectFranken } from '../8sleep/frankenServer.js';
import { createAlarmSession, planAlarmStretch } from './alarmSession.js';
// Sends an alarm to the Pod, one stretch at a time: the ramp-up steps of a "rise" alarm, then
// stretches as long as the firmware allows. The rest of the alarm is handed to the alarm session
// to start when this stretch ends.
export const executeAlarm = async (alarmJob, { isContinuation } = { isContinuation: false }) => {
    const { vibrationPattern, side, force = false } = alarmJob;
    try {
        const { strength, seconds: min10Duration, continuation } = planAlarmStretch(alarmJob, MAX_FIRMWARE_ALARM_SECONDS);
        // Exit is side is in away mode
        await settingsDB.read();
        if (settingsDB.data[side].awayMode && !force) {
            if (settingsDB.data[side].awayMode) {
                logger.debug('Not executing alarm, this side is in away mode!');
                return;
            }
        }
        // Exit if side is off
        const franken = await connectFranken();
        const resp = await franken.getDeviceStatus();
        if (!resp[side].isOn && !force) {
            logger.debug('Not executing alarm, side is off!');
            return;
        }
        const currentTime = moment.tz(settingsDB.data.timeZone);
        const alarmTimeEpoch = currentTime.unix();
        const alarmPayload = {
            pl: strength,
            du: min10Duration,
            pi: vibrationPattern,
            tt: alarmTimeEpoch,
        };
        const cborPayload = cbor.encode(alarmPayload);
        const hexPayload = cborPayload.toString('hex');
        const command = side === 'left' ? 'ALARM_LEFT' : 'ALARM_RIGHT';
        logger.debug(`Executing alarm... ${JSON.stringify(alarmPayload)}`);
        await executeFunction(command, hexPayload);
        // eslint-disable-next-line no-use-before-define
        await alarmSession.alarmStarted(alarmJob, min10Duration, { continuation, isContinuation });
        serverStatus.status.alarmSchedule.status = 'healthy';
        serverStatus.status.alarmSchedule.message = '';
    }
    catch (error) {
        serverStatus.status.alarmSchedule.status = 'failed';
        const message = error instanceof Error ? error.message : String(error);
        serverStatus.status.alarmSchedule.message = message;
        logger.error(error);
    }
};
// Owns the per-side alarm timers. An alarm stopped by the other side's dismissal re-runs executeAlarm.
export const alarmSession = createAlarmSession({
    startAlarm: executeAlarm,
    setAlarmVibrating: async (side, isAlarmVibrating) => {
        await memoryDB.read();
        memoryDB.data[side].isAlarmVibrating = isAlarmVibrating;
        await memoryDB.write();
    },
    logDebug: message => logger.debug(message),
});
/**
 * Next occurrence of HH:mm in tz (today or tomorrow depending on 'now').
 * If the HH:mm is already passed for 'now', schedule for tomorrow.
 */
export function nextOccurrenceHhMm(tz, hhmm) {
    const now = moment.tz(tz);
    const [h, m] = hhmm.split(':').map(Number);
    const candidate = now.clone().hour(h).minute(m).second(0).millisecond(0);
    if (candidate.isSameOrBefore(now)) {
        candidate.add(1, 'day');
    }
    return candidate;
}
// When a side's waiting one-off alarm will go off, or undefined if it has none
export function getPendingOneOffAlarm(settingsData, side, now) {
    const alarmOverride = settingsData[side]?.scheduleOverrides?.alarm;
    if (!alarmOverride || alarmOverride.disabled)
        return undefined;
    if (!alarmOverride.timeOverride || !alarmOverride.expiresAt)
        return undefined;
    const expiresAt = moment.tz(alarmOverride.expiresAt, settingsData.timeZone);
    if (!expiresAt.isAfter(now))
        return undefined;
    const next = nextOccurrenceHhMm(settingsData.timeZone, alarmOverride.timeOverride);
    // Already gone off: the override is only still in force to hold back a scheduled alarm
    return next.isAfter(expiresAt) ? undefined : next;
}
// How a one-off alarm vibrates: the settings of the weekly alarm on the day it goes off
const getOneOffAlarmSettings = (settingsData, side, firesAt) => {
    const dayKey = firesAt.clone().tz(settingsData.timeZone).format('dddd').toLowerCase();
    return schedulesDB.data?.[side]?.[dayKey]?.alarm ?? {
        vibrationIntensity: 100,
        vibrationPattern: 'rise',
        turnOffAfterDismiss: undefined,
    };
};
// When the last alarm that falls after a night's off time will finish, if there is one within
// LATE_ALARM_WINDOW_HOURS: a waiting one-off alarm, or that night's own alarm when it is set
// later than the off time. The power-off job keeps the bed on until then. Call it at the off time.
export async function findLateAlarmEnd(side, day) {
    await settingsDB.read();
    await schedulesDB.read();
    const settingsData = settingsDB.data;
    const now = moment.tz(settingsData.timeZone);
    const windowEnd = now.clone().add(LATE_ALARM_WINDOW_HOURS, 'hours');
    const alarmEnds = [];
    const oneOffFiresAt = getPendingOneOffAlarm(settingsData, side, now);
    if (oneOffFiresAt?.isBefore(windowEnd)) {
        alarmEnds.push(oneOffFiresAt.clone().add(MAX_ALARM_SECONDS, 'seconds'));
    }
    const { alarm, power } = schedulesDB.data[side][day];
    if (alarm.enabled && minutesAlarmIsAfterOff(alarm.time, power) > 0) {
        const firesAt = nextOccurrenceHhMm(settingsData.timeZone, alarm.time);
        if (firesAt.isBefore(windowEnd))
            alarmEnds.push(firesAt.clone().add(MAX_ALARM_SECONDS, 'seconds'));
    }
    return alarmEnds.length > 0 ? moment.max(alarmEnds) : undefined;
}
export function scheduleAlarmOverride(settingsData, side) {
    const next = getPendingOneOffAlarm(settingsData, side, moment.tz(settingsData.timeZone));
    if (!next)
        return null;
    const { timeOverride } = settingsData[side].scheduleOverrides.alarm;
    logger.debug(`Alarm override is set! Scheduling alarm for ${next.format()}`);
    schedule.scheduleJob(`${side}-alarm-override-${timeOverride}`, next.toDate(), async () => {
        const { vibrationIntensity, vibrationPattern, turnOffAfterDismiss } = getOneOffAlarmSettings(settingsData, side, next);
        // Asked for by hand, so it goes off even if the side is off by then (for example after
        // the schedule's off time) or in away mode
        await executeAlarm({
            side,
            vibrationIntensity,
            duration: MAX_ALARM_SECONDS,
            vibrationPattern,
            turnOffAfterDismiss,
            force: true,
        });
    });
}
export const scheduleAlarm = (settingsData, side, day, dailySchedule) => {
    if (!dailySchedule.power.enabled)
        return;
    if (!dailySchedule.alarm.enabled)
        return;
    if (settingsData[side].awayMode)
        return;
    if (settingsData.timeZone === null)
        return;
    const alarmRule = new schedule.RecurrenceRule();
    const dayIndex = getDayIndexForSchedule(day, dailySchedule.alarm.time, dailySchedule.power.on);
    alarmRule.dayOfWeek = dayIndex;
    const { time } = dailySchedule.alarm;
    const [alarmHour, alarmMinute] = time.split(':').map(Number);
    alarmRule.hour = alarmHour;
    alarmRule.minute = alarmMinute;
    alarmRule.tz = settingsData.timeZone;
    logJob('Scheduling alarm job', side, day, dayIndex, time);
    schedule.scheduleJob(`${side}-${day}-${time}-alarm`, alarmRule, async () => {
        try {
            logJob('Executing alarm job', side, day, dayIndex, time);
            await settingsDB.read();
            if (settingsDB.data[side].scheduleOverrides.alarm.expiresAt) {
                const expiresAt = moment(settingsDB.data[side].scheduleOverrides.alarm.expiresAt);
                const now = moment();
                if (expiresAt.isAfter(now)) {
                    logJob(`Detected alarm override! Skipping alarm! Override expires at: ${expiresAt.format()}`, side, day, dayIndex, time);
                    return;
                }
            }
            await executeAlarm({
                side,
                vibrationIntensity: dailySchedule.alarm.vibrationIntensity,
                duration: MAX_ALARM_SECONDS,
                vibrationPattern: dailySchedule.alarm.vibrationPattern,
                turnOffAfterDismiss: dailySchedule.alarm.turnOffAfterDismiss,
            });
        }
        catch (error) {
            serverStatus.status.alarmSchedule.status = 'failed';
            const message = error instanceof Error ? error.message : String(error);
            serverStatus.status.alarmSchedule.message = message;
            logger.error(error);
        }
    });
};
// Warms a side to its alarm temperature a set number of minutes before the alarm, whatever the
// temperature schedule says. Scheduled temperature changes are skipped until the alarm time.
export const scheduleAlarmPreWarm = (settingsData, side, day, dailySchedule) => {
    const preWarmMinutes = dailySchedule.alarm.preWarmMinutes ?? 0;
    if (!dailySchedule.power.enabled || !dailySchedule.alarm.enabled || preWarmMinutes <= 0)
        return;
    if (settingsData[side].awayMode)
        return;
    if (settingsData.timeZone === null)
        return;
    const preWarmTime = subtractMinutesFromTime(dailySchedule.alarm.time, preWarmMinutes);
    const dayIndex = getDayIndexForSchedule(day, preWarmTime, dailySchedule.power.on);
    const [preWarmHour, preWarmMinute] = preWarmTime.split(':').map(Number);
    const preWarmRule = new schedule.RecurrenceRule();
    preWarmRule.dayOfWeek = dayIndex;
    preWarmRule.hour = preWarmHour;
    preWarmRule.minute = preWarmMinute;
    preWarmRule.tz = settingsData.timeZone;
    logJob('Scheduling alarm warm-up job', side, day, dayIndex, preWarmTime);
    schedule.scheduleJob(`${side}-${day}-${preWarmTime}-alarm-pre-warm`, preWarmRule, async () => {
        try {
            const franken = await connectFranken();
            const deviceStatus = await franken.getDeviceStatus();
            if (!deviceStatus[side].isOn) {
                logger.debug(`Not warming up ${side} for its alarm, side is off`);
                return;
            }
            logJob('Executing alarm warm-up job', side, day, dayIndex, preWarmTime);
            startPreWarm(side, preWarmMinutes);
            await updateDeviceStatus({ [side]: { targetTemperatureF: dailySchedule.alarm.alarmTemperature } });
        }
        catch (error) {
            logger.error(error);
        }
    });
};
//# sourceMappingURL=alarmScheduler.js.map
//# debugId=f7a11f5c-62d7-50db-944e-94239ee02855
