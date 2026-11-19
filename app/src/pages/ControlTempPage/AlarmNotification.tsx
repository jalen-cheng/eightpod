import moment from 'moment-timezone';
import AlarmIcon from '@mui/icons-material/Alarm';
import AlarmOffIcon from '@mui/icons-material/AlarmOff';
import { Box, Button, Menu, MenuItem } from '@mui/material';

import { useAppStore } from '@state/appStore.tsx';
import { useSchedules } from '@api/schedules.ts';
import { useSettings } from '@api/settings.ts';
import { ReactNode, useEffect, useState } from 'react';
import { DayOfWeek } from '../../../../server/src/db/schedulesSchema.ts';
import AlarmOverride from './AlarmOverride.tsx';
import AlarmDisabledDialog from './AlarmDisabledDialog.tsx';

type AlarmNotificationProps = {
  // Shown in place of the alarm when there is none to show
  fallback?: ReactNode;
};

// The next alarm, under the dial's figures: its time as a small button that opens the two things one can
// do about it (change it for this once, or skip it)
export default function AlarmNotification({ fallback = null }: AlarmNotificationProps) {
  const { side } = useAppStore();
  const { data: schedules } = useSchedules();
  const { data: settings } = useSettings();
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const [overrideOpen, setOverrideOpen] = useState(false);
  const [disabledOpen, setDisabledOpen] = useState(false);
  const [alarmTimeLocalOverride, setAlarmTimeLocalOverride] = useState<string>('');
  const [alarmDisabled, setAlarmDisabled] = useState(false);
  const currentDay = moment.tz(settings?.timeZone || 'UTC').subtract(12, 'hours').format('dddd').toLowerCase() as DayOfWeek;
  const alarm = schedules?.[side][currentDay].alarm;
  const power = schedules?.[side][currentDay].power;

  const [scheduledAlarmLabel, setScheduledAlarmLabel] = useState('');
  const [scheduledAlarmTime, setScheduledAlarmTime] = useState('');

  useEffect(() => {
    if (!settings || !schedules) return;
    const scheduledAlarm = schedules[side][currentDay].alarm;

    const hhMm = scheduledAlarm.time;
    const amPm = moment(scheduledAlarm.time, 'HH:mm').format('h:mm A');
    setScheduledAlarmTime(hhMm);
    setScheduledAlarmLabel(amPm);
    setAlarmDisabled(false);
    const alarmScheduleOverrides = settings[side].scheduleOverrides.alarm;
    if (alarmScheduleOverrides.expiresAt) {
      const expiresAt = moment(alarmScheduleOverrides.expiresAt);

      if (expiresAt.isAfter(moment())) {
        if (alarmScheduleOverrides.disabled) {
          setAlarmDisabled(true);
          setScheduledAlarmTime(hhMm);
          setScheduledAlarmLabel(amPm);
        } else {
          setAlarmDisabled(false);
          setScheduledAlarmLabel(moment(alarmScheduleOverrides.timeOverride, 'HH:mm').format('h:mm A'));
          setScheduledAlarmTime(alarmScheduleOverrides.timeOverride);
        }
      }
    }
  }, [settings, schedules, side]);

  if (!power?.enabled || !alarm?.enabled || !settings) return fallback;
  // Away mode stops this side's schedule and alarm
  if (settings[side].awayMode) return fallback;
  // In the morning, after the alarm has gone off, there is nothing left to change until tonight
  const now = moment.tz(settings.timeZone);
  const alarmToday = moment.tz(`${now.format('YYYY-MM-DD')} ${scheduledAlarmTime}`, 'YYYY-MM-DD HH:mm', settings.timeZone);
  if (now.hour() < 12 && scheduledAlarmTime && now.isAfter(alarmToday.add(2, 'minutes'))) return fallback;

  const closeMenu = () => setMenuAnchor(null);

  return (
    // The dial's label lets presses through to the dial; this row takes its own
    <Box sx={ { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, pointerEvents: 'auto' } }>
      <AlarmOverride
        open={ overrideOpen }
        setOverrideOpen={ setOverrideOpen }
        alarmTimeLocalOverride={ alarmTimeLocalOverride }
        scheduledAlarmTime={ scheduledAlarmTime }
        setAlarmTimeLocalOverride={ setAlarmTimeLocalOverride }
      />
      <AlarmDisabledDialog
        open={ disabledOpen }
        setOpen={ setDisabledOpen }
        scheduledAlarmTime={ scheduledAlarmTime }
        alarmDisabled={ alarmDisabled }
      />
      <Button
        size="small"
        variant="outlined"
        color="inherit"
        onClick={ (event) => {
          // A press here is not a press on the dial's section
          event.stopPropagation();
          setMenuAnchor(event.currentTarget);
        } }
        aria-label={ alarmDisabled ? 'The next alarm is off. Open alarm choices' : `Alarm at ${scheduledAlarmLabel}. Open alarm choices` }
        startIcon={ alarmDisabled
          ? <AlarmOffIcon sx={ { color: 'text.secondary' } }/>
          : <AlarmIcon sx={ { color: 'warning.main' } }/> }
        sx={ {
          borderRadius: 999, borderColor: 'divider', py: 0.25, px: 1.25, minHeight: 30, fontWeight: 600,
          '& .MuiButton-startIcon svg': { fontSize: 16 },
        } }
      >
        { alarmDisabled ? 'Alarm off' : scheduledAlarmLabel }
      </Button>
      <Menu anchorEl={ menuAnchor } open={ menuAnchor !== null } onClose={ closeMenu } onClick={ event => event.stopPropagation() }>
        { !alarmDisabled && (
          <MenuItem
            onClick={ () => {
              closeMenu();
              setOverrideOpen(true);
            } }
          >
            Change the next alarm
          </MenuItem>
        ) }
        <MenuItem
          onClick={ () => {
            closeMenu();
            setDisabledOpen(true);
          } }
        >
          { alarmDisabled ? 'Turn the next alarm back on' : 'Skip the next alarm' }
        </MenuItem>
      </Menu>
    </Box>
  );
}
