import { Switch } from '@mui/material';
import { DeepPartial } from 'ts-essentials';
import { Settings } from '@api/settingsSchema.ts';
import { useAppStore } from '@state/appStore.tsx';
import SettingToggle from '../SettingsPage/SettingToggle.tsx';

type DailyRebootProps = {
  settings?: Settings;
  updateSettings: (settings: DeepPartial<Settings>) => void;
};

export default function DailyReboot({ settings, updateSettings }: DailyRebootProps) {
  const { isUpdating } = useAppStore();
  return (
    <SettingToggle
      label="Reboot once a day"
      info="Restarts the Pod once a day to keep it running smoothly, one hour before the daily priming time."
      control={
        <Switch
          disabled={ isUpdating }
          checked={ settings?.rebootDaily || false }
          onChange={ (event) => updateSettings({ rebootDaily: event.target.checked }) }
        />
      }
    />
  );
}
