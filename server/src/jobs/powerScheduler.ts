import schedule from 'node-schedule';
import { Settings } from '../db/settingsSchema.js';
import { DailySchedule, DayOfWeek, Side } from '../db/schedulesSchema.js';
import { updateDeviceStatus } from '../routes/deviceStatus/updateDeviceStatus.js';
import { getDayIndexForSchedule, getDayOfWeekIndex, logJob } from './utils.js';
import { executeAnalyzeSleep } from './analyzeSleep.js';
import { TimeZone } from '../db/timeZones.js';
import moment from 'moment-timezone';
import serverStatus from '../serverStatus.js';
import logger from '../logger.js';
import servicesDB from '../db/services.js';
import memoryDB from '../db/memoryDB.js';
import { findLateAlarmEnd } from './alarmScheduler.js';
import { didOneOffAlarmFireWithin } from './oneOffAlarmState.js';
import { OFF_AFTER_ALARM_MINUTES } from '../db/automaticOffTime.js';
import { isManualHoldActive } from './manualHold.js';
import { getScheduledOnSeconds } from './scheduleTiming.js';
import { connectFranken } from '../8sleep/frankenServer.js';

// How long the bed stays on after an alarm that was later than the schedule's off time
const SECONDS_ON_AFTER_LATE_ALARM = 120;



export const schedulePowerOn = (settingsData: Settings, side: Side, day: DayOfWeek, power: DailySchedule['power']) => {
  if (!power.enabled) return;
  if (settingsData[side].awayMode) return;
  if (settingsData.timeZone === null) return;

  const onRule = new schedule.RecurrenceRule();
  const dayOfWeekIndex = getDayOfWeekIndex(day);
  onRule.dayOfWeek = dayOfWeekIndex;
  const [onHour, onMinute] = power.on.split(':').map(Number);
  const time = power.on;
  onRule.hour = onHour;
  onRule.minute = onMinute;
  onRule.tz = settingsData.timeZone;

  logJob('Scheduling power on job', side, day, dayOfWeekIndex, time);
  schedule.scheduleJob(`${side}-${day}-${time}-power-on`, onRule, async () => {
    try {
      if (isManualHoldActive(side)) {
        logJob('Skipping power on job, the side was switched on by hand', side, day, dayOfWeekIndex, time);
        return;
      }
      logJob('Executing power on job', side, day, dayOfWeekIndex, time);

      await updateDeviceStatus({
        [side]: {
          isOn: true,
          targetTemperatureF: power.onTemperature
        }
      }, { onSeconds: getScheduledOnSeconds(power.on, power.off) });
      serverStatus.status.powerSchedule.status = 'healthy';
      serverStatus.status.powerSchedule.message = '';
    } catch (error: unknown) {
      serverStatus.status.powerSchedule.status = 'failed';
      const message = error instanceof Error ? error.message : String(error);
      serverStatus.status.powerSchedule.message = message;
      logger.error(error);
    }
  });
};


const scheduleAnalyzeSleep = (dayOfWeekIndex: number, offHour: number, offMinute: number, timeZone: TimeZone, side: Side, day: DayOfWeek) => {
  const dailyRule = new schedule.RecurrenceRule();
  const adjustedOffMinute = offMinute;
  dailyRule.dayOfWeek = dayOfWeekIndex;
  dailyRule.hour = offHour;
  dailyRule.minute = adjustedOffMinute;
  dailyRule.tz = timeZone;
  const time = `${String(offHour).padStart(2, '0')}:${String(adjustedOffMinute).padStart(2, '0')}`;
  logJob('Scheduling daily sleep analyzer job', side, day, dayOfWeekIndex, time);
  schedule.scheduleJob(`daily-analyze-sleep-${day}-${time}-${side}`, dailyRule, async () => {
    await servicesDB.read();
    if (!servicesDB.data.biometrics.enabled) {
      logger.debug('Not executing sleep analyzer job, biometrics is disabled');
      return;
    }

    await memoryDB.read();
    const now = performance.now();
    if (memoryDB.data[side].analyzeSleep.lastRan) {
      const diffMs = now - memoryDB.data[side].analyzeSleep.lastRan;
      const tenMinutesMs = 10 * 60 * 1000;
      if (diffMs <= tenMinutesMs) {
        logJob('Duplicate job detected, exiting!', side, day, dayOfWeekIndex, time);
        return;
      }
    }
    memoryDB.data[side].analyzeSleep.lastRan = now;
    await memoryDB.write();

    logJob('Executing daily sleep analyzer job', side, day, dayOfWeekIndex, time);
    // Subtract a fixed start time
    executeAnalyzeSleep(side, moment().subtract(12, 'hours').toISOString(), moment().add(1, 'hours').toISOString());
  });
};


export const schedulePowerOffAndSleepAnalysis = (settingsData: Settings, side: Side, day: DayOfWeek, power: DailySchedule['power']) => {
  if (!power.enabled) return;
  if (settingsData[side].awayMode) return;
  if (settingsData.timeZone === null) return;

  const offRule = new schedule.RecurrenceRule();
  const dayOfWeekIndex = getDayIndexForSchedule(day, power.off, power.on);
  offRule.dayOfWeek = dayOfWeekIndex;
  const time = power.off;
  const [offHour, offMinute] = time.split(':').map(Number);
  offRule.hour = offHour;
  offRule.minute = offMinute;
  offRule.tz = settingsData.timeZone;
  scheduleAnalyzeSleep(dayOfWeekIndex, offHour, offMinute, settingsData.timeZone, side, day);
  logJob('Scheduling power off job', side, day, dayOfWeekIndex, time);

  schedule.scheduleJob(`${side}-${day}-${time}-power-off`, offRule, async () => {
    try {
      if (isManualHoldActive(side)) {
        logJob('Skipping power off job, the side was switched on by hand', side, day, dayOfWeekIndex, time);
        return;
      }
      // A one-time alarm that has just gone off set the bed's own timer; it turns the side off
      if (didOneOffAlarmFireWithin(side, OFF_AFTER_ALARM_MINUTES * 60_000)) {
        logJob('Skipping power off job, a one-time alarm went off and the side turns itself off', side, day, dayOfWeekIndex, time);
        return;
      }
      logJob('Executing power off job', side, day, dayOfWeekIndex, time);
      // An alarm still to come keeps the bed on: the firmware is told to switch the side off
      // itself shortly after the alarm ends, which holds even if the jobs are rebuilt meanwhile
      const lateAlarmEnd = await findLateAlarmEnd(side, day);
      const franken = await connectFranken();
      const isSideOn = (await franken.getDeviceStatus())[side].isOn;
      if (lateAlarmEnd && isSideOn) {
        const secondsRemaining = lateAlarmEnd.diff(moment(), 'seconds') + SECONDS_ON_AFTER_LATE_ALARM;
        logger.debug(`Keeping ${side} side on for an alarm after its off time, until ${lateAlarmEnd.format()}`);
        await updateDeviceStatus({ [side]: { secondsRemaining } });
        return;
      }
      await updateDeviceStatus({
        [side]: {
          isOn: false,
        }
      });
      serverStatus.status.powerSchedule.status = 'healthy';
      serverStatus.status.powerSchedule.message = '';
    } catch (error: unknown) {
      serverStatus.status.powerSchedule.status = 'failed';
      const message = error instanceof Error ? error.message : String(error);
      serverStatus.status.powerSchedule.message = message;
      logger.error(error);
    }
  });
};


