import {
  Box, MenuItem, TextField, ToggleButton, ToggleButtonGroup, Typography,
} from '@mui/material';
import _ from 'lodash';
import { useState } from 'react';
import { DeepPartial } from 'ts-essentials';
import { postSchedules, useSchedules } from '@api/schedules.ts';
import { AlarmSchedule, Schedules } from '@api/schedulesSchema.ts';
import { buildSidesPayload } from '@lib/sides.ts';
import { Side, useAppStore } from '@state/appStore.tsx';
import { LOWERCASE_DAYS } from '../SchedulePage/days.ts';
import Section from './Section.tsx';
import SettingRow, { CONTROL_WIDTH_PX } from './SettingRow.tsx';

const SIDES: Side[] = ['left', 'right'];
// The choices sit closer together on a phone, so three of them fit beside the setting's name
const choiceSx = { whiteSpace: 'nowrap', px: { xs: 1.5, sm: 2 } };
const SECONDS_PER_MINUTE = 60;
// An alarm keeps going until it is dismissed, up to this long
const ALARM_LENGTH_MINUTES = [10, 15, 20, 30];

// Three strengths are enough to choose between; the firmware takes a percentage
const STRENGTH_LEVELS = [{ name: 'Low', percent: 40 }, { name: 'Medium', percent: 70 }, { name: 'High', percent: 100 }];

const PATTERN_NAMES: Record<AlarmSchedule['vibrationPattern'], string> = { rise: 'Ramp up', double: 'Pulses' };
type VibrationSettings = Pick<AlarmSchedule, 'vibrationPattern' | 'vibrationIntensity' | 'duration'>;

// How every alarm vibrates: its pattern, strength and length. One choice for the whole bed. It is
// stored on each night's alarm, so a change here is written to every night on both sides.
export default function AlarmSection() {
  const { data: schedules, refetch } = useSchedules();
  const { isUpdating, setIsUpdating } = useAppStore();
  const [hasSaveFailed, setHasSaveFailed] = useState(false);
  // Every night is kept the same, so any one of them can be read
  const savedAlarm = schedules?.left.monday.alarm;
  if (!savedAlarm) return null;

  // Writes all three settings to every night on both sides, not just the one that changed, so
  // nights that differed before this was one setting are brought into line
  const saveVibration = (changes: Partial<VibrationSettings>) => {
    const { vibrationPattern, vibrationIntensity, duration } = savedAlarm;
    const vibration: VibrationSettings = { vibrationPattern, vibrationIntensity, duration, ...changes };
    const everyNight = Object.fromEntries(LOWERCASE_DAYS.map(day => [day, { alarm: vibration }]));
    const payload: DeepPartial<Schedules> = buildSidesPayload(SIDES, everyNight);
    setHasSaveFailed(false);
    setIsUpdating(true);
    postSchedules(payload)
      .then(() => refetch())
      .catch((error) => {
        console.error(error);
        setHasSaveFailed(true);
      })
      .finally(() => setIsUpdating(false));
  };

  // A strength saved as some other percentage shows as the level nearest to it
  const strengthLevel = _.minBy(STRENGTH_LEVELS, level => Math.abs(level.percent - savedAlarm.vibrationIntensity))?.percent;
  const lengthMinutes = Math.round(savedAlarm.duration / SECONDS_PER_MINUTE);
  // An alarm saved with some other length keeps it until a new one is picked
  const lengthOptions = _.sortBy(_.union(ALARM_LENGTH_MINUTES, [lengthMinutes]));

  return (
    <Section title="Alarm">
      <Box sx={ { display: 'flex', flexDirection: 'column', gap: 2 } }>
        <SettingRow label="Vibration" info="Ramp up builds to full strength over 40 seconds. Pulses start at full strength.">
          <ToggleButtonGroup
            exclusive
            size="small"
            disabled={ isUpdating }
            value={ savedAlarm.vibrationPattern }
            onChange={ (_event, vibrationPattern: AlarmSchedule['vibrationPattern'] | null) => {
              if (vibrationPattern !== null) saveVibration({ vibrationPattern });
            } }
            aria-label="Vibration"
          >
            <ToggleButton value="rise" sx={ choiceSx }>{ PATTERN_NAMES.rise }</ToggleButton>
            <ToggleButton value="double" sx={ choiceSx }>{ PATTERN_NAMES.double }</ToggleButton>
          </ToggleButtonGroup>
        </SettingRow>

        <SettingRow label="Length" info="How long it keeps going. It stops sooner if you dismiss it.">
          <TextField
            select
            size="small"
            disabled={ isUpdating }
            value={ lengthMinutes }
            onChange={ (event) => saveVibration({ duration: Number(event.target.value) * SECONDS_PER_MINUTE }) }
            sx={ { width: CONTROL_WIDTH_PX } }
            slotProps={ { htmlInput: { 'aria-label': 'Alarm length' } } }
          >
            { lengthOptions.map(minutes => (
              <MenuItem key={ minutes } value={ minutes }>{ minutes < 1 ? 'Under 1 min' : `${minutes} min` }</MenuItem>
            )) }
          </TextField>
        </SettingRow>
        <SettingRow label="Strength">
          <ToggleButtonGroup
            exclusive
            size="small"
            disabled={ isUpdating }
            value={ strengthLevel }
            onChange={ (_event, level: number | null) => {
              if (level !== null) saveVibration({ vibrationIntensity: level });
            } }
            aria-label="Vibration strength"
          >
            { STRENGTH_LEVELS.map(({ name, percent }) => (
              <ToggleButton key={ percent } value={ percent } sx={ choiceSx }>{ name }</ToggleButton>
            )) }
          </ToggleButtonGroup>
        </SettingRow>
        { hasSaveFailed && (
          <Typography variant="caption" color="error">That was not saved. Check the Pod is reachable and try again.</Typography>
        ) }
      </Box>
    </Section>
  );
}
