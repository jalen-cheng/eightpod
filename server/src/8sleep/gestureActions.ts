import { DeepPartial } from 'ts-essentials';
import logger from '../logger.js';
import settingsDB from '../db/settings.js';
import { Side } from '../db/schedulesSchema.js';
import {
  DeviceStatus,
  MAX_TARGET_TEMPERATURE_F,
  MIN_TARGET_TEMPERATURE_F,
} from '../routes/deviceStatus/deviceStatusSchema.js';
import { dismissAlarm, updateDeviceStatus } from '../routes/deviceStatus/updateDeviceStatus.js';
import { handleAlarmGesture } from '../jobs/alarmSession.js';
import { alarmSession } from '../jobs/alarmScheduler.js';
import { TapCounts, processSideGestures } from './gestures.js';

// One press can reach us twice: through the tap counters and through the Pod 5 button log, or as
// a long hold that the firmware follows with a second, shorter event. Running an alarm or power
// gesture twice would undo it (a power toggle flips back), so a second one for the same side
// within this window is dropped.
const ALARM_GESTURE_REPEAT_WINDOW_MS = 3_000;
const lastAlarmGestureAtMs: Record<Side, number> = { left: 0, right: 0 };

// Records that a power or alarm action was just taken for a side by some other path
export const noteAlarmGestureHandled = (side: Side) => {
  lastAlarmGestureAtMs[side] = Date.now();
};

const getOtherSide = (side: Side): Side => (side === 'left' ? 'right' : 'left');

// The sides a change made at the bed applies to: both when the sides are linked in settings.
// `settingsDB` must have been read by the caller.
const getControlledSides = (side: Side): Side[] => (settingsDB.data.linkSides ? [side, getOtherSide(side)] : [side]);

// Gives every controlled side the same value in one device update
const updateControlledSides = (side: Side, sideStatus: DeepPartial<DeviceStatus['left']>) => {
  const update: DeepPartial<DeviceStatus> = {};
  getControlledSides(side).forEach((controlledSide) => { update[controlledSide] = sideStatus; });
  return updateDeviceStatus(update);
};

export const setSidePower = (side: Side, isOn: boolean) => updateControlledSides(side, { isOn });

// Runs a side's configured actions for the gestures made between two sets of counts.
// Shared by the tap counter monitor and the Pod 5 button monitor, so both behave the same.
// `settingsDB` must have been read by the caller.
// Returns the side's target temperature after the gestures, or undefined if they failed.
export async function runSideGestures(
  side: Side,
  deviceStatus: DeviceStatus,
  previousTaps: TapCounts | undefined,
  nextTaps: TapCounts | undefined,
): Promise<number | undefined> {
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
            // A snooze stops the vibration but must leave the side on for the alarm to come back
            dismissAlarm: () => dismissAlarm(side, { allowPowerOff: tapConfig.behavior !== 'snooze' }),
            snoozeAlarm: snoozeSeconds => alarmSession.snooze(side, snoozeSeconds),
            setPower: isOn => setSidePower(side, isOn),
          });
          logger.debug(`Processed alarm gesture for ${side}: ${result}`);
        },
      },
    });
  } catch (error) {
    logger.error(error);
    return undefined;
  }
}
