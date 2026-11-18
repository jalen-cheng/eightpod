import {
  Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Switch, TextField, Typography,
} from '@mui/material';
import _ from 'lodash';
import { PropsWithChildren, useEffect, useState } from 'react';
import { useAppStore } from '@state/appStore.tsx';
import { AlarmSchedule, MAX_ALARM_SECONDS } from '@api/schedulesSchema.ts';
import InfoTip from '@components/InfoTip.tsx';
import { useScheduleStore } from './scheduleStore.tsx';
import { TemperatureSelect } from './ScheduleFields.tsx';

// 0 means no warm-up
const WARM_UP_MINUTES = [0, 15, 30, 45];

// Upstream's alarms ran for seconds. One saved that short has never been set up in this app.
const SET_UP_ALARM_SECONDS = 600;

const BED_OFF_ON_DISMISS_INFO = 'The bed turns off the moment you dismiss the alarm, instead of 30 minutes after the wake-up time.';

type OptionRowProps = PropsWithChildren<{
  label: string;
  // Extra detail, shown from an "i" beside the label
  info?: string;
}>;

// One labelled option: the label on the left and its control on the right
const OptionRow = ({ label, info, children }: OptionRowProps) => (
  <Box sx={ { display: 'flex', gap: 2, minHeight: 44, alignItems: 'center', justifyContent: 'space-between' } }>
    <Box sx={ { display: 'flex', alignItems: 'center', gap: 0.5, minWidth: 0 } }>
      <Typography variant="body2" noWrap sx={ { fontWeight: 500 } }>{ label }</Typography>
      { info && <InfoTip text={ info }/> }
    </Box>
    <Box sx={ { flexShrink: 0 } }>{ children }</Box>
  </Box>
);

type AlarmOptionsDialogProps = {
  open: boolean;
  onClose: () => void;
  // Saves the night being edited, as the page's own Save does
  onSave: () => Promise<void>;
};

// What happens at this night's wake time: whether the bed vibrates, the warm-up before it, and
// whether dismissing turns the bed off. How the alarm vibrates is one setting for every night, in
// Settings. Save writes the night as the page's Save does; Discard puts the alarm back as it was
// when the dialog opened.
// eslint-disable-next-line react/no-multi-comp
export default function AlarmOptionsDialog({ open, onClose, onSave }: AlarmOptionsDialogProps) {
  const { selectedSchedule, updateSelectedSchedule, replaceSelectedAlarm, changesPresent, isValid } = useScheduleStore();
  const { isUpdating } = useAppStore();
  // The alarm as it was when the dialog opened, for Discard
  const [alarmAtOpen, setAlarmAtOpen] = useState<AlarmSchedule | undefined>(undefined);
  useEffect(() => {
    // Forgotten on close, so the next opening never compares against the last one's
    setAlarmAtOpen(open ? useScheduleStore.getState().selectedSchedule?.alarm : undefined);
  }, [open]);
  if (!selectedSchedule) return null;

  const { alarm } = selectedSchedule;
  const updateAlarm = (changes: Partial<AlarmSchedule>) => updateSelectedSchedule({ alarm: changes });
  // Switching on an alarm that was never set up gives it a length that keeps going until
  // dismissed. Its pattern and strength are left to Settings.
  const setAlarmEnabled = (enabled: boolean) => {
    const needsLength = enabled && alarm.duration < SET_UP_ALARM_SECONDS;
    updateAlarm(needsLength ? { enabled, duration: MAX_ALARM_SECONDS } : { enabled });
  };
  const preWarmMinutes = alarm.preWarmMinutes ?? 0;

  const hasAlarmChanged = alarmAtOpen !== undefined && !_.isEqual(alarm, alarmAtOpen);
  const discard = () => {
    if (alarmAtOpen) replaceSelectedAlarm(alarmAtOpen);
    onClose();
  };
  const save = () => {
    onClose();
    if (changesPresent) void onSave();
  };

  return (
    <Dialog open={ open } onClose={ onClose } fullWidth maxWidth="xs">
      <DialogTitle>Wake-up</DialogTitle>
      <DialogContent sx={ { display: 'flex', flexDirection: 'column', gap: 1 } }>
        <OptionRow label="Vibrating alarm" info="How it vibrates is set once for every night, in Settings.">
          <Switch
            checked={ alarm.enabled }
            onChange={ (event) => setAlarmEnabled(event.target.checked) }
            slotProps={ { input: { 'aria-label': 'Vibrating alarm at the wake-up time' } } }
          />
        </OptionRow>

        { /* With the alarm off the rest stays in view, dimmed, so switching it on is not a surprise */ }
        <Box
          sx={ {
            display: 'flex', flexDirection: 'column', gap: 1, transition: 'opacity 150ms ease',
            ...(alarm.enabled ? {} : { opacity: 0.35, pointerEvents: 'none' }),
          } }
          inert={ !alarm.enabled }
        >
          <OptionRow label="Warm-up" info="The bed goes to the warm-up temperature this long before the alarm.">
            <TextField
              select
              size="small"
              value={ preWarmMinutes }
              onChange={ (event) => updateAlarm({ preWarmMinutes: Number(event.target.value) }) }
              sx={ { width: 132 } }
              slotProps={ { htmlInput: { 'aria-label': 'Warm up before the alarm' } } }
            >
              { WARM_UP_MINUTES.map(minutes => (
                <MenuItem key={ minutes } value={ minutes }>{ minutes === 0 ? 'Off' : `${minutes} min` }</MenuItem>
              )) }
            </TextField>
          </OptionRow>

          { preWarmMinutes > 0 && (
            <OptionRow label="Warm up to">
              <TemperatureSelect
                label="Warm up temperature"
                value={ alarm.alarmTemperature }
                onChange={ (alarmTemperature) => updateAlarm({ alarmTemperature }) }
              />
            </OptionRow>
          ) }

          <OptionRow label="Bed off on dismiss" info={ BED_OFF_ON_DISMISS_INFO }>
            <Switch
              checked={ alarm.turnOffAfterDismiss ?? false }
              onChange={ (event) => updateAlarm({ turnOffAfterDismiss: event.target.checked }) }
              slotProps={ { input: { 'aria-label': 'Turn the bed off when the alarm is dismissed' } } }
            />
          </OptionRow>
        </Box>
      </DialogContent>
      <DialogActions sx={ { px: 3, pb: 2 } }>
        <Button color="inherit" onClick={ discard } disabled={ isUpdating } sx={ { mr: 'auto' } }>
          { hasAlarmChanged ? 'Discard' : 'Close' }
        </Button>
        <Button variant="contained" onClick={ save } disabled={ isUpdating || !isValid() } sx={ { minWidth: 96 } }>Save</Button>
      </DialogActions>
    </Dialog>
  );
}
