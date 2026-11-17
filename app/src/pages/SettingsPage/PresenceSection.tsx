/* eslint-disable react/no-multi-comp */
import { DeepPartial } from 'ts-essentials';
import { PropsWithChildren } from 'react';
import { Box, Chip, Divider, MenuItem, Switch, TextField, Typography } from '@mui/material';
import SensorsOutlinedIcon from '@mui/icons-material/SensorsOutlined';
import _ from 'lodash';
import { Settings } from '@api/settingsSchema.ts';
import { usePresenceSensors } from '@api/presence.ts';
import { useAppStore } from '@state/appStore.tsx';
import InfoTip from '@components/InfoTip.tsx';
import Section from './Section.tsx';
import SettingToggle from './SettingToggle.tsx';
import { TemperatureSelect } from '../SchedulePage/ScheduleFields.tsx';

type PresenceSectionProps = {
  settings?: Settings;
  updateSettings: (settings: DeepPartial<Settings>) => void;
};

const REFRESH_MS = 5_000;
const WAKE_HOUR_CHOICES = _.range(4, 13);
const TURN_ON_HOUR_CHOICES = [3, 6, 8, 10, 12];
const SENSITIVITY_NAMES: Record<Settings['presence']['sensitivity'], string> = { low: 'Low', medium: 'Medium', high: 'High' };

const SENSITIVITY_INFO = 'How easily the sensors count someone as in bed. Raise it if you are not detected; lower it if an '
  + 'empty bed shows as occupied.';
const WAKE_INFO = 'Vibrates like that day\'s alarm once someone has been in bed this long in one stay. Getting up for less '
  + 'than 15 minutes does not restart the count.';
const TURN_ON_INFO = 'When someone gets into a bed that is off, it turns on at this temperature. It turns off again after '
  + 'the hours chosen, or 15 minutes after they get out.';
const UNTIL_OUT_OF_BED = 'untilOutOfBed';

// The picked "stay on" choice as it is saved: a number of hours, or until out of bed
const readStayOn = (value: unknown): Settings['presence']['turnOnWhenInBed']['stayOn'] => (
  value === UNTIL_OUT_OF_BED ? UNTIL_OUT_OF_BED : Number(value)
);

// A setting's own controls, shown under its switch while it is on
const SettingDetail = ({ children }: PropsWithChildren) => (
  <Box sx={ { display: 'flex', alignItems: 'center', justifyContent: 'flex-end', flexWrap: 'wrap', gap: 1, mt: 1 } }>{ children }</Box>
);

type HoursSelectProps = {
  label: string;
  value: number;
  choices: number[];
  onChange: (hours: number) => void;
  disabled: boolean;
};

// A number of hours, picked from a short list (plus the saved value if it is not on it)
const HoursSelect = ({ label, value, choices, onChange, disabled }: HoursSelectProps) => (
  <TextField
    select
    size="small"
    value={ value }
    onChange={ (event) => onChange(Number(event.target.value)) }
    disabled={ disabled }
    sx={ { width: 96, flexShrink: 0 } }
    slotProps={ { htmlInput: { 'aria-label': label } } }
  >
    { _.sortBy(_.union(choices, [value])).map(hours => <MenuItem key={ hours } value={ hours }>{ hours } h</MenuItem>) }
  </TextField>
);

