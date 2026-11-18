import { Switch } from '@mui/material';
import { postDeviceStatus, useDeviceStatus } from '@api/deviceStatus.ts';
import { useAppStore } from '@state/appStore.tsx';
import SettingToggle from '../SettingToggle.tsx';

// The Pod takes a moment to report a change back
const STATUS_SETTLE_MS = 1_000;
const LED_ON_BRIGHTNESS = 100;

// The light on the hub, on or off. The firmware takes a brightness; on is full and off is zero.
export default function LedSwitch() {
  const { isUpdating, setIsUpdating } = useAppStore();
  const { data: deviceStatus, refetch } = useDeviceStatus();
  if (!deviceStatus) return null;

  const setLight = (isOn: boolean) => {
    setIsUpdating(true);
    postDeviceStatus({ settings: { ...deviceStatus.settings, ledBrightness: isOn ? LED_ON_BRIGHTNESS : 0 } })
      .then(() => new Promise(resolve => setTimeout(resolve, STATUS_SETTLE_MS)))
      .then(() => refetch())
      .catch(error => console.error(error))
      .finally(() => setIsUpdating(false));
  };

  return (
    <SettingToggle
      label="Light on the hub"
      control={
        <Switch
          disabled={ isUpdating }
          checked={ deviceStatus.settings.ledBrightness > 0 }
          onChange={ (event) => setLight(event.target.checked) }
        />
      }
    />
  );
}
