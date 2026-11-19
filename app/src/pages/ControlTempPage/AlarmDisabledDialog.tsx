import { Dispatch, SetStateAction, useState } from 'react';
import { Button, Dialog, DialogActions, DialogTitle } from '@mui/material';
import moment from 'moment-timezone';
import { postSettings, useSettings } from '@api/settings.ts';
import { useAppStore } from '@state/appStore.tsx';
import { buildSidesPayload, getControlledSides } from '@lib/sides.ts';


export interface AlarmDisabledDialogProps {
  open: boolean;
  setOpen: Dispatch<SetStateAction<boolean>>;
  scheduledAlarmTime: string;
  alarmDisabled: boolean;
}

export default function AlarmDisabledDialog({
  open,
  setOpen,
  scheduledAlarmTime,
  alarmDisabled,
}: AlarmDisabledDialogProps) {
  const [isSaving, setIsSaving] = useState(false);
  const { data: settings, refetch } = useSettings();
  const { side, linkSides } = useAppStore();

  const handleSave = () => {
    if (!settings) return null;
    const now = moment.tz(settings.timeZone);
    const noonToday = now.clone().hour(12).minute(0).second(0).millisecond(0);
    const targetDay = now.isSameOrAfter(noonToday) ? now.clone().add(1, 'day') : now;


    const [hour, minute] = scheduledAlarmTime.split(':').map(Number);
    const expiresAt = moment.tz(
      {
        year: targetDay.year(),
        month: targetDay.month(),
        date: targetDay.date(),
        hour,
        minute,
        second: 0,
        millisecond: 0,
      },
      settings.timeZone
    ).add(2, 'minutes').format();
    setIsSaving(true);
    const disabled = !alarmDisabled;
    // With the sides linked the alarm is skipped on both, like every other change
    postSettings(buildSidesPayload(getControlledSides(side, linkSides), {
      scheduleOverrides: {
        alarm: {
          disabled: disabled,
          timeOverride: '',
          expiresAt: disabled ? expiresAt : '',
        }
      }
    }))
      .then(() => {
        setOpen(false);
        return refetch();
      })
      .catch(error => {
        console.error(error);
      })
      .finally(() => {
        setIsSaving(false);
      });
  };

  const handleCancel = () => {
    setOpen(false);
  };

  return (
    <Dialog open={ open } onClose={ handleCancel } fullWidth maxWidth="xs">
      <DialogTitle>{ alarmDisabled ? 'Turn the next alarm back on?' : 'Skip the next alarm?' }</DialogTitle>
      <DialogActions>
        <Button onClick={ handleCancel } disabled={ isSaving } sx={ { mr: 'auto' } }>Cancel</Button>
        <Button variant="contained" onClick={ handleSave } disabled={ isSaving }>
          { alarmDisabled ? 'Turn on' : 'Skip' }
        </Button>
      </DialogActions>
    </Dialog>
  );
}