// What being in bed sets off, using the bed's own presence sensors. Hidden on Pods that do not
// report them. Shows what the sensors say now, so the settings can be checked against reality.
export default function PresenceSection({ settings, updateSettings }: PresenceSectionProps) {
  const { isUpdating } = useAppStore();
  const { data: sensors } = usePresenceSensors(REFRESH_MS);
  if (!settings || !sensors?.available) return null;

  const { sensitivity, wakeAfterHours, turnOnWhenInBed } = settings.presence;
  const updatePresence = (changes: DeepPartial<Settings['presence']>) => updateSettings({ presence: changes });

  return (
    <Section title="In-bed detection" icon={ <SensorsOutlinedIcon/> }>
      <Box sx={ { display: 'flex', flexDirection: 'column', gap: 2 } }>
        <Box sx={ { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, flexWrap: 'wrap' } }>
          <Typography variant="body2" sx={ { color: 'text.secondary' } }>Right now</Typography>
          <Box sx={ { display: 'flex', gap: 0.75 } }>
            { (['left', 'right'] as const).map(side => (
              <Chip
                key={ side }
                size="small"
                color={ sensors[side]?.present ? 'success' : 'default' }
                label={ [settings[side].name, sensors[side]?.present ? 'in bed' : 'empty'].join(': ') }
              />
            )) }
          </Box>
        </Box>

        <Box sx={ { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 } }>
          <Typography sx={ { fontSize: 13, fontWeight: 500 } }>Sensitivity <InfoTip text={ SENSITIVITY_INFO }/></Typography>
          <TextField
            select
            size="small"
            value={ sensitivity }
            onChange={ (event) => updatePresence({ sensitivity: event.target.value as Settings['presence']['sensitivity'] }) }
            disabled={ isUpdating }
            sx={ { width: 120, flexShrink: 0 } }
            slotProps={ { htmlInput: { 'aria-label': 'In-bed detection sensitivity' } } }
          >
            { Object.entries(SENSITIVITY_NAMES).map(([value, name]) => <MenuItem key={ value } value={ value }>{ name }</MenuItem>) }
          </TextField>
        </Box>

        <Divider/>

        <SettingToggle
          label="Turn on when I get into bed"
          info={ TURN_ON_INFO }
          control={
            <Switch
              disabled={ isUpdating }
              checked={ turnOnWhenInBed.enabled }
              onChange={ (event) => updatePresence({ turnOnWhenInBed: { enabled: event.target.checked } }) }
            />
          }
        >
          { turnOnWhenInBed.enabled && (
            <SettingDetail>
              <Typography variant="body2">at</Typography>
              <TemperatureSelect
                label="Temperature the bed turns on at"
                value={ turnOnWhenInBed.temperatureF }
                onChange={ (temperatureF) => updatePresence({ turnOnWhenInBed: { temperatureF } }) }
                disabled={ isUpdating }
              />
              <TextField
                select
                size="small"
                value={ turnOnWhenInBed.stayOn }
                onChange={ (event) => updatePresence({ turnOnWhenInBed: { stayOn: readStayOn(event.target.value) } }) }
                disabled={ isUpdating }
                sx={ { minWidth: 96, flexShrink: 1 } }
                slotProps={ { htmlInput: { 'aria-label': 'How long the bed stays on' } } }
              >
                <MenuItem value={ UNTIL_OUT_OF_BED }>until I get out of bed</MenuItem>
                { TURN_ON_HOUR_CHOICES.map(hours => <MenuItem key={ hours } value={ hours }>for { hours } h</MenuItem>) }
              </TextField>
            </SettingDetail>
          ) }
        </SettingToggle>

        <SettingToggle
          label="Alarm after a long time in bed"
          info={ WAKE_INFO }
          control={
            <Switch
              disabled={ isUpdating }
              checked={ wakeAfterHours.enabled }
              onChange={ (event) => updatePresence({ wakeAfterHours: { enabled: event.target.checked } }) }
            />
          }
        >
          { wakeAfterHours.enabled && (
            <SettingDetail>
              <Typography variant="body2">after</Typography>
              <HoursSelect
                label="Hours in bed before the alarm"
                value={ wakeAfterHours.hours }
                choices={ WAKE_HOUR_CHOICES }
                onChange={ (hours) => updatePresence({ wakeAfterHours: { hours } }) }
                disabled={ isUpdating }
              />
            </SettingDetail>
          ) }
        </SettingToggle>
      </Box>
    </Section>
  );
}
