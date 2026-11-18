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
import { AlarmSchedule, MAX_ALARM_SECONDS } from '@api/schedulesSchema.ts';
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

// Upstream's alarms ran for seconds. One saved that short has never been set up in this app.
const SET_UP_ALARM_SECONDS = 600;

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
  // Saves the night being edited, as the page's own Save does
  onSave: () => Promise<void>;
};

// Everything about the alarm except its time: whether it vibrates at all, how, how long for, and
// the warm-up before it. Save writes the night as the page's Save does; Discard puts the alarm
// back as it was when the dialog opened. The test runs the vibration as set on screen, saved or not.
// eslint-disable-next-line react/no-multi-comp
export default function AlarmOptionsDialog({ open, onClose, onSave }: AlarmOptionsDialogProps) {
  const { selectedSchedule, updateSelectedSchedule, replaceSelectedAlarm, changesPresent, isValid } = useScheduleStore();
  const { side, linkSides, isUpdating } = useAppStore();
  // The alarm as it was when the dialog opened, for Discard
  const [alarmAtOpen, setAlarmAtOpen] = useState<AlarmSchedule | undefined>(undefined);
  useEffect(() => {
    if (open) setAlarmAtOpen(useScheduleStore.getState().selectedSchedule?.alarm);
  }, [open]);
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
  // Switching the alarm on gives it sensible settings if it has never been set up: a ramp-up
  // that keeps going until dismissed
  const setAlarmEnabled = (enabled: boolean) => {
    const needsDefaults = enabled && alarm.duration < SET_UP_ALARM_SECONDS;
    updateAlarm(needsDefaults ? { enabled, duration: MAX_ALARM_SECONDS, vibrationPattern: 'rise' } : { enabled });
  };
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

  const hasAlarmChanged = !_.isEqual(alarm, alarmAtOpen);
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
      <DialogTitle sx={ { display: 'flex', alignItems: 'center', justifyContent: 'space-between' } }>
        Alarm
        <Switch
          checked={ alarm.enabled }
          onChange={ (event) => setAlarmEnabled(event.target.checked) }
          slotProps={ { input: { 'aria-label': 'Vibrating alarm at the wake-up time' } } }
        />
      </DialogTitle>
      { /* With the alarm off its options stay in view, dimmed, so switching it on is not a surprise */ }
      <DialogContent
        sx={ {
          display: 'flex', flexDirection: 'column', gap: 1.5, transition: 'opacity 150ms ease',
          ...(alarm.enabled ? {} : { opacity: 0.35, pointerEvents: 'none' }),
        } }
        inert={ !alarm.enabled }
      >
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
          <Box sx={ { display: 'flex', alignItems: 'center', justifyContent: 'space-between', minHeight: 36 } }>
            <Typography variant="body2" sx={ { fontWeight: 500 } }>Strength { alarm.vibrationIntensity }%</Typography>
            { /* Beside the strength it lets you feel. It vibrates the bed for a minute, saved or not. */ }
            <Button size="small" onClick={ isTesting ? stopTest : startTest }>
              { isTesting ? 'Stop test' : 'Test for a minute' }
            </Button>
          </Box>
          <Slider
            value={ alarm.vibrationIntensity }
            min={ 1 }
            max={ 100 }
            onChange={ (_event, vibrationIntensity) => updateAlarm({ vibrationIntensity: vibrationIntensity as number }) }
            aria-label="Vibration strength"
            sx={ { width: 'calc(100% - 24px)', mx: 1.5, display: 'block' } }
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
        <Button color="inherit" onClick={ discard } disabled={ isUpdating } sx={ { mr: 'auto' } }>
          { hasAlarmChanged ? 'Discard' : 'Close' }
        </Button>
        <Button variant="contained" onClick={ save } disabled={ isUpdating || !isValid() } sx={ { minWidth: 96 } }>Save</Button>
      </DialogActions>
    </Dialog>
  );
}
