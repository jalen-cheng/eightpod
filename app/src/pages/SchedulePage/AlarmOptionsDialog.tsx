import {
  Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Slider, TextField,
  ToggleButton, ToggleButtonGroup, Typography,
} from '@mui/material';
import { PropsWithChildren } from 'react';
import { AlarmSchedule } from '@api/schedulesSchema.ts';
import { useScheduleStore } from './scheduleStore.tsx';
import { TemperatureSelect } from './ScheduleFields.tsx';

// 0 means no warm-up
const WARM_UP_MINUTES = [0, 15, 30, 45];

export const PATTERN_NAMES: Record<AlarmSchedule['vibrationPattern'], string> = {
  rise: 'Ramp up',
  double: 'Pulses',
};

// One labelled line of the options: the label on the left, its control on the right
const OptionRow = ({ label, hint, children }: PropsWithChildren<{ label: string; hint?: string }>) => (
  <Box sx={ { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, minHeight: 44 } }>
    <Box sx={ { minWidth: 0 } }>
      <Typography variant="body2" sx={ { fontWeight: 500 } }>{ label }</Typography>
      { hint && <Typography variant="caption" sx={ { color: 'text.secondary' } }>{ hint }</Typography> }
    </Box>
    <Box sx={ { flexShrink: 0 } }>{ children }</Box>
  </Box>
);

type AlarmOptionsDialogProps = {
  open: boolean;
  onClose: () => void;
};

// Everything about the alarm except its time: how it vibrates and the warm-up before it. (It
// always keeps going until dismissed.) Changes go into the schedule being edited
// and are saved with it.
// eslint-disable-next-line react/no-multi-comp
export default function AlarmOptionsDialog({ open, onClose }: AlarmOptionsDialogProps) {
  const { selectedSchedule, updateSelectedSchedule } = useScheduleStore();
  if (!selectedSchedule) return null;

  const { alarm } = selectedSchedule;
  const updateAlarm = (changes: Partial<AlarmSchedule>) => updateSelectedSchedule({ alarm: changes });
  const preWarmMinutes = alarm.preWarmMinutes ?? 0;

  return (
    <Dialog open={ open } onClose={ onClose } fullWidth maxWidth="xs">
      <DialogTitle>Alarm options</DialogTitle>
      <DialogContent sx={ { display: 'flex', flexDirection: 'column', gap: 1.5 } }>
        <OptionRow label="Vibration" hint="Keeps going until dismissed. Ramp up builds over 40 seconds.">
          <ToggleButtonGroup
            exclusive
            size="small"
            value={ alarm.vibrationPattern }
            onChange={ (_event, vibrationPattern: AlarmSchedule['vibrationPattern'] | null) => {
              if (vibrationPattern !== null) updateAlarm({ vibrationPattern });
            } }
            aria-label="Vibration"
          >
            <ToggleButton value="rise" sx={ { whiteSpace: 'nowrap' } }>{ PATTERN_NAMES.rise }</ToggleButton>
            <ToggleButton value="double" sx={ { whiteSpace: 'nowrap' } }>{ PATTERN_NAMES.double }</ToggleButton>
          </ToggleButtonGroup>
        </OptionRow>

        <Box>
          <Typography variant="body2" sx={ { fontWeight: 500 } }>Strength { alarm.vibrationIntensity }%</Typography>
          <Slider
            value={ alarm.vibrationIntensity }
            min={ 1 }
            max={ 100 }
            onChange={ (_event, vibrationIntensity) => updateAlarm({ vibrationIntensity: vibrationIntensity as number }) }
            aria-label="Vibration strength"
          />
        </Box>

        <OptionRow label="Warm the bed before" hint="Pick a time, then the temperature">
          <TextField
            select
            size="small"
            value={ preWarmMinutes }
            onChange={ (event) => updateAlarm({ preWarmMinutes: Number(event.target.value) }) }
            sx={ { width: 112 } }
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
      </DialogContent>
      <DialogActions>
        <Button onClick={ onClose }>Done</Button>
      </DialogActions>
    </Dialog>
  );
}
