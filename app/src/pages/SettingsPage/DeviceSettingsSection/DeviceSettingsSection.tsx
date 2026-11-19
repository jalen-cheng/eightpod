/* eslint-disable react/no-multi-comp */
import { Typography } from '@mui/material';
import { PropsWithChildren } from 'react';
import { DeepPartial } from 'ts-essentials';
import { Box, Switch } from '@mui/material';
import { useDeviceStatus } from '@api/deviceStatus.ts';
import { Version } from '@api/deviceStatusSchema.ts';
import { Settings } from '@api/settingsSchema.ts';
import { useAppStore } from '@state/appStore.tsx';
import SideControl from '@components/SideControl.tsx';
import Section from '../Section.tsx';
import SettingRow from '../SettingRow.tsx';
import SettingToggle from '../SettingToggle.tsx';
import ButtonStepSetting from '../TapGesturesSection/ButtonStepSetting.tsx';
import TemperatureFormatSelector from './TemperatureFormatSelector.tsx';
import TimeZoneSelector from './TimeZoneSelector.tsx';
import { useSettings } from '@api/settings.ts';

const SIDE_INFO = 'The side the Temperature and Schedules pages show and change. Left or right is remembered on this '
  + 'device only, so each person can keep their own side on their own phone. Both makes the two sides act as one, for '
  + 'everyone; the autopilot needs it.';
const AWAY_MODE_INFO = 'For when nobody is home. The schedule and alarms stop on both sides until you switch this off.';

// A few settings that belong together, with a line above every group but the first
const Group = ({ children }: PropsWithChildren) => (
  <Box
    sx={ {
      display: 'flex', flexDirection: 'column', gap: 1.75, py: 2.25,
      borderTop: '1px solid', borderColor: 'divider', '&:first-of-type': { borderTop: 0, pt: 0 }, '&:last-of-type': { pb: 0 },
    } }
  >
    { children }
  </Box>
);

type UpdateSettingsFn = (settings: DeepPartial<Settings>) => void;
type DeviceSettingsSectionProps = { updateSettings: UpdateSettingsFn };

// The settings that get used, in groups: the side this device controls, temperature, the clock
// and away mode. The set-once ones are in OtherSection.
export default function DeviceSettingsSection({ updateSettings }: DeviceSettingsSectionProps) {
  const { data: settings } = useSettings();
  const { data: deviceStatus } = useDeviceStatus();
  const { isUpdating } = useAppStore();
  const hasButtons = deviceStatus?.coverVersion === Version.Pod5;

  return (
    <Section title="General" startsOpen>
      <Group>
        <SettingRow label="This device controls" info={ SIDE_INFO }><SideControl/></SettingRow>
        { settings?.autopilot.enabled && (
          <Typography variant="caption" sx={ { display: 'block', mt: 0.5, color: 'text.secondary' } }>
            The autopilot is on and needs Both. Picking Left or Right switches it off.
          </Typography>
        ) }
      </Group>
      <Group>
        <TemperatureFormatSelector settings={ settings } updateSettings={ updateSettings }/>
        { hasButtons && settings && <ButtonStepSetting settings={ settings } updateSettings={ updateSettings }/> }
      </Group>
      <Group>
        <TimeZoneSelector settings={ settings } updateSettings={ updateSettings }/>
      </Group>
      <Group>
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
      </Group>
    </Section>
  );
}
