import { Box, Divider, MenuItem, TextField } from '@mui/material';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import { DeepPartial } from 'ts-essentials';

import { useDeviceStatus } from '@api/deviceStatus.ts';
import { Version } from '@api/deviceStatusSchema.ts';
import { Settings } from '@api/settingsSchema.ts';
import { useAppStore } from '@state/appStore.tsx';
import { formatTemperatureDelta, getStepOptions, snapStep } from '@lib/temperatureConversions.ts';
import Section from '../Section.tsx';
import TapSettingRow from './TapSettingRow.tsx';
import { SharedTapSettings, buildSideTaps, readSharedTapSettings } from './tapSettings.ts';

// The section sets `overflow-wrap: anywhere`, which would otherwise break button labels mid-word
const toggleGroupSx = { '& .MuiToggleButton-root': { flex: 1, py: 0.5, px: 1.5, whiteSpace: 'nowrap' } };
const selectSx = { width: 112, flexShrink: 0 };

type TapGesturesSectionProps = {
  settings?: Settings;
  updateSettings: (settings: DeepPartial<Settings>) => void;
}

// The wording for each control. A Pod 4 cover counts taps; a Pod 5 cover has three buttons per
// side, and each button uses the settings of the tap gesture that does the same job.
const TAP_LABELS = {
  title: 'Tap gestures',
  temperature: 'Double tap / triple tap',
  duringAlarm: 'Quadruple tap during an alarm',
  otherwise: 'Quadruple tap at other times',
};
const BUTTON_LABELS: typeof TAP_LABELS = {
  title: 'Side buttons',
  temperature: '− button / + button',
  duringAlarm: 'Any button during an alarm',
  otherwise: 'Middle button at other times',
};

// What the controls on the side of the bed do. One set of choices, applied to both sides.
// Pod 3 covers have no tap sensors.
export default function TapGesturesSection({ settings, updateSettings }: TapGesturesSectionProps) {
  const { data: deviceStatus } = useDeviceStatus();
  const { isUpdating } = useAppStore();
  // A Pod 3 cover has no tap sensors. A Pod 5's buttons have one choice, which is in Device settings.
  if (!settings || !deviceStatus || deviceStatus.coverVersion === Version.Pod3 || deviceStatus.coverVersion === Version.Pod5) return null;

  const hasButtons = deviceStatus.coverVersion === Version.Pod5;
  const labels = hasButtons ? BUTTON_LABELS : TAP_LABELS;
  const temperatureFormat = settings.temperatureFormat;
  // Both sides are kept the same, so either side can be read
  const tapSettings = readSharedTapSettings(settings.left.taps);

  const saveTapSettings = (changes: Partial<SharedTapSettings>) => {
    const taps = buildSideTaps({ ...tapSettings, ...changes });
    updateSettings({ left: { taps }, right: { taps } });
  };

  return (
    <Section title={ labels.title }>
      <Box sx={ { display: 'flex', flexDirection: 'column', gap: 2 } }>
        <TapSettingRow gesture={ labels.temperature } action="Cooler / warmer, by this much">
          <TextField
            select
            size="small"
            value={ snapStep(tapSettings.temperatureStepF, temperatureFormat) }
            onChange={ (event) => saveTapSettings({ temperatureStepF: Number(event.target.value) }) }
            disabled={ isUpdating }
            sx={ selectSx }
            slotProps={ { htmlInput: { 'aria-label': 'Temperature step' } } }
          >
            { getStepOptions(temperatureFormat).map(stepF => (
              <MenuItem key={ stepF } value={ stepF }>{ formatTemperatureDelta(stepF, temperatureFormat) }</MenuItem>
            )) }
          </TextField>
        </TapSettingRow>
        <Divider/>
        <TapSettingRow
          gesture={ labels.duringAlarm }
          action={ hasButtons ? 'Any button stops the alarm' : 'Stops the alarm' }
        />
        { !hasButtons && <Divider/> }
        { !hasButtons && (
          <TapSettingRow
            gesture={ labels.otherwise }
            action="When no alarm is going off"
          >
            <ToggleButtonGroup
              disabled={ isUpdating }
              size="small"
              value={ tapSettings.inactiveAlarmBehavior }
              exclusive
              onChange={ (_event, inactiveAlarmBehavior: SharedTapSettings['inactiveAlarmBehavior'] | null) => {
                if (inactiveAlarmBehavior !== null) saveTapSettings({ inactiveAlarmBehavior });
              } }
              aria-label={ labels.otherwise }
              sx={ { ...toggleGroupSx, flex: 1 } }
            >
              <ToggleButton value="power">Turn side on / off</ToggleButton>
              <ToggleButton value="none">Do nothing</ToggleButton>
            </ToggleButtonGroup>
          </TapSettingRow>
        ) }
        { hasButtons && (
          <>
            <Divider/>
            <TapSettingRow
              gesture="Hold the middle button"
              action="Two seconds or more turns that side on or off (both sides when linked)"
            />
          </>
        ) }
      </Box>
    </Section>
  );
}
