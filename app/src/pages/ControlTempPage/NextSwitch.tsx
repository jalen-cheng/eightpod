import { Typography } from '@mui/material';
import moment from 'moment-timezone';
import { useSchedules } from '@api/schedules.ts';
import { useSettings } from '@api/settings.ts';
import { useAppStore } from '@state/appStore.tsx';
import { DayOfWeek, LATE_ALARM_WINDOW_HOURS } from '@api/schedulesSchema.ts';
import { Settings } from '@api/settingsSchema.ts';
import { offTimeAfterAlarm } from '@api/automaticOffTime.ts';
import ErrorBoundary from '@components/ErrorBoundary.tsx';
import AlarmNotification from './AlarmNotification.tsx';

const formatClock = (time: string) => moment(time, 'HH:mm').format('h:mm A');
const switchTimeSx = { color: 'text.secondary' };

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

type NextSwitchProps = {
  isOn: boolean;
};

// What the bed does next, for the open bottom of the dial. While it is on: the next alarm, to
// change or skip, or when there is no alarm to show, when it turns off. While it is off: when
// it switches on. Nothing without a schedule for the day.
export default function NextSwitch({ isOn }: NextSwitchProps) {
  const { side } = useAppStore();
  const { data: schedules } = useSchedules();
  const { data: settings } = useSettings();
  // A bed that is on is in the night that began on the day it was 12 hours ago; a bed that is
  // off is waiting for today's bed-on time
  const scheduleMoment = settings?.timeZone ? moment.tz(settings.timeZone).subtract(isOn ? 12 : 0, 'hours') : undefined;
  const currentDay = scheduleMoment && scheduleMoment.format('dddd').toLowerCase() as DayOfWeek;
  const power = currentDay ? schedules?.[side]?.[currentDay]?.power : undefined;
  if (!power?.enabled || !settings) return null;

  if (!isOn) {
    // Away mode stops this side's schedule
    if (settings[side].awayMode) return null;
    return <Typography variant="caption" sx={ switchTimeSx }>Turns on at { formatClock(power.on) }</Typography>;
  }

  const offTimeLabel = formatClock(findOffTime(power.off, settings[side].scheduleOverrides.alarm, settings.timeZone));
  return (
    <ErrorBoundary componentName="Alarm">
      <AlarmNotification fallback={ <Typography variant="caption" sx={ switchTimeSx }>Turns off at { offTimeLabel }</Typography> }/>
    </ErrorBoundary>
  );
}
