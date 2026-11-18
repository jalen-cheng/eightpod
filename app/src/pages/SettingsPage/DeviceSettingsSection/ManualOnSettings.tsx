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

const LENGTH_INFO = 'Applies when you turn the bed on in the app, with a shortcut, or with the buttons on the bed. '
  + 'The schedule has its own off time.';
const OVERRIDE_INFO = 'While a side you switched on yourself is on, its schedule is skipped: no scheduled power, temperature '
  + 'changes or warm-up. Alarms still go off. It ends when the side turns off.';

// What happens when the bed is switched on by hand (app, shortcut or the buttons on the bed):
// how long it stays on, and whether the schedule leaves it alone meanwhile.
export default function ManualOnSettings({ settings, updateSettings }: ManualOnSettingsProps) {
  const { isUpdating } = useAppStore();
  if (!settings) return null;

  return (
    <>
      <SettingRow label="Manual on lasts" info={ LENGTH_INFO }>
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
        label="Ignore the schedule meanwhile"
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
