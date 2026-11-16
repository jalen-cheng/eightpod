
!function(){try{var e="undefined"!=typeof window?window:"undefined"!=typeof global?global:"undefined"!=typeof globalThis?globalThis:"undefined"!=typeof self?self:{},n=(new e.Error).stack;n&&(e._sentryDebugIds=e._sentryDebugIds||{},e._sentryDebugIds[n]="7d2f2f65-1315-5efa-a08b-05fd172c0dea")}catch(e){}}();
import _ from 'lodash';
import cbor from 'cbor';
import { executeFunction } from '../../8sleep/deviceApi.js';
import logger from '../../logger.js';
import settingsDB from '../../db/settings.js';
import { temperatureFToLevel } from '../../db/temperatureCurve.js';
import { alarmSession } from '../../jobs/alarmScheduler.js';
import { cancelPreWarm } from '../../jobs/preWarmState.js';
import { INVERTED_SETTINGS_KEY_MAPPING } from '../../8sleep/loadDeviceStatus.js';
const calculateLevelFromF = (temperatureF) => temperatureFToLevel(temperatureF).toString();
// Records that a side's alarm was stopped. If that alarm was set to switch the side off when
// dismissed, does that too.
const finishDismissedAlarm = async (side) => {
    const dismissedAlarm = await alarmSession.alarmCleared(side);
    if (dismissedAlarm?.turnOffAfterDismiss) {
        logger.debug(`Alarm dismissed, switching ${side} side off`);
        await executeFunction(side === 'left' ? 'LEFT_TEMP_DURATION' : 'RIGHT_TEMP_DURATION', '0');
        cancelPreWarm(side);
    }
};
// Stops a side's alarm.
// The firmware's clear command takes no side and stops both (confirmed on a Pod 5). So the other
// side is dealt with here: with the sides linked it is one sleeper's alarm and is dismissed too;
// otherwise the other side's alarm is started again if it was still going off.
export const dismissAlarm = async (side) => {
    logger.debug(`Clearing alarm, requested by ${side} side`);
    await executeFunction('ALARM_CLEAR', 'empty');
    await finishDismissedAlarm(side);
    const otherSide = side === 'left' ? 'right' : 'left';
    await settingsDB.read();
    if (settingsDB.data.linkSides) {
        await finishDismissedAlarm(otherSide);
    }
    else {
        await alarmSession.restartIfVibrating(otherSide);
    }
};
const updateSide = async (side, sideStatus) => {
    await settingsDB.read();
    const settings = settingsDB.data;
    if (side === 'left') {
        if (settings.left.awayMode) {
            logger.warn('Left side is in away mode, not updating side');
        }
    }
    else {
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
        if (updateLeft)
            await executeFunction('LEFT_TEMP_DURATION', onDuration);
        if (updateRight)
            await executeFunction('RIGHT_TEMP_DURATION', onDuration);
    }
    if (targetTemperatureF) {
        const level = calculateLevelFromF(targetTemperatureF);
        if (updateLeft)
            await executeFunction('TEMP_LEVEL_LEFT', level);
        if (updateRight)
            await executeFunction('TEMP_LEVEL_RIGHT', level);
    }
    if (secondsRemaining) {
        const seconds = Math.round(secondsRemaining).toString();
        if (updateLeft)
            await executeFunction('LEFT_TEMP_DURATION', seconds);
        if (updateRight)
            await executeFunction('RIGHT_TEMP_DURATION', seconds);
    }
    // A warm-up must not carry on for a side that was just turned off
    if (isOn === false) {
        if (updateLeft)
            cancelPreWarm('left');
        if (updateRight)
            cancelPreWarm('right');
    }
    if (isAlarmVibrating !== undefined) {
        logger.debug('Can only set isAlarmVibrating to false for now...');
        if (!isAlarmVibrating) {
            await dismissAlarm(side);
        }
        else {
            await alarmSession.alarmCleared(side);
        }
    }
};
const updateSettings = async (settings) => {
    const renamedSettings = _.mapKeys(settings, (value, key) => INVERTED_SETTINGS_KEY_MAPPING[key] || key);
    const encodedBuffer = cbor.encode(renamedSettings);
    const hexString = encodedBuffer.toString('hex');
    await executeFunction('SET_SETTINGS', hexString);
};
export const updateDeviceStatus = async (deviceStatus) => {
    logger.info(`Updating device status..`);
    if (deviceStatus.isPriming)
        await executeFunction('PRIME');
    if (deviceStatus?.left)
        await updateSide('left', deviceStatus.left);
    if (deviceStatus?.right)
        await updateSide('right', deviceStatus.right);
    if (deviceStatus?.settings)
        await updateSettings(deviceStatus.settings);
    logger.info('Finished updating device status');
};
//# sourceMappingURL=updateDeviceStatus.js.map
//# debugId=7d2f2f65-1315-5efa-a08b-05fd172c0dea
