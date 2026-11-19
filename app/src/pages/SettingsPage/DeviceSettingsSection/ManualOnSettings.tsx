import { DeepPartial } from 'ts-essentials';
import { MenuItem, Switch, TextField } from '@mui/material';
import { MANUAL_ON_HOUR_CHOICES, Settings } from '@api/settingsSchema.ts';
import { useAppStore } from '@state/appStore.tsx';
import SettingRow, { CONTROL_WIDTH_PX } from '../SettingRow.tsx';
import SettingToggle from '../SettingToggle.tsx';

type ManualOnSettingsProps = {
  settings?: Settings;
  updateSettings: (settings: DeepPartial<Settings>) => void;
};

const LENGTH_INFO = 'How long the bed stays on when you turn it on yourself: in the app, with a shortcut, or with the '
  + 'buttons on the bed. The schedule has its own off time.';
const OVERRIDE_INFO = 'When you turn the bed on yourself, the schedule leaves it alone until it turns off: it will not '
  + 'change the temperature, warm up for the alarm, or switch the bed off at the scheduled time. Alarms still go off.';

// What happens when the bed is switched on by hand (app, shortcut or the buttons on the bed):
// how long it stays on, and whether the schedule leaves it alone meanwhile.
export default function ManualOnSettings({ settings, updateSettings }: ManualOnSettingsProps) {
  const { isUpdating } = useAppStore();
  if (!settings) return null;

  return (
    <>
      <SettingRow label="Auto-off after" info={ LENGTH_INFO }>
        <TextField
          select
          size="small"
          value={ settings.manualOn.hours }
          onChange={ (event) => updateSettings({ manualOn: { hours: Number(event.target.value) as Settings['manualOn']['hours'] } }) }
          disabled={ isUpdating }
          sx={ { width: CONTROL_WIDTH_PX } }
          slotProps={ { htmlInput: { 'aria-label': 'How long the bed stays on when turned on by hand' } } }
        >
          { MANUAL_ON_HOUR_CHOICES.map(hours => <MenuItem key={ hours } value={ hours }>{ hours } hours</MenuItem>) }
        </TextField>
      </SettingRow>
      <SettingToggle
        label="Pause the schedule until it turns off"
        info={ OVERRIDE_INFO }
        control={
          <Switch
            disabled={ isUpdating }
            checked={ settings.manualOn.overridesSchedule }
            onChange={ (event) => updateSettings({ manualOn: { overridesSchedule: event.target.checked } }) }
          />
        }
      />
    </>
  );
}
