import { MenuItem, TextField } from '@mui/material';
import { DeepPartial } from 'ts-essentials';
import { Settings } from '@api/settingsSchema.ts';
import { useAppStore } from '@state/appStore.tsx';
import { formatTemperatureDelta, getStepOptions, snapStep } from '@lib/temperatureConversions.ts';
import SettingRow, { CONTROL_WIDTH_PX } from '../SettingRow.tsx';
import { buildSideTaps, readSharedTapSettings } from './tapSettings.ts';

type ButtonStepSettingProps = {
  settings: Settings;
  updateSettings: (settings: DeepPartial<Settings>) => void;
};

// How far one press of a Pod 5's - or + button moves the temperature. The other buttons have
// nothing to choose: holding the middle one switches the side, and any button stops an alarm.
export default function ButtonStepSetting({ settings, updateSettings }: ButtonStepSettingProps) {
  const { isUpdating } = useAppStore();
  const temperatureFormat = settings.temperatureFormat;
  // Both sides are kept the same, so either side can be read
  const tapSettings = readSharedTapSettings(settings.left.taps);

  const saveStep = (temperatureStepF: number) => {
    const taps = buildSideTaps({ ...tapSettings, temperatureStepF });
    updateSettings({ left: { taps }, right: { taps } });
  };

  return (
    <SettingRow label="− and + buttons" info="How far one press of a button on the side of the bed moves the temperature.">
      <TextField
        select
        size="small"
        value={ snapStep(tapSettings.temperatureStepF, temperatureFormat) }
        onChange={ (event) => saveStep(Number(event.target.value)) }
        disabled={ isUpdating }
        sx={ { width: CONTROL_WIDTH_PX } }
        slotProps={ { htmlInput: { 'aria-label': 'Temperature step' } } }
      >
        { getStepOptions(temperatureFormat).map(stepF => (
          <MenuItem key={ stepF } value={ stepF }>{ formatTemperatureDelta(stepF, temperatureFormat) } a press</MenuItem>
        )) }
      </TextField>
    </SettingRow>
  );
}
