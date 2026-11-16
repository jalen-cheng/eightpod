import { Box, Button, Paper, Typography } from '@mui/material';
import moment from 'moment-timezone';
import { useState } from 'react';
import { cancelOneTimeAlarm, postOneTimeAlarm } from '@api/alarm.ts';
import { Time } from '@api/schedulesSchema.ts';
import { SideSettings } from '@api/settingsSchema.ts';
import { useSettings } from '@api/settings.ts';
import { useAppStore } from '@state/appStore.tsx';
import { useScheduleStore } from './scheduleStore.tsx';
import { TimeField } from './ScheduleFields.tsx';

const FALLBACK_ALARM_TIME = '07:00';

// The next moment the clock shows a time of day
const getNextOccurrence = (time: Time) => {
  const [hour, minute] = time.split(':').map(Number);
  const occurrence = moment().hour(hour).minute(minute).second(0).millisecond(0);
  return occurrence.isSameOrBefore(moment()) ? occurrence.add(1, 'day') : occurrence;
};

// When a side's waiting one-time alarm will go off, or undefined if it has none
const getPendingAlarm = ({ disabled, timeOverride, expiresAt }: SideSettings['scheduleOverrides']['alarm']) => {
  if (disabled || !timeOverride || !expiresAt || !moment(expiresAt).isAfter(moment())) return undefined;
  const firesAt = getNextOccurrence(timeOverride);
  return firesAt.isAfter(moment(expiresAt)) ? undefined : firesAt;
};

// An alarm for one night only, set without touching the weekly schedule. It goes off the next
// time the clock shows the chosen time and replaces any scheduled alarm before it.
export default function OneTimeAlarm() {
  const { side, linkSides, isUpdating, setIsUpdating } = useAppStore();
  const { data: settings, refetch } = useSettings();
  const scheduledAlarmTime = useScheduleStore(state => state.selectedSchedule?.alarm.time);
  const [chosenTime, setChosenTime] = useState<Time | undefined>();
  if (!settings) return null;

  const time = chosenTime ?? scheduledAlarmTime ?? FALLBACK_ALARM_TIME;
  const pendingAlarm = getPendingAlarm(settings[side].scheduleOverrides.alarm);
  const targetSide = linkSides ? 'both' : side;

  const send = async (request: Promise<unknown>) => {
    setIsUpdating(true);
    await request
      .then(() => refetch())
      .catch(error => console.error(error))
      .finally(() => setIsUpdating(false));
  };

  return (
    <Paper sx={ { p: { xs: 2, sm: 2.5 }, width: '100%', display: 'flex', flexDirection: 'column', gap: 1 } }>
      <Box>
        <Typography variant="body2" sx={ { fontWeight: 500 } }>One-time alarm</Typography>
        <Typography variant="caption" sx={ { color: 'text.secondary', display: 'block' } }>
          { pendingAlarm
            ? 'Replaces any scheduled alarm before it. The weekly schedule is unchanged.'
            : `Goes off once, the next time it is that time${linkSides ? ', on both sides' : ''}. The weekly schedule is unchanged.` }
        </Typography>
      </Box>
      { pendingAlarm ? (
        <Box sx={ { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 } }>
          <Typography variant="body1">
            { pendingAlarm.calendar(null, { sameDay: '[Today] h:mm A', nextDay: '[Tomorrow] h:mm A', sameElse: 'ddd h:mm A' }) }
          </Typography>
          <Button size="small" onClick={ () => send(cancelOneTimeAlarm(targetSide)) } disabled={ isUpdating }>Cancel it</Button>
        </Box>
      ) : (
        <Box sx={ { display: 'flex', alignItems: 'center', gap: 0.75 } }>
          <TimeField label="One-time alarm time" value={ time } onChange={ setChosenTime } disabled={ isUpdating }/>
          <Button size="small" variant="outlined" onClick={ () => send(postOneTimeAlarm(targetSide, time)) } disabled={ isUpdating }>
            Set for { getNextOccurrence(time).calendar(null, { sameDay: '[today]', nextDay: '[tomorrow]', sameElse: 'ddd' }) }
          </Button>
        </Box>
      ) }
      <Typography variant="caption" sx={ { color: 'text.secondary' } }>The side has to be on at that time.</Typography>
    </Paper>
  );
}
