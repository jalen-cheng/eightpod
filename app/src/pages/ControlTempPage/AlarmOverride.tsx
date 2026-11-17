import { Dispatch, SetStateAction, useState } from 'react';
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Typography } from '@mui/material';
import { cancelOneTimeAlarm, postOneTimeAlarm } from '@api/alarm.ts';
import { useSettings } from '@api/settings.ts';
import { useAppStore } from '@state/appStore.tsx';
import { TimeField } from '../SchedulePage/ScheduleFields.tsx';

export interface AlarmOverrideProps {
  open: boolean;
  // The time picked in this dialog, "HH:mm", or '' when nothing has been picked yet
  alarmTimeLocalOverride: string;
  // The alarm that will go off as things stand, "HH:mm"
  scheduledAlarmTimeHhMm: string;
  // True when a one-time alarm is already waiting, so it can be dropped from here
  hasOneTimeAlarm: boolean;

  setAlarmTimeLocalOverride: Dispatch<SetStateAction<string>>;
  setOverrideOpen: Dispatch<SetStateAction<boolean>>;
}

// Changes the next alarm for one night only. The weekly schedule is left alone; the alarm goes
// off the next time the clock shows the chosen time. With the sides linked it applies to both.
export default function AlarmOverride({
  open,
  setOverrideOpen,
  alarmTimeLocalOverride,
  scheduledAlarmTimeHhMm,
  hasOneTimeAlarm,
  setAlarmTimeLocalOverride,
}: AlarmOverrideProps) {
  const [isSaving, setIsSaving] = useState(false);
  const { refetch } = useSettings();
  const { side, linkSides } = useAppStore();
  const targetSide = linkSides ? 'both' : side;

  const close = () => {
    setAlarmTimeLocalOverride('');
    setOverrideOpen(false);
  };

  // Sends a change, then reloads the settings the alarm line is drawn from
  const send = (request: Promise<unknown>) => {
    setIsSaving(true);
    request
      .then(() => refetch())
      .then(close)
      .catch(error => console.error(error))
      .finally(() => setIsSaving(false));
  };

  return (
    <Dialog open={ open } onClose={ close } fullWidth maxWidth="xs">
      <DialogTitle>Change the next alarm</DialogTitle>
      <DialogContent sx={ { display: 'flex', flexDirection: 'column', gap: 2 } }>
        <Typography variant="body2" sx={ { color: 'text.secondary' } }>
          Just this once. It goes off the next time the clock shows this time, and your weekly schedule stays as it is.
        </Typography>
        <TimeField
          label="Alarm time"
          value={ alarmTimeLocalOverride || scheduledAlarmTimeHhMm }
          onChange={ setAlarmTimeLocalOverride }
          disabled={ isSaving }
        />
      </DialogContent>
      <DialogActions sx={ { px: 3, pb: 2 } }>
        { hasOneTimeAlarm && (
          <Button onClick={ () => send(cancelOneTimeAlarm(targetSide)) } disabled={ isSaving } sx={ { mr: 'auto' } }>
            Back to schedule
          </Button>
        ) }
        <Button onClick={ close } disabled={ isSaving }>Cancel</Button>
        <Button
          variant="contained"
          onClick={ () => send(postOneTimeAlarm(targetSide, alarmTimeLocalOverride)) }
          disabled={ isSaving || !alarmTimeLocalOverride || alarmTimeLocalOverride === scheduledAlarmTimeHhMm }
        >
          Set
        </Button>
      </DialogActions>
    </Dialog>
  );
}
