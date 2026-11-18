import { Box, TextField } from '@mui/material';

import { Settings } from '@api/settingsSchema.ts';
import { DeepPartial } from 'ts-essentials';
import { useAppStore } from '@state/appStore.tsx';
import Switch from '@mui/material/Switch';
import SettingToggle from './SettingToggle.tsx';
import SettingRow, { CONTROL_WIDTH_PX } from './SettingRow.tsx';


type PrimePodScheduleProps = {
  settings?: Settings;
  updateSettings: (settings: DeepPartial<Settings>) => void;
}

export default function DailyPriming({ settings, updateSettings }: PrimePodScheduleProps) {
  const { isUpdating } = useAppStore();

  return (
    <>
      <Box sx={ { display: 'flex', flexDirection: 'column', gap: 1.5 } }>
        <SettingToggle
          control={
            <Switch
              disabled={ isUpdating }
              checked={ settings?.primePodDaily?.enabled || false }
              onChange={ (event) => updateSettings({ primePodDaily: { enabled: event.target.checked } }) }
            />
          }
          label="Prime daily"
        />
        <SettingRow label="Prime time">
          <TextField
            type="time"
            size="small"
            value={ settings?.primePodDaily?.time || '12:00' }
            onChange={ (event) => { if (event.target.value) updateSettings({ primePodDaily: { time: event.target.value } }); } }
            disabled={ isUpdating || settings?.primePodDaily?.enabled === false }
            sx={ { width: CONTROL_WIDTH_PX } }
            slotProps={ { htmlInput: { 'aria-label': 'Prime time' } } }
          />
        </SettingRow>
      </Box>
    </>
  );
}
