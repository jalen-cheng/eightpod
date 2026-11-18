import { Dispatch, SetStateAction, useState } from 'react';
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle } from '@mui/material';
import InfoTip from '@components/InfoTip.tsx';
import { postOneTimeAlarm } from '@api/alarm.ts';
import { useSettings } from '@api/settings.ts';
import { useAppStore } from '@state/appStore.tsx';
import { TimeField } from '../SchedulePage/ScheduleFields.tsx';

export interface AlarmOverrideProps {
  open: boolean;
  // The time picked in this dialog, "HH:mm", or '' when nothing has been picked yet
  alarmTimeLocalOverride: string;
  // The alarm that will go off as things stand, "HH:mm"
  scheduledAlarmTime: string;
  setAlarmTimeLocalOverride: Dispatch<SetStateAction<string>>;
  setOverrideOpen: Dispatch<SetStateAction<boolean>>;
}

// Changes the next alarm for one night only. The weekly schedule is left alone; the alarm goes
// off the next time the clock shows the chosen time. With the sides linked it applies to both.
export default function AlarmOverride({
  open,
  setOverrideOpen,
  alarmTimeLocalOverride,
  scheduledAlarmTime,
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
      <DialogTitle sx={ { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 } }>
        Change next alarm only (overrides schedule)
        <InfoTip
          text="It goes off the next time the clock shows this time, in place of that morning's alarm. For every week, use Schedules."
        />
      </DialogTitle>
      <DialogContent>
        <Box sx={ { display: 'flex', justifyContent: 'center', py: 1 } }>
          <TimeField
            label="Alarm time"
            value={ alarmTimeLocalOverride || scheduledAlarmTime }
            onChange={ setAlarmTimeLocalOverride }
            disabled={ isSaving }
            isLarge
          />
        </Box>
      </DialogContent>
      <DialogActions sx={ { px: 3, pb: 2 } }>
        <Button onClick={ close } disabled={ isSaving } sx={ { mr: 'auto' } }>Cancel</Button>
        <Button
          variant="contained"
          onClick={ () => send(postOneTimeAlarm(targetSide, alarmTimeLocalOverride)) }
          disabled={ isSaving || !alarmTimeLocalOverride || alarmTimeLocalOverride === scheduledAlarmTime }
        >
          Set
        </Button>
      </DialogActions>
    </Dialog>
  );
}
