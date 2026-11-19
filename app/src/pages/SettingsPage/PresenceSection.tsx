/* eslint-disable react/no-multi-comp */
import { DeepPartial } from 'ts-essentials';
import { PropsWithChildren } from 'react';
import { Box, Button, Divider, MenuItem, Switch, TextField, Typography } from '@mui/material';
import StatusTag from '@components/StatusTag.tsx';
import _ from 'lodash';
import { Settings } from '@api/settingsSchema.ts';
import { postBedIsEmpty, usePresenceSensors } from '@api/presence.ts';
import { useAppStore } from '@state/appStore.tsx';
import Section from './Section.tsx';
import SettingToggle from './SettingToggle.tsx';
import SettingRow, { CONTROL_WIDTH_PX } from './SettingRow.tsx';
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
const EMPTY_INFO = 'Press with nobody and nothing extra on the bed if a side shows "in bed" when it is empty, or never does. '
  + 'Detection starts over from the bed as it is now.';
const NOW_INFO = 'What the sensors under the cover say at this moment, for each side.';
const UNTIL_OUT_OF_BED = 'untilOutOfBed';

// The picked "stay on" choice as it is saved: a number of hours, or until out of bed
const readStayOn = (value: unknown): Settings['presence']['turnOnWhenInBed']['stayOn'] => (
  value === UNTIL_OUT_OF_BED ? UNTIL_OUT_OF_BED : Number(value)
);

// A setting's own controls, in a line under its label while it is on
const SettingDetail = ({ children }: PropsWithChildren) => (
  <Box sx={ { display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1, mt: 0.75 } }>{ children }</Box>
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
  const { data: sensors, refetch: refetchSensors } = usePresenceSensors(REFRESH_MS);
  if (!settings || !sensors?.available) return null;

  const { sensitivity, wakeAfterHours, turnOnWhenInBed } = settings.presence;
  const updatePresence = (changes: DeepPartial<Settings['presence']>) => updateSettings({ presence: changes });

  return (
    <Section title="In-bed detection">
      <Box sx={ { display: 'flex', flexDirection: 'column', gap: 1.5 } }>
        <SettingRow label="Right now" info={ NOW_INFO }>
          <Box sx={ { display: 'flex', flexWrap: 'wrap', justifyContent: 'flex-end', columnGap: 1.5 } } role="status">
            { (['left', 'right'] as const).map(side => (
              <StatusTag
                key={ side }
                tone={ sensors[side]?.present ? 'good' : 'neutral' }
                label={ `${side === 'left' ? 'Left' : 'Right'} ${sensors[side]?.present ? 'in bed' : 'empty'}` }
              />
            )) }
          </Box>
        </SettingRow>
        <SettingRow label="Sensitivity" info={ SENSITIVITY_INFO }>
          <TextField
            select
            size="small"
            value={ sensitivity }
            onChange={ (event) => updatePresence({ sensitivity: event.target.value as Settings['presence']['sensitivity'] }) }
            disabled={ isUpdating }
            sx={ { width: CONTROL_WIDTH_PX, flexShrink: 0 } }
            slotProps={ { htmlInput: { 'aria-label': 'In-bed detection sensitivity' } } }
          >
            { Object.entries(SENSITIVITY_NAMES).map(([value, name]) => <MenuItem key={ value } value={ value }>{ name }</MenuItem>) }
          </TextField>
        </SettingRow>
        <SettingRow label="Wrong reading?" info={ EMPTY_INFO }>
          <Button
            size="small"
            variant="outlined"
            disabled={ isUpdating }
            onClick={ () => void postBedIsEmpty().then(() => refetchSensors()).catch(error => console.error(error)) }
            sx={ { width: CONTROL_WIDTH_PX, whiteSpace: 'nowrap' } }
          >
            Bed is empty now
          </Button>
        </SettingRow>

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
              <Typography variant="body2" sx={ { color: 'text.secondary' } }>To</Typography>
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
                sx={ { flex: '0 1 auto', minWidth: 96 } }
                slotProps={ { htmlInput: { 'aria-label': 'How long the bed stays on' } } }
              >
                <MenuItem value={ UNTIL_OUT_OF_BED }>until I get out of bed</MenuItem>
                { _.sortBy(_.union(TURN_ON_HOUR_CHOICES, typeof turnOnWhenInBed.stayOn === 'number' ? [turnOnWhenInBed.stayOn] : []))
                  .map(hours => <MenuItem key={ hours } value={ hours }>for { hours } h</MenuItem>) }
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
              <Typography variant="body2" sx={ { color: 'text.secondary' } }>After</Typography>
              <HoursSelect
                label="Hours in bed before the alarm"
                value={ wakeAfterHours.hours }
                choices={ WAKE_HOUR_CHOICES }
                onChange={ (hours) => updatePresence({ wakeAfterHours: { hours } }) }
                disabled={ isUpdating }
              />
              <Typography variant="body2" sx={ { color: 'text.secondary' } }>in one stay</Typography>
            </SettingDetail>
          ) }
        </SettingToggle>
      </Box>
    </Section>
  );
}
