import { DeepPartial } from 'ts-essentials';
import { Box, Divider, Switch } from '@mui/material';
import { Settings } from '@api/settingsSchema.ts';
import { useAppStore } from '@state/appStore.tsx';
import { SENTRY_DSN } from '../../sentry.tsx';
import BiometricsSetting from './BiometricsSetting.tsx';
import LedSwitch from './DeviceSettingsSection/LedSwitch.tsx';
import ManualOnSettings from './DeviceSettingsSection/ManualOnSettings.tsx';
import Section from './Section.tsx';
import SettingToggle from './SettingToggle.tsx';
import { useUpdateServices } from './useUpdateServices.ts';

const FLIP_SIDES_INFO = 'Swaps which side of the bed the app calls left and right, everywhere: controls, schedules, buttons '
  + 'and in-bed detection. Each side keeps its schedule and settings.';

type OtherSectionProps = {
  settings?: Settings;
  updateSettings: (settings: DeepPartial<Settings>) => void;
};

// Settings that are set once and rarely looked at again: which way round the bed is, the hub's
// light, what turning the bed on by hand does, and the older biometrics service
export default function OtherSection({ settings, updateSettings }: OtherSectionProps) {
  const { isUpdating } = useAppStore();
  const { services, updateServices } = useUpdateServices();

  return (
    <Section title="Other">
      <Box sx={ { display: 'flex', flexDirection: 'column', gap: 1.75 } }>
        <SettingToggle
          label="Flip left and right"
          info={ FLIP_SIDES_INFO }
          control={
            <Switch
              disabled={ isUpdating }
              checked={ settings?.swapSides || false }
              onChange={ (event) => updateSettings({ swapSides: event.target.checked }) }
            />
          }
        />
        <LedSwitch/>
        <Divider/>
        <ManualOnSettings settings={ settings } updateSettings={ updateSettings }/>
        <Divider/>
        <BiometricsSetting/>
        { /* Only offered in a build that has somewhere to send reports */ }
        { SENTRY_DSN && services && (
          <>
            <Divider/>
            <SettingToggle
              control={
                <Switch
                  disabled={ isUpdating }
                  checked={ services.sentryLogging.enabled }
                  onChange={ (event) => updateServices({ sentryLogging: { enabled: event.target.checked } }) }
                />
              }
              label="Enable Sentry error reporting"
              info="Sends anonymous error reports. Nothing is sent while the internet block is on."
            />
          </>
        ) }
      </Box>
    </Section>
  );
}
