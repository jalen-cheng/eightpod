import { DeepPartial } from 'ts-essentials';
import { Box, Divider, Switch } from '@mui/material';
import TuneOutlinedIcon from '@mui/icons-material/TuneOutlined';
import { useDeviceStatus } from '@api/deviceStatus.ts';
import { Version } from '@api/deviceStatusSchema.ts';
import { Settings } from '@api/settingsSchema.ts';
import { useAppStore } from '@state/appStore.tsx';
import Section from '../Section.tsx';
import SettingToggle from '../SettingToggle.tsx';
import ButtonStepSetting from '../TapGesturesSection/ButtonStepSetting.tsx';
import TimeZoneSelector from './TimeZoneSelector.tsx';
import TemperatureFormatSelector from './TemperatureFormatSelector.tsx';
import LedBrightnessSlider from './LedBrightnessSlider.tsx';
import ManualOnSettings from './ManualOnSettings.tsx';
import { useSettings } from '@api/settings.ts';

const AWAY_MODE_INFO = 'For when nobody is home. The schedule and alarms stop on both sides until you switch this off.';
const FLIP_SIDES_INFO = 'Swaps which side of the bed the app calls left and right, everywhere: controls, schedules, buttons '
  + 'and in-bed detection. Each side keeps its schedule and settings.';

type UpdateSettingsFn = (settings: DeepPartial<Settings>) => void;
type DeviceSettingsSectionProps = { updateSettings: UpdateSettingsFn };

// Settings for the bed as a whole: the clock and units, turning on by hand, away mode, which
// side is which, the side buttons and the light
export default function DeviceSettingsSection({ updateSettings }: DeviceSettingsSectionProps) {
  const { data: settings } = useSettings();
  const { data: deviceStatus } = useDeviceStatus();
  const { isUpdating } = useAppStore();
  const hasButtons = deviceStatus?.coverVersion === Version.Pod5;

  return (
    <Section title="Device settings" icon={ <TuneOutlinedIcon/> }>
      <Box sx={ { display: 'flex', flexDirection: 'column', gap: 2.5 } }>
        <TimeZoneSelector settings={ settings } updateSettings={ updateSettings }/>
        <TemperatureFormatSelector settings={ settings } updateSettings={ updateSettings }/>
        <Divider/>
        <ManualOnSettings settings={ settings } updateSettings={ updateSettings }/>
        { hasButtons && settings && <ButtonStepSetting settings={ settings } updateSettings={ updateSettings }/> }
        <Divider/>
        <SettingToggle
          label="Away mode"
          info={ AWAY_MODE_INFO }
          control={
            <Switch
              disabled={ isUpdating }
              // Away is for the whole bed: on only when both sides are away
              checked={ Boolean(settings?.left.awayMode && settings?.right.awayMode) }
              onChange={ (event) => updateSettings({ left: { awayMode: event.target.checked }, right: { awayMode: event.target.checked } }) }
            />
          }
        />
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
        <Divider/>
        <LedBrightnessSlider/>
      </Box>
    </Section>
  );
}
