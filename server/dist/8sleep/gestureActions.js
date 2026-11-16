
!function(){try{var e="undefined"!=typeof window?window:"undefined"!=typeof global?global:"undefined"!=typeof globalThis?globalThis:"undefined"!=typeof self?self:{},n=(new e.Error).stack;n&&(e._sentryDebugIds=e._sentryDebugIds||{},e._sentryDebugIds[n]="d9e0ff8b-cb13-50b7-9347-2d2fc49d25fd")}catch(e){}}();
import logger from '../logger.js';
import settingsDB from '../db/settings.js';
import { MAX_TARGET_TEMPERATURE_F, MIN_TARGET_TEMPERATURE_F, } from '../routes/deviceStatus/deviceStatusSchema.js';
import { dismissAlarm, updateDeviceStatus } from '../routes/deviceStatus/updateDeviceStatus.js';
import { handleAlarmGesture } from '../jobs/alarmSession.js';
import { processSideGestures } from './gestures.js';
// One press can reach us twice: through the tap counters and through the Pod 5 button log, or as
// a long hold that the firmware follows with a second, shorter event. Running an alarm or power
// gesture twice would undo it (a power toggle flips back), so a second one for the same side
// within this window is dropped.
const ALARM_GESTURE_REPEAT_WINDOW_MS = 3_000;
const lastAlarmGestureAtMs = { left: 0, right: 0 };
// Records that a power or alarm action was just taken for a side by some other path
export const noteAlarmGestureHandled = (side) => {
    lastAlarmGestureAtMs[side] = Date.now();
};
const getOtherSide = (side) => (side === 'left' ? 'right' : 'left');
// The sides a change made at the bed applies to: both when the sides are linked in settings.
// `settingsDB` must have been read by the caller.
const getControlledSides = (side) => (settingsDB.data.linkSides ? [side, getOtherSide(side)] : [side]);
// Gives every controlled side the same value in one device update
const updateControlledSides = (side, sideStatus) => {
    const update = {};
    getControlledSides(side).forEach((controlledSide) => { update[controlledSide] = sideStatus; });
    return updateDeviceStatus(update);
};
export const setSidePower = (side, isOn) => updateControlledSides(side, { isOn });
// Runs a side's configured actions for the gestures made between two sets of counts.
// Shared by the tap counter monitor and the Pod 5 button monitor, so both behave the same.
// `settingsDB` must have been read by the caller.
// Returns the side's target temperature after the gestures, or undefined if they failed.
export async function runSideGestures(side, deviceStatus, previousTaps, nextTaps) {
    try {
        return await processSideGestures({
            previousTaps,
            nextTaps,
            tapSettings: settingsDB.data[side].taps,
            targetTemperatureF: deviceStatus[side].targetTemperatureF,
            temperatureLimits: { minTemperatureF: MIN_TARGET_TEMPERATURE_F, maxTemperatureF: MAX_TARGET_TEMPERATURE_F },
            actions: {
                setTargetTemperature: async (temperatureF) => {
                    logger.debug(`Processing gesture temperature change for ${side} -> ${temperatureF}`);
                    await updateControlledSides(side, { targetTemperatureF: temperatureF });
                },
                runAlarmGesture: async (tapConfig) => {
                    if (Date.now() - lastAlarmGestureAtMs[side] < ALARM_GESTURE_REPEAT_WINDOW_MS) {
                        logger.debug(`Skipping repeated alarm gesture for ${side}`);
                        return;
                    }
                    lastAlarmGestureAtMs[side] = Date.now();
                    const result = await handleAlarmGesture(tapConfig, {
                        isAlarmVibrating: deviceStatus[side].isAlarmVibrating,
                        isSideOn: deviceStatus[side].isOn,
                        // Same paths the app uses to dismiss an alarm and for its power button
                        dismissAlarm: () => dismissAlarm(side),
                        setPower: isOn => setSidePower(side, isOn),
                    });
                    logger.debug(`Processed alarm gesture for ${side}: ${result}`);
                },
            },
        });
    }
    catch (error) {
        logger.error(error);
        return undefined;
    }
}
//# sourceMappingURL=gestureActions.js.map
//# debugId=d9e0ff8b-cb13-50b7-9347-2d2fc49d25fd
