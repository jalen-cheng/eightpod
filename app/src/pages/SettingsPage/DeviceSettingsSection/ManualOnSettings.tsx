import { DeepPartial } from 'ts-essentials';
import { Box, MenuItem, Switch, TextField, Typography } from '@mui/material';
import { MANUAL_ON_HOUR_CHOICES, Settings } from '@api/settingsSchema.ts';
import { useAppStore } from '@state/appStore.tsx';
import InfoTip from '@components/InfoTip.tsx';
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
    <Box sx={ { display: 'flex', flexDirection: 'column', gap: 1.5 } }>
      <Box sx={ { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 } }>
        <Typography sx={ { fontSize: 13, fontWeight: 500 } }>
          When turned on by hand, stay on for{ ' ' }
          <InfoTip text={ LENGTH_INFO }/>
        </Typography>
        <TextField
          select
          size="small"
          value={ settings.manualOn.hours }
          onChange={ (event) => updateSettings({ manualOn: { hours: Number(event.target.value) as Settings['manualOn']['hours'] } }) }
          disabled={ isUpdating }
          sx={ { width: 104, flexShrink: 0 } }
          slotProps={ { htmlInput: { 'aria-label': 'How long the bed stays on when turned on by hand' } } }
        >
          { MANUAL_ON_HOUR_CHOICES.map(hours => <MenuItem key={ hours } value={ hours }>{ hours } hours</MenuItem>) }
        </TextField>
      </Box>
      <SettingToggle
        label="Ignore the schedule until it turns off"
        info={ OVERRIDE_INFO }
        control={
          <Switch
            disabled={ isUpdating }
            checked={ settings.manualOn.overridesSchedule }
            onChange={ (event) => updateSettings({ manualOn: { overridesSchedule: event.target.checked } }) }
          />
        }
      />
    </Box>
  );
}
