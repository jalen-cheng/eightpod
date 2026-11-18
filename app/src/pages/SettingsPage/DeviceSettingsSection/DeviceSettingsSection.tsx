/* eslint-disable react/no-multi-comp */
import { PropsWithChildren, useState } from 'react';
import { DeepPartial } from 'ts-essentials';
import { Box, Button, Collapse, Switch, Typography } from '@mui/material';
import { useDeviceStatus } from '@api/deviceStatus.ts';
import { Version } from '@api/deviceStatusSchema.ts';
import { Settings } from '@api/settingsSchema.ts';
import { useAppStore } from '@state/appStore.tsx';
import Section from '../Section.tsx';
import SettingRow from '../SettingRow.tsx';
import SettingToggle from '../SettingToggle.tsx';
import ButtonStepSetting from '../TapGesturesSection/ButtonStepSetting.tsx';
import ApiGuide from './ApiGuide.tsx';
import LedSwitch from './LedSwitch.tsx';
import ManualOnSettings from './ManualOnSettings.tsx';
import TemperatureFormatSelector from './TemperatureFormatSelector.tsx';
import TimeZoneSelector from './TimeZoneSelector.tsx';
import { useSettings } from '@api/settings.ts';

const AWAY_MODE_INFO = 'For when nobody is home. The schedule and alarms stop on both sides until you switch this off.';
const FLIP_SIDES_INFO = 'Swaps which side of the bed the app calls left and right, everywhere: controls, schedules, buttons '
  + 'and in-bed detection. Each side keeps its schedule and settings.';

// A few settings that belong together, under a quiet heading, with a line above every group but the first
const Group = ({ title, children }: PropsWithChildren<{ title: string }>) => (
  <Box
    sx={ {
      display: 'flex', flexDirection: 'column', gap: 1.75, py: 2.25,
      borderTop: '1px solid', borderColor: 'divider', '&:first-of-type': { borderTop: 0, pt: 0 }, '&:last-of-type': { pb: 0 },
    } }
  >
    <Typography variant="caption" sx={ { color: 'text.secondary', fontWeight: 500 } }>{ title }</Typography>
    { children }
  </Box>
);

type UpdateSettingsFn = (settings: DeepPartial<Settings>) => void;
type DeviceSettingsSectionProps = { updateSettings: UpdateSettingsFn };

// Settings for the bed as a whole, in groups: temperature, the clock, turning on by hand, the bed
// itself, and the API
export default function DeviceSettingsSection({ updateSettings }: DeviceSettingsSectionProps) {
  const { data: settings } = useSettings();
  const { data: deviceStatus } = useDeviceStatus();
  const { isUpdating } = useAppStore();
  const [isApiOpen, setIsApiOpen] = useState(false);
  const hasButtons = deviceStatus?.coverVersion === Version.Pod5;

  return (
    <Section title="Device settings">
      <Group title="Temperature">
        <TemperatureFormatSelector settings={ settings } updateSettings={ updateSettings }/>
        { hasButtons && settings && <ButtonStepSetting settings={ settings } updateSettings={ updateSettings }/> }
      </Group>
      <Group title="Clock">
        <TimeZoneSelector settings={ settings } updateSettings={ updateSettings }/>
      </Group>
      <Group title="Turning on by hand">
        <ManualOnSettings settings={ settings } updateSettings={ updateSettings }/>
      </Group>
      <Group title="Bed">
        <SettingToggle
          label="Away mode"
          info={ AWAY_MODE_INFO }
          control={
            <Switch
              disabled={ isUpdating }
              // Away is for the whole bed. One side set away through the API also shows as on,
              // so a single press here clears it.
              checked={ Boolean(settings?.left.awayMode || settings?.right.awayMode) }
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
        <LedSwitch/>
      </Group>
      <Group title="API">
        <SettingRow label="Requests" info="Shortcuts, Home Assistant, scripts and AI assistants can control the bed with these.">
          <Button size="small" onClick={ () => setIsApiOpen(!isApiOpen) } aria-expanded={ isApiOpen }>
            { isApiOpen ? 'Hide' : 'Show' }
          </Button>
        </SettingRow>
        <Collapse in={ isApiOpen } unmountOnExit><ApiGuide/></Collapse>
      </Group>
    </Section>
  );
}
