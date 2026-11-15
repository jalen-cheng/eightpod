import schedule from 'node-schedule';
import cbor from 'cbor';
import moment from 'moment-timezone';

import logger from '../logger.js';
import memoryDB from '../db/memoryDB.js';
import serverStatus from '../serverStatus.js';
import schedulesDB from '../db/schedules.js';
import settingsDB from '../db/settings.js';
import { AlarmJob, DailySchedule, DayOfWeek, MAX_FIRMWARE_ALARM_SECONDS, Side } from '../db/schedulesSchema.js';
import { executeFunction } from '../8sleep/deviceApi.js';
import { getDayIndexForSchedule, logJob, subtractMinutesFromTime } from './utils.js';
import { startPreWarm } from './preWarmState.js';
import { updateDeviceStatus } from '../routes/deviceStatus/updateDeviceStatus.js';
import { connectFranken } from '../8sleep/frankenServer.js';
import { Settings } from '../db/settingsSchema.js';
import { createAlarmSession } from './alarmSession.js';


// Sends an alarm to the Pod. An alarm longer than the firmware allows is sent as a first stretch
// here, with the rest handed to the alarm session to start when this stretch ends.
export const executeAlarm = async (
  { vibrationIntensity, duration, vibrationPattern, side, force=false, turnOffAfterDismiss }: AlarmJob,
  { isContinuation }: { isContinuation: boolean } = { isContinuation: false },
) => {
  try {
    const totalDuration = Math.max(10, duration);
    const min10Duration = Math.min(MAX_FIRMWARE_ALARM_SECONDS, totalDuration);
    const remainingDuration = totalDuration - min10Duration;
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
      pl: vibrationIntensity,
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
    // Later stretches use full pulses: "rise" would drop back to a feeble start every few minutes
    const continuation: AlarmJob | undefined = remainingDuration > 0
      ? { vibrationIntensity, duration: remainingDuration, vibrationPattern: 'double', side, force, turnOffAfterDismiss }
      : undefined;
    await alarmSession.alarmStarted(
      { vibrationIntensity, duration, vibrationPattern, side, force, turnOffAfterDismiss },
      min10Duration,
      { continuation, isContinuation },
    );
    serverStatus.status.alarmSchedule.status = 'healthy';
    serverStatus.status.alarmSchedule.message = '';
  } catch (error: unknown) {
    serverStatus.status.alarmSchedule.status = 'failed';
    const message = error instanceof Error ? error.message : String(error);
    serverStatus.status.alarmSchedule.message = message;
    logger.error(error);
  }
};


// Owns the per-side alarm timers (end of vibration, snooze). A snoozed alarm re-runs executeAlarm.
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
function nextOccurrenceHhMm(tz: string, hhmm: string) {
  const now = moment.tz(tz);
  const [h, m] = hhmm.split(':').map(Number);

  const candidate = now.clone().hour(h).minute(m).second(0).millisecond(0);
  if (candidate.isSameOrBefore(now)) {
    candidate.add(1, 'day');
  }

  return candidate;
}

export function scheduleAlarmOverride(settingsData: Settings, side: Side) {
  const alarmOverride = settingsData[side]?.scheduleOverrides?.alarm;
  if (!alarmOverride || alarmOverride.disabled) return null;
  if (!alarmOverride.timeOverride || !alarmOverride.expiresAt) return null;

  const now = moment.tz(settingsData.timeZone);
  const expiresAt = moment.tz(alarmOverride.expiresAt, settingsData.timeZone);
  if (!expiresAt.isAfter(now)) return null;
  const next = nextOccurrenceHhMm(settingsData.timeZone, alarmOverride.timeOverride);
  logger.debug(`Alarm override is set! Scheduling alarm for ${next.format()}`);

  schedule.scheduleJob(`${side}-alarm-override-${alarmOverride.timeOverride}`, next.toDate(), async () => {
    const dayKey = next.tz(settingsData.timeZone).format('dddd').toLowerCase() as DayOfWeek;
    const daySchedule = schedulesDB.data?.[side]?.[dayKey];

    const { vibrationIntensity, duration, vibrationPattern, turnOffAfterDismiss } = daySchedule?.alarm ?? {
      vibrationIntensity: 100,
      duration: 60,
      vibrationPattern: 'rise',
      turnOffAfterDismiss: undefined,
    };

    await executeAlarm({
      side,
      vibrationIntensity,
      duration,
      vibrationPattern,
      turnOffAfterDismiss,
    });
  });
}


export const scheduleAlarm = (settingsData: Settings, side: Side, day: DayOfWeek, dailySchedule: DailySchedule) => {
  if (!dailySchedule.power.enabled) return;
  if (!dailySchedule.alarm.enabled) return;
  if (settingsData[side].awayMode) return;
  if (settingsData.timeZone === null) return;

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
        duration: dailySchedule.alarm.duration,
        vibrationPattern: dailySchedule.alarm.vibrationPattern,
        turnOffAfterDismiss: dailySchedule.alarm.turnOffAfterDismiss,
      });
    } catch (error: unknown) {
      serverStatus.status.alarmSchedule.status = 'failed';
      const message = error instanceof Error ? error.message : String(error);
      serverStatus.status.alarmSchedule.message = message;
      logger.error(error);
    }
  });
};



// Warms a side to its alarm temperature a set number of minutes before the alarm, whatever the
// temperature schedule says. Scheduled temperature changes are skipped until the alarm time.
export const scheduleAlarmPreWarm = (settingsData: Settings, side: Side, day: DayOfWeek, dailySchedule: DailySchedule) => {
  const preWarmMinutes = dailySchedule.alarm.preWarmMinutes ?? 0;
  if (!dailySchedule.power.enabled || !dailySchedule.alarm.enabled || preWarmMinutes <= 0) return;
  if (settingsData[side].awayMode) return;
  if (settingsData.timeZone === null) return;

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
    } catch (error: unknown) {
      logger.error(error);
    }
  });
};
