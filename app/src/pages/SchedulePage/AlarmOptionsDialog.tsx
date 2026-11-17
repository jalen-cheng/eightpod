import {
  Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Slider, Switch, TextField,
  ToggleButton, ToggleButtonGroup, Typography,
} from '@mui/material';
import _ from 'lodash';
import { PropsWithChildren, useEffect, useState } from 'react';
import { postAlarm } from '@api/alarm.ts';
import { postDeviceStatus } from '@api/deviceStatus.ts';
import { useAppStore } from '@state/appStore.tsx';
import { buildSidesPayload, getControlledSides } from '@lib/sides.ts';
import { AlarmSchedule } from '@api/schedulesSchema.ts';
import InfoTip from '@components/InfoTip.tsx';
import { useScheduleStore } from './scheduleStore.tsx';
import { TemperatureSelect } from './ScheduleFields.tsx';

const SECONDS_PER_MINUTE = 60;
// An alarm keeps going until it is dismissed, up to this long
const ALARM_LENGTH_MINUTES = [10, 15, 20, 30];
// A test runs the ramp-up and a little of full strength, then stops by itself
const TEST_SECONDS = 60;
// 0 means no warm-up
const WARM_UP_MINUTES = [0, 15, 30, 45];

const BED_OFF_ON_DISMISS_INFO = 'The bed turns off the moment you dismiss the alarm, instead of 30 minutes after the wake-up time.';

export const PATTERN_NAMES: Record<AlarmSchedule['vibrationPattern'], string> = {
  rise: 'Ramp up',
  double: 'Pulses',
};

type OptionRowProps = PropsWithChildren<{
  label: string;
  // Extra detail, shown from an "i" beside the label
  info?: string;
  // Puts the control under the label at full width, for controls too wide to share a line on a phone
  isStacked?: boolean;
}>;

// One labelled option: the label on the left and its control on the right, or stacked
const OptionRow = ({ label, info, isStacked, children }: OptionRowProps) => (
  <Box
    sx={ {
      display: 'flex', gap: isStacked ? 1 : 2, minHeight: 44,
      flexDirection: isStacked ? 'column' : 'row',
      alignItems: isStacked ? 'stretch' : 'center',
      justifyContent: 'space-between',
    } }
  >
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
        <OptionRow label="Vibration" info="Ramp up builds to full strength over 40 seconds. Pulses start at full strength." isStacked>
          <ToggleButtonGroup
            exclusive
            fullWidth
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

        <OptionRow label="Length" info="How long it keeps going. It stops sooner if you dismiss it.">
          <TextField
            select
            size="small"
            value={ lengthMinutes }
            onChange={ (event) => updateAlarm({ duration: Number(event.target.value) * SECONDS_PER_MINUTE }) }
            sx={ { width: 132 } }
            slotProps={ { htmlInput: { 'aria-label': 'Alarm length' } } }
          >
            { lengthOptions.map(minutes => (
              <MenuItem key={ minutes } value={ minutes }>{ minutes < 1 ? 'Under 1 min' : `${minutes} min` }</MenuItem>
            )) }
          </TextField>
        </OptionRow>

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
