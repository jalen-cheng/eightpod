import moment from 'moment-timezone';
import AlarmIcon from '@mui/icons-material/Alarm';
import AlarmOffIcon from '@mui/icons-material/AlarmOff';
import { Box, Button, Paper, Typography } from '@mui/material';

import { useAppStore } from '@state/appStore.tsx';
import { useSchedules } from '@api/schedules.ts';
import { useSettings } from '@api/settings.ts';
import { useEffect, useState } from 'react';
import { DayOfWeek } from '../../../../server/src/db/schedulesSchema.ts';
import AlarmOverride from './AlarmOverride.tsx';
import AlarmDisabledDialog from './AlarmDisabledDialog.tsx';


export default function AlarmNotification() {
  const { side } = useAppStore();
  const { data: schedules } = useSchedules();
  const { data: settings } = useSettings();
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
    const alarm = schedules[side][currentDay].alarm;

    const hhMm = alarm.time;
    const amPm = moment(alarm.time, 'HH:mm').format('h:mm A');
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

  if (!power?.enabled || !alarm?.enabled || !settings) return null;
  // Away mode stops this side's schedule and alarm
  if (settings[side].awayMode) return null;
  // In the morning, after the alarm has gone off, there is nothing left to change until tonight
  const now = moment.tz(settings.timeZone);
  const alarmToday = moment.tz(`${now.format('YYYY-MM-DD')} ${scheduledAlarmTime}`, 'YYYY-MM-DD HH:mm', settings.timeZone);
  if (now.hour() < 12 && scheduledAlarmTime && now.isAfter(alarmToday.add(2, 'minutes'))) return null;

  // One quiet line: what the next alarm is, with its time as the thing to tap to change it
  return (
    <Paper sx={ { display: 'flex', alignItems: 'center', gap: 1.25, width: '100%', pl: 2, pr: 1, py: 0.75, borderRadius: '14px' } }>
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
      <Box sx={ { display: 'flex', color: alarmDisabled ? 'text.secondary' : 'warning.main' } }>
        { alarmDisabled ? <AlarmOffIcon sx={ { fontSize: 20 } }/> : <AlarmIcon sx={ { fontSize: 20 } }/> }
      </Box>
      { alarmDisabled ? (
        <Typography variant="body2" sx={ { color: 'text.secondary', mr: 'auto' } }>Next alarm is off</Typography>
      ) : (
        <>
          <Typography variant="body2" sx={ { color: 'text.secondary' } }>Alarm</Typography>
          <Button
            size="small"
            variant="outlined"
            onClick={ () => setOverrideOpen(!overrideOpen) }
            aria-label={ `Alarm at ${scheduledAlarmLabel}. Change the next alarm` }
            sx={ { mr: 'auto', fontWeight: 600 } }
          >
            { scheduledAlarmLabel }
          </Button>
        </>
      ) }
      <Button size="small" color="inherit" onClick={ () => setDisabledOpen(true) } sx={ { color: 'text.secondary' } }>
        { alarmDisabled ? 'Turn on' : 'Skip' }
      </Button>
    </Paper>
  );
}
