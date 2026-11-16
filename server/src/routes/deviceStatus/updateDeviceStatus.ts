import _ from 'lodash';
import { DeepPartial } from 'ts-essentials';
import cbor from 'cbor';

import { DeviceStatus, SideStatus } from './deviceStatusSchema.js';
import { executeFunction } from '../../8sleep/deviceApi.js';
import logger from '../../logger.js';
import settingsDB from '../../db/settings.js';
import { temperatureFToLevel } from '../../db/temperatureCurve.js';
import { alarmSession } from '../../jobs/alarmScheduler.js';
import { cancelPreWarm } from '../../jobs/preWarmState.js';
import { INVERTED_SETTINGS_KEY_MAPPING } from '../../8sleep/loadDeviceStatus.js';

const calculateLevelFromF = (temperatureF: number) => temperatureFToLevel(temperatureF).toString();

// Records that a side's alarm was stopped. If that alarm was set to switch the side off when
// dismissed, does that too, unless `allowPowerOff` is false.
const finishDismissedAlarm = async (side: 'left' | 'right', allowPowerOff: boolean) => {
  const dismissedAlarm = await alarmSession.alarmCleared(side);
  if (allowPowerOff && dismissedAlarm?.turnOffAfterDismiss) {
    logger.debug(`Alarm dismissed, switching ${side} side off`);
    await executeFunction(side === 'left' ? 'LEFT_TEMP_DURATION' : 'RIGHT_TEMP_DURATION', '0');
    cancelPreWarm(side);
  }
};

// Stops a side's alarm. `allowPowerOff` is false for a snooze, which stops the vibration but
// keeps the bed on.
// The firmware's clear command takes no side and stops both (confirmed on a Pod 5). So the other
// side is dealt with here: with the sides linked it is one sleeper's alarm and is dismissed too;
// otherwise the other side's alarm is started again if it was still going off.
export const dismissAlarm = async (side: 'left' | 'right', { allowPowerOff }: { allowPowerOff: boolean }) => {
  logger.debug(`Clearing alarm, requested by ${side} side`);
  await executeFunction('ALARM_CLEAR', 'empty');
  await finishDismissedAlarm(side, allowPowerOff);
  const otherSide = side === 'left' ? 'right' : 'left';
  await settingsDB.read();
  if (settingsDB.data.linkSides) {
    await finishDismissedAlarm(otherSide, allowPowerOff);
  } else {
    await alarmSession.restartIfVibrating(otherSide);
  }
};

const updateSide = async (side: 'left' | 'right', sideStatus: DeepPartial<SideStatus>) => {
  await settingsDB.read();
  const settings = settingsDB.data;
  if (side === 'left') {
    if (settings.left.awayMode) {
      logger.warn('Left side is in away mode, not updating side');
    }
  } else {
    if (settings.right.awayMode) {
      logger.warn('Right side is in away mode, not updating side');
    }
  }
  const controlBothSides = settings.left.awayMode || settings.right.awayMode;
  const updateLeft = side === 'left' || controlBothSides;
  const updateRight = side === 'right' || controlBothSides;

  const { isOn, targetTemperatureF, secondsRemaining, isAlarmVibrating } = sideStatus;

  if (controlBothSides) {
    logger.debug('One side is in away mode, updating both sides...');
  }

  if (isOn !== undefined) {
    const onDuration = isOn ? '43200' : '0';
    if (updateLeft) await executeFunction('LEFT_TEMP_DURATION', onDuration);
    if (updateRight) await executeFunction('RIGHT_TEMP_DURATION', onDuration);
  }

  if (targetTemperatureF) {
    const level = calculateLevelFromF(targetTemperatureF);
    if (updateLeft) await executeFunction('TEMP_LEVEL_LEFT', level);
    if (updateRight) await executeFunction('TEMP_LEVEL_RIGHT', level);
  }

  if (secondsRemaining) {
    const seconds = Math.round(secondsRemaining).toString();
    if (updateLeft) await executeFunction('LEFT_TEMP_DURATION', seconds);
    if (updateRight) await executeFunction('RIGHT_TEMP_DURATION', seconds);
  }

  // A pending snooze must not re-start the alarm on a side that was just turned off
  if (isOn === false) {
    if (updateLeft) { alarmSession.cancelSnooze('left'); cancelPreWarm('left'); }
    if (updateRight) { alarmSession.cancelSnooze('right'); cancelPreWarm('right'); }
  }

  if (isAlarmVibrating !== undefined) {
    logger.debug('Can only set isAlarmVibrating to false for now...');
    if (!isAlarmVibrating) {
      await dismissAlarm(side, { allowPowerOff: true });
    } else {
      await alarmSession.alarmCleared(side);
    }
  }
};


const updateSettings = async (settings: Partial<DeviceStatus['settings']>) => {
  const renamedSettings = _.mapKeys(settings, (value, key) => INVERTED_SETTINGS_KEY_MAPPING[key] || key);
  const encodedBuffer = cbor.encode(renamedSettings);
  const hexString = encodedBuffer.toString('hex');
  await executeFunction('SET_SETTINGS', hexString);
};

export const updateDeviceStatus = async (deviceStatus: DeepPartial<DeviceStatus>) => {
  logger.info(`Updating device status..`);

  if (deviceStatus.isPriming) await executeFunction('PRIME');
  if (deviceStatus?.left) await updateSide('left', deviceStatus.left);
  if (deviceStatus?.right) await updateSide('right', deviceStatus.right);
  if (deviceStatus?.settings) await updateSettings(deviceStatus.settings);
  logger.info('Finished updating device status');
};
