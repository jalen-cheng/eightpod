import {
  Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Slider, TextField,
  ToggleButton, ToggleButtonGroup, Typography,
} from '@mui/material';
import _ from 'lodash';
import { PropsWithChildren, useEffect, useState } from 'react';
import { postAlarm } from '@api/alarm.ts';
import { postDeviceStatus } from '@api/deviceStatus.ts';
import { useAppStore } from '@state/appStore.tsx';
import { buildSidesPayload, getControlledSides } from '@lib/sides.ts';
import { AlarmSchedule } from '@api/schedulesSchema.ts';
import { useScheduleStore } from './scheduleStore.tsx';
import { TemperatureSelect } from './ScheduleFields.tsx';

const SECONDS_PER_MINUTE = 60;
// An alarm keeps going until it is dismissed, up to this long
const ALARM_LENGTH_MINUTES = [10, 15, 20, 30];
// A test runs the ramp-up and a little of full strength, then stops by itself
const TEST_SECONDS = 60;
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

// Everything about the alarm except its time: how it vibrates, how long for, and the warm-up
// before it. Changes go into the schedule being edited and are saved with it. The test runs the
// vibration as set on screen, saved or not.
// eslint-disable-next-line react/no-multi-comp
export default function AlarmOptionsDialog({ open, onClose }: AlarmOptionsDialogProps) {
  const { selectedSchedule, updateSelectedSchedule } = useScheduleStore();
  const { side, linkSides } = useAppStore();
  const [isTesting, setIsTesting] = useState(false);
  // The test ends by itself; the button goes back to "Test" when it has
  useEffect(() => {
    if (!isTesting) return undefined;
    const testEndTimer = setTimeout(() => setIsTesting(false), TEST_SECONDS * 1_000);
    return () => clearTimeout(testEndTimer);
  }, [isTesting]);
  if (!selectedSchedule) return null;

  const { alarm } = selectedSchedule;
  const updateAlarm = (changes: Partial<AlarmSchedule>) => updateSelectedSchedule({ alarm: changes });
  const preWarmMinutes = alarm.preWarmMinutes ?? 0;
  const lengthMinutes = Math.round(alarm.duration / SECONDS_PER_MINUTE);
  // An alarm saved with some other length keeps it until a new one is picked
  const lengthOptions = _.sortBy(_.union(ALARM_LENGTH_MINUTES, [lengthMinutes]));
  const testSides = getControlledSides(side, linkSides);

  // Vibrates the bed now, whether or not the side is on, so the settings can be felt
  const startTest = () => {
    setIsTesting(true);
    const { vibrationIntensity, vibrationPattern } = alarm;
    Promise.all(testSides.map(testSide => (
      postAlarm({ side: testSide, vibrationIntensity, vibrationPattern, duration: TEST_SECONDS, force: true })
    ))).catch((error) => {
      console.error(error);
      setIsTesting(false);
    });
  };

  const stopTest = () => {
    setIsTesting(false);
    postDeviceStatus(buildSidesPayload(testSides, { isAlarmVibrating: false })).catch(error => console.error(error));
  };

  return (
    <Dialog open={ open } onClose={ onClose } fullWidth maxWidth="xs">
      <DialogTitle>Alarm options</DialogTitle>
      <DialogContent sx={ { display: 'flex', flexDirection: 'column', gap: 1.5 } }>
        <OptionRow label="Vibration" hint="Ramp up builds over 40 seconds">
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

        <OptionRow label="Keeps going for" hint="Until you dismiss it">
          <TextField
            select
            size="small"
            value={ lengthMinutes }
            onChange={ (event) => updateAlarm({ duration: Number(event.target.value) * SECONDS_PER_MINUTE }) }
            sx={ { width: 112 } }
            slotProps={ { htmlInput: { 'aria-label': 'Alarm length' } } }
          >
            { lengthOptions.map(minutes => (
              <MenuItem key={ minutes } value={ minutes }>{ minutes < 1 ? 'Under a minute' : `${minutes} min` }</MenuItem>
            )) }
          </TextField>
        </OptionRow>

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
      <DialogActions sx={ { px: 3, pb: 2 } }>
        <Button onClick={ isTesting ? stopTest : startTest } sx={ { mr: 'auto' } }>
          { isTesting ? 'Stop test' : 'Test for a minute' }
        </Button>
        <Button onClick={ onClose }>Done</Button>
      </DialogActions>
    </Dialog>
  );
}
