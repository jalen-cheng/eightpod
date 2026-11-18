
!function(){try{var e="undefined"!=typeof window?window:"undefined"!=typeof global?global:"undefined"!=typeof globalThis?globalThis:"undefined"!=typeof self?self:{},n=(new e.Error).stack;n&&(e._sentryDebugIds=e._sentryDebugIds||{},e._sentryDebugIds[n]="ba3e5d3e-b624-5100-bc43-48e9e0d4e54c")}catch(e){}}();
import schedule from 'node-schedule';
import { markOneOffAlarmFired } from './oneOffAlarmState.js';
import cbor from 'cbor';
import moment from 'moment-timezone';
import logger from '../logger.js';
import memoryDB from '../db/memoryDB.js';
import serverStatus from '../serverStatus.js';
import schedulesDB from '../db/schedules.js';
import settingsDB from '../db/settings.js';
import { LATE_ALARM_WINDOW_HOURS, MAX_ALARM_SECONDS, MAX_FIRMWARE_ALARM_SECONDS, } from '../db/schedulesSchema.js';
import { findNightDay, minutesAlarmIsAfterOff } from './scheduleTiming.js';
import { isSomeoneInBed } from './inBedCheck.js';
import { shouldRunJob } from './recentRuns.js';
import { executeFunction } from '../8sleep/deviceApi.js';
import { getDayIndexForSchedule, logJob, subtractMinutesFromTime } from './utils.js';
import { startPreWarm } from './preWarmState.js';
import { isManualHoldActive } from './manualHold.js';
import { updateDeviceStatus } from '../routes/deviceStatus/updateDeviceStatus.js';
import { connectFranken } from '../8sleep/frankenServer.js';
import { Version } from '../routes/deviceStatus/deviceStatusSchema.js';
import { createAlarmSession, planAlarmStretch } from './alarmSession.js';
import { OFF_AFTER_ALARM_MINUTES } from '../db/automaticOffTime.js';
const SECONDS_PER_MINUTE = 60;
// Sends an alarm to the Pod, one stretch at a time: the ramp-up steps of a "rise" alarm, then
// stretches as long as the firmware allows. The rest of the alarm is handed to the alarm session
// to start when this stretch ends.
export const executeAlarm = async (alarmJob, { isContinuation } = { isContinuation: false }) => {
    const { vibrationPattern, side, force = false } = alarmJob;
    try {
        // Exit is side is in away mode
        await settingsDB.read();
        if (settingsDB.data[side].awayMode && !force) {
            if (settingsDB.data[side].awayMode) {
                logger.debug('Not executing alarm, this side is in away mode!');
                return;
            }
        }
        // A further stretch of an alarm that has been dismissed meanwhile is not sent
        // eslint-disable-next-line no-use-before-define
        if (isContinuation && !alarmSession.isAlarmActive(side))
            return;
        // Exit if side is off
        const franken = await connectFranken();
        const resp = await franken.getDeviceStatus();
        if (!resp[side].isOn && !force) {
            logger.debug('Not executing alarm, side is off!');
            return;
        }
        // The ramp built from short stretches was worked out on a Pod 5, whose firmware "rise" is flat
        const rampInSteps = resp.coverVersion === Version.Pod5;
        const { strength, seconds: min10Duration, continuation } = planAlarmStretch(alarmJob, MAX_FIRMWARE_ALARM_SECONDS, { rampInSteps });
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
// A short, gentle double buzz on one side, to say "your press was taken" after a dismissal from
// the bed. A Pod 5's firmware runs a 2-second request as given (anything shorter it drops). It
// is not an alarm: nothing tracks it and nothing follows it.
const CONFIRM_BUZZ = { strength: 25, seconds: 2, pattern: 'double' };
export const buzzDismissalConfirmation = async (side) => {
    try {
        const payload = { pl: CONFIRM_BUZZ.strength, du: CONFIRM_BUZZ.seconds, pi: CONFIRM_BUZZ.pattern, tt: moment().unix() };
        await executeFunction(side === 'left' ? 'ALARM_LEFT' : 'ALARM_RIGHT', cbor.encode(payload).toString('hex'));
    }
    catch (error) {
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
export function nextOccurrenceOfTime(timeZone, time) {
    const now = moment.tz(timeZone);
    const [hour, minute] = time.split(':').map(Number);
    const candidate = now.clone().hour(hour).minute(minute).second(0).millisecond(0);
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
    const next = nextOccurrenceOfTime(settingsData.timeZone, alarmOverride.timeOverride);
    // Already gone off: the override is only still in force to hold back a scheduled alarm
    return next.isAfter(expiresAt) ? undefined : next;
}
// True while a one-off alarm is standing in for the scheduled alarm due at `scheduledAlarmAt`:
// the scheduled alarm will skip itself, so nothing else should prepare for it either
const isScheduledAlarmReplaced = (settingsData, side, scheduledAlarmAt) => {
    const { expiresAt } = settingsData[side].scheduleOverrides.alarm;
    return Boolean(expiresAt) && moment(expiresAt).isAfter(scheduledAlarmAt);
};
// Warms a side for an alarm that is `preWarmMinutes` away, if the side is on. Scheduled
// temperature changes are then skipped until the alarm.
const runPreWarm = async (side, preWarmMinutes, alarmTemperatureF) => {
    if (isManualHoldActive(side)) {
        logger.debug(`Not warming up ${side} for its alarm, the side was switched on by hand`);
        return;
    }
    const franken = await connectFranken();
    const deviceStatus = await franken.getDeviceStatus();
    if (!deviceStatus[side].isOn) {
        logger.debug(`Not warming up ${side} for its alarm, side is off`);
        return;
    }
    startPreWarm(side, preWarmMinutes);
    await updateDeviceStatus({ [side]: { targetTemperatureF: alarmTemperatureF } });
};
// How a one-off alarm vibrates: the settings of the weekly alarm on the day it goes off
export const getOneOffAlarmSettings = (settingsData, side, firesAt) => {
    // The settings of the night the alarm ends, not of the calendar day it goes off on
    const dayKey = findNightDay(firesAt.clone().tz(settingsData.timeZone), schedulesDB.data?.[side]);
    return schedulesDB.data?.[side]?.[dayKey]?.alarm ?? {
        vibrationIntensity: 100,
        duration: MAX_ALARM_SECONDS,
        vibrationPattern: 'rise',
        turnOffAfterDismiss: undefined,
        preWarmMinutes: 0,
        alarmTemperature: undefined,
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
        alarmEnds.push(oneOffFiresAt.clone().add(getOneOffAlarmSettings(settingsData, side, oneOffFiresAt).duration, 'seconds'));
    }
    const { alarm, power } = schedulesDB.data[side][day];
    if (alarm.enabled && minutesAlarmIsAfterOff(alarm.time, power) > 0) {
        const firesAt = nextOccurrenceOfTime(settingsData.timeZone, alarm.time);
        if (firesAt.isBefore(windowEnd))
            alarmEnds.push(firesAt.clone().add(alarm.duration, 'seconds'));
    }
    return alarmEnds.length > 0 ? moment.max(alarmEnds) : undefined;
}
// A one-off alarm brings the bed's off time with it: a side that is on turns off
// OFF_AFTER_ALARM_MINUTES after the alarm goes off, whatever the night's schedule said.
const moveOffTimeToOneOffAlarm = async (side) => {
    try {
        const franken = await connectFranken();
        const deviceStatus = await franken.getDeviceStatus();
        if (!deviceStatus[side].isOn || isManualHoldActive(side))
            return;
        await updateDeviceStatus({ [side]: { secondsRemaining: OFF_AFTER_ALARM_MINUTES * SECONDS_PER_MINUTE } });
        // From here the bed's own timer turns the side off; the schedule's off job stands back
        markOneOffAlarmFired(side);
    }
    catch (error) {
        logger.error(error);
    }
};
export function scheduleAlarmOverride(settingsData, side) {
    const next = getPendingOneOffAlarm(settingsData, side, moment.tz(settingsData.timeZone));
    if (!next)
        return null;
    const { timeOverride } = settingsData[side].scheduleOverrides.alarm;
    logger.debug(`Alarm override is set! Scheduling alarm for ${next.format()}`);
    // The one-off gets the warm-up the alarm it replaces would have had, moved to its own time.
    // Skipped when that moment has already passed.
    const { preWarmMinutes = 0, alarmTemperature } = getOneOffAlarmSettings(settingsData, side, next);
    const preWarmAt = next.clone().subtract(preWarmMinutes, 'minutes');
    if (preWarmMinutes > 0 && alarmTemperature !== undefined && preWarmAt.isAfter(moment())) {
        schedule.scheduleJob(`${side}-alarm-override-${timeOverride}-pre-warm`, preWarmAt.toDate(), async () => {
            try {
                logger.debug(`Executing warm-up for the one-off alarm on ${side}`);
                await runPreWarm(side, preWarmMinutes, alarmTemperature);
            }
            catch (error) {
                logger.error(error);
            }
        });
    }
    schedule.scheduleJob(`${side}-alarm-override-${timeOverride}`, next.toDate(), async () => {
        const { vibrationIntensity, duration, vibrationPattern, turnOffAfterDismiss } = getOneOffAlarmSettings(settingsData, side, next);
        // Asked for by hand, so it goes off even if the side is off by then (for example after
        // the schedule's off time) or in away mode
        await executeAlarm({
            side,
            vibrationIntensity,
            duration,
            vibrationPattern,
            turnOffAfterDismiss,
            force: true,
        });
        await moveOffTimeToOneOffAlarm(side);
    });
}
const REPEATED_HOUR_GUARD_MS = 2 * 60 * 60_000;
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
    const alarmJobName = `${side}-${day}-${time}-alarm`;
    schedule.scheduleJob(alarmJobName, alarmRule, async () => {
        try {
            // The night clocks go back, a time between 1 and 2 AM comes round twice
            if (!shouldRunJob(alarmJobName, REPEATED_HOUR_GUARD_MS)) {
                logJob('Skipping alarm job, it already ran within the last two hours', side, day, dayIndex, time);
                return;
            }
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
                duration: dailySchedule.alarm.duration,
                vibrationPattern: dailySchedule.alarm.vibrationPattern,
                turnOffAfterDismiss: dailySchedule.alarm.turnOffAfterDismiss,
                // A side that is off is normally left alone. But if its timer ran out early and the
                // sensors say someone is still in bed, the alarm they set still wakes them.
                force: isSomeoneInBed(side),
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
            await settingsDB.read();
            const scheduledAlarmAt = moment().add(preWarmMinutes, 'minutes');
            if (isScheduledAlarmReplaced(settingsDB.data, side, scheduledAlarmAt)) {
                logJob('A one-off alarm replaces this alarm, skipping its warm-up', side, day, dayIndex, preWarmTime);
                return;
            }
            logJob('Executing alarm warm-up job', side, day, dayIndex, preWarmTime);
            await runPreWarm(side, preWarmMinutes, dailySchedule.alarm.alarmTemperature);
        }
        catch (error) {
            logger.error(error);
        }
    });
};
//# sourceMappingURL=alarmScheduler.js.map
//# debugId=ba3e5d3e-b624-5100-bc43-48e9e0d4e54c
