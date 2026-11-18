
!function(){try{var e="undefined"!=typeof window?window:"undefined"!=typeof global?global:"undefined"!=typeof globalThis?globalThis:"undefined"!=typeof self?self:{},n=(new e.Error).stack;n&&(e._sentryDebugIds=e._sentryDebugIds||{},e._sentryDebugIds[n]="f4ceec4f-fce5-5e9b-b49e-ada76fa9b1b2")}catch(e){}}();
import { noteManualTemperature } from '../../autopilot/manualChanges.js';
import _ from 'lodash';
import cbor from 'cbor';
import { executeFunction } from '../../8sleep/deviceApi.js';
import { connectFranken } from '../../8sleep/frankenServer.js';
import logger from '../../logger.js';
import settingsDB from '../../db/settings.js';
import { temperatureFToLevel } from '../../db/temperatureCurve.js';
import { alarmSession } from '../../jobs/alarmScheduler.js';
import { cancelPreWarm } from '../../jobs/preWarmState.js';
import { cancelManualHold, startManualHold } from '../../jobs/manualHold.js';
import { INVERTED_SETTINGS_KEY_MAPPING } from '../../8sleep/loadDeviceStatus.js';
const calculateLevelFromF = (temperatureF) => temperatureFToLevel(temperatureF).toString();
// Records that a side's alarm was stopped. If that alarm was set to switch the side off when
// dismissed, does that too.
const finishDismissedAlarm = async (side) => {
    const dismissedAlarm = await alarmSession.alarmCleared(side);
    if (dismissedAlarm?.turnOffAfterDismiss) {
        logger.debug(`Alarm dismissed, switching ${side} side off`);
        // Through the usual path, so a hold by hand ends and a side in away mode follows
        // eslint-disable-next-line no-use-before-define
        await updateSide(side, { isOn: false }, {});
    }
};
// Alarms that began this close together are one alarm for the whole bed
const SAME_ALARM_WINDOW_MS = 60_000;
// Stops a side's alarm.
// The firmware's clear command takes no side and stops both (confirmed on a Pod 5). So the other
// side is dealt with here. If both sides began going off together it is one alarm, and it is
// dismissed too. Otherwise it is someone else's alarm, and it is started again if it was still
// going off.
export const dismissAlarm = async (side) => {
    logger.debug(`Clearing alarm, requested by ${side} side`);
    const otherSide = side === 'left' ? 'right' : 'left';
    const isOneAlarm = alarmSession.didAlarmsStartTogether(SAME_ALARM_WINDOW_MS);
    await executeFunction('ALARM_CLEAR', 'empty');
    await finishDismissedAlarm(side);
    if (isOneAlarm) {
        await finishDismissedAlarm(otherSide);
    }
    else {
        await alarmSession.restartIfVibrating(otherSide);
    }
};
const SECONDS_PER_HOUR = 3_600;
// How long the schedule switches a side on for. Its own off time ends the night long before this.
const SCHEDULED_ON_SECONDS = 12 * SECONDS_PER_HOUR;
const updateSide = async (side, sideStatus, options) => {
    const { isManual = false, onSeconds: requestedOnSeconds } = options;
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
    const updatedSides = [...(updateLeft ? ['left'] : []), ...(updateRight ? ['right'] : [])];
    if (isOn !== undefined) {
        const requestedSeconds = requestedOnSeconds ?? (isManual ? settings.manualOn.hours * SECONDS_PER_HOUR : SCHEDULED_ON_SECONDS);
        // A side that is already on keeps the time it has left when that is longer. Otherwise a
        // shortcut that sets the temperature at night would cut the night short (it says "on" too),
        // and the bed would be off before the morning alarm.
        const currentStatus = isOn && isManual ? await (await connectFranken()).getDeviceStatus() : undefined;
        for (const updatedSide of updatedSides) {
            const secondsLeft = currentStatus?.[updatedSide].isOn ? currentStatus[updatedSide].secondsRemaining : 0;
            const onSeconds = Math.max(requestedSeconds, secondsLeft);
            await executeFunction(updatedSide === 'left' ? 'LEFT_TEMP_DURATION' : 'RIGHT_TEMP_DURATION', isOn ? onSeconds.toString() : '0');
            // Switched on by hand with "ignore the schedule": the schedule stays away until it turns off
            if (isOn && isManual && settings.manualOn.overridesSchedule)
                startManualHold(updatedSide, onSeconds);
            else
                cancelManualHold(updatedSide);
        }
    }
    if (targetTemperatureF) {
        if (isManual)
            updatedSides.forEach(updatedSide => noteManualTemperature(updatedSide, targetTemperatureF));
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
export const updateDeviceStatus = async (deviceStatus, options = {}) => {
    logger.info(`Updating device status..`);
    if (deviceStatus.isPriming)
        await executeFunction('PRIME');
    if (deviceStatus?.left)
        await updateSide('left', deviceStatus.left, options);
    if (deviceStatus?.right)
        await updateSide('right', deviceStatus.right, options);
    if (deviceStatus?.settings)
        await updateSettings(deviceStatus.settings);
    logger.info('Finished updating device status');
};
//# sourceMappingURL=updateDeviceStatus.js.map
//# debugId=f4ceec4f-fce5-5e9b-b49e-ada76fa9b1b2
