/* eslint-disable react/no-multi-comp */
import { PropsWithChildren } from 'react';
import { Box, Typography } from '@mui/material';
import WaterDropOutlinedIcon from '@mui/icons-material/WaterDropOutlined';
import moment from 'moment-timezone';
import { useSchedules } from '@api/schedules.ts';
import { useSettings } from '@api/settings.ts';
import { useAppStore } from '@state/appStore.tsx';
import { DayOfWeek, LATE_ALARM_WINDOW_HOURS } from '@api/schedulesSchema.ts';
import { Settings } from '@api/settingsSchema.ts';
import { offTimeAfterAlarm } from '@api/automaticOffTime.ts';
import { TemperatureFormat, describeTemperature, getTemperatureParts } from '@lib/temperatureConversions.ts';
import ErrorBoundary from '@components/ErrorBoundary.tsx';
import AlarmNotification from './AlarmNotification.tsx';

const formatClock = (time: string) => moment(time, 'HH:mm').format('h:mm A');

// The quiet line under the dial's figures that says when the bed next switches on or off
const SwitchTime = ({ children }: PropsWithChildren) => (
  <Typography variant="caption" sx={ { color: 'text.secondary', display: 'block', mt: 0.75 } }>{ children }</Typography>
);

// When a side that is on will turn off. Normally the schedule's off time; a one-time alarm
// still to come moves it to 30 minutes after that alarm, as the server does (the server only
// waits for an alarm up to LATE_ALARM_WINDOW_HOURS after the off time).
const findOffTime = (scheduledOff: string, oneTimeAlarm: Settings['left']['scheduleOverrides']['alarm'], timeZone: string): string => {
  const now = moment.tz(timeZone);
  const isWaiting = !oneTimeAlarm.disabled && Boolean(oneTimeAlarm.timeOverride) && moment(oneTimeAlarm.expiresAt).isAfter(now);
  if (!isWaiting) return scheduledOff;
  // The next time the clock shows a time of day
  const nextAt = (time: string) => {
    const [hour, minute] = time.split(':').map(Number);
    const at = now.clone().hour(hour).minute(minute).second(0).millisecond(0);
    return at.isAfter(now) ? at : at.add(1, 'day');
  };
  const alarmAt = nextAt(oneTimeAlarm.timeOverride);
  if (alarmAt.isAfter(nextAt(scheduledOff).add(LATE_ALARM_WINDOW_HOURS, 'hours'))) return scheduledOff;
  return offTimeAfterAlarm(oneTimeAlarm.timeOverride);
};

type TemperatureLabelProps = {
  isOn: boolean;
  sliderTemp: number;
  sliderColor: string;
  currentTargetTemp: number;
  currentTemperatureF: number;
  // The water temperature the bed measures, when the Pod reports it
  measuredTemperatureF?: number;
  temperatureFormat: TemperatureFormat;
};

export default function TemperatureLabel({
  isOn, sliderTemp, sliderColor, currentTargetTemp, currentTemperatureF, measuredTemperatureF, temperatureFormat,
}: TemperatureLabelProps) {
  const { side } = useAppStore();
  const { data: schedules } = useSchedules();
  const { data: settings } = useSettings();
  // A bed that is on is in the night that began on the day it was 12 hours ago; a bed that is
  // off is waiting for today's bed-on time
  const scheduleMoment = settings?.timeZone ? moment.tz(settings.timeZone).subtract(isOn ? 12 : 0, 'hours') : undefined;
  const currentDay = scheduleMoment && scheduleMoment.format('dddd').toLowerCase() as DayOfWeek;
  const power = currentDay ? schedules?.[side]?.[currentDay]?.power : undefined;
  const offTime = power && settings ? findOffTime(power.off, settings[side].scheduleOverrides.alarm, settings.timeZone) : undefined;
  const temperature = getTemperatureParts(sliderTemp, temperatureFormat);
  const isAdjusting = sliderTemp !== currentTargetTemp;
  let targetLabel = '';
  if (sliderTemp < currentTemperatureF) targetLabel = isAdjusting ? 'Cool to' : 'Cooling to';
  if (sliderTemp > currentTemperatureF) targetLabel = isAdjusting ? 'Warm to' : 'Warming to';
  // A bare "+1" needs saying what it is; degrees carry their own unit
  if (temperatureFormat === 'level') targetLabel = targetLabel ? `${targetLabel} level` : 'Level';

  return (
    <Box sx={ { textAlign: 'center', whiteSpace: 'nowrap', pointerEvents: 'none' } }>
      <Typography variant="body2" sx={ { color: 'text.secondary', minHeight: 21 } }>{ isOn ? targetLabel : '' }</Typography>
      <Typography
        component="p"
        sx={ {
          fontSize: isOn ? 'clamp(44px, 14vw, 64px)' : 'clamp(40px, 12vw, 52px)',
          fontWeight: 500, letterSpacing: '-0.01em', lineHeight: 1.2, my: 0.5,
        } }
      >
        { isOn ? (
          <>
            { temperature.value }
            <Box component="span" sx={ { fontSize: 27, verticalAlign: 'top', lineHeight: 2 } }>
              { temperature.unit }
            </Box>
          </>
        ) : 'Off' }
      </Typography>
      { /* Where the bed is now. The measured water temperature when the Pod reports it; otherwise
           the firmware's own estimate of the level it has reached. */ }
      { isOn && (
        <Box sx={ { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 } }>
          { measuredTemperatureF === undefined
            ? <Box component="span" sx={ { width: 5, height: 5, borderRadius: '50%', bgcolor: sliderColor, mr: 0.25 } }/>
            : <WaterDropOutlinedIcon aria-hidden sx={ { fontSize: 13, color: sliderColor } }/> }
          <Typography variant="caption" sx={ { color: 'text.secondary' } }>
            { measuredTemperatureF === undefined
              ? `Currently at ${describeTemperature(currentTemperatureF, temperatureFormat)}`
              : `Bed at ${describeTemperature(Math.round(measuredTemperatureF), temperatureFormat)}` }
          </Typography>
        </Box>
      ) }
      { !isOn && !settings?.[side]?.awayMode && (
        <Typography variant="body2" sx={ { color: 'text.secondary' } }>Tap to turn on</Typography>
      ) }
      { /* While the bed is on: the next alarm, to change or skip, with the off time beside it.
           With no alarm to show, or while it is off, the time it next switches. */ }
      { power?.enabled && isOn && (
        <ErrorBoundary componentName="Alarm">
          <AlarmNotification
            offTimeLabel={ formatClock(offTime ?? power.off) }
            fallback={ <SwitchTime>Turns off at { formatClock(offTime ?? power.off) }</SwitchTime> }
          />
        </ErrorBoundary>
      ) }
      { power?.enabled && !isOn && !settings?.[side]?.awayMode && <SwitchTime>Turns on at { formatClock(power.on) }</SwitchTime> }
    </Box>
  );
}
