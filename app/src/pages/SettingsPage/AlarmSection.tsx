import {
  Box, Button, MenuItem, TextField, ToggleButton, ToggleButtonGroup, Typography,
} from '@mui/material';
import _ from 'lodash';
import { useEffect, useState } from 'react';
import { DeepPartial } from 'ts-essentials';
import { postAlarm } from '@api/alarm.ts';
import { postDeviceStatus } from '@api/deviceStatus.ts';
import { postSchedules, useSchedules } from '@api/schedules.ts';
import { AlarmSchedule, Schedules } from '@api/schedulesSchema.ts';
import InfoTip from '@components/InfoTip.tsx';
import { buildSidesPayload } from '@lib/sides.ts';
import { Side, useAppStore } from '@state/appStore.tsx';
import { LOWERCASE_DAYS } from '../SchedulePage/days.ts';
import Section from './Section.tsx';

const SIDES: Side[] = ['left', 'right'];
const SECONDS_PER_MINUTE = 60;
// An alarm keeps going until it is dismissed, up to this long
const ALARM_LENGTH_MINUTES = [10, 15, 20, 30];
// A test runs the ramp-up and a little of full strength, then stops by itself
const TEST_SECONDS = 60;

// Three strengths are enough to choose between; the firmware takes a percentage
const STRENGTH_LEVELS = [{ name: 'Low', percent: 40 }, { name: 'Medium', percent: 70 }, { name: 'High', percent: 100 }];

const PATTERN_NAMES: Record<AlarmSchedule['vibrationPattern'], string> = { rise: 'Ramp up', double: 'Pulses' };
type VibrationSettings = Pick<AlarmSchedule, 'vibrationPattern' | 'vibrationIntensity' | 'duration'>;

// How every alarm vibrates: its pattern, strength and length. One choice for the whole bed. It is
// stored on each night's alarm, so a change here is written to every night on both sides.
export default function AlarmSection() {
  const { data: schedules, refetch } = useSchedules();
  const { isUpdating, setIsUpdating } = useAppStore();
  const [isTesting, setIsTesting] = useState(false);
  // Every night is kept the same, so any one of them can be read
  const savedAlarm = schedules?.left.monday.alarm;
  // The test ends by itself; the button goes back to "Test" when it has
  useEffect(() => {
    if (!isTesting) return undefined;
    const testEndTimer = setTimeout(() => setIsTesting(false), TEST_SECONDS * 1_000);
    return () => clearTimeout(testEndTimer);
  }, [isTesting]);
  if (!savedAlarm) return null;

  const saveVibration = (changes: Partial<VibrationSettings>) => {
    const everyNight = Object.fromEntries(LOWERCASE_DAYS.map(day => [day, { alarm: changes }]));
    const payload: DeepPartial<Schedules> = buildSidesPayload(SIDES, everyNight);
    setIsUpdating(true);
    postSchedules(payload)
      .then(() => refetch())
      .catch(error => console.error(error))
      .finally(() => setIsUpdating(false));
  };

  // Vibrates both sides now, whether or not they are on, so the settings can be felt
  const startTest = () => {
    setIsTesting(true);
    const { vibrationIntensity, vibrationPattern } = savedAlarm;
    const test = { vibrationIntensity, vibrationPattern, duration: TEST_SECONDS, force: true };
    Promise.all(SIDES.map(side => postAlarm({ side, ...test }))).catch((error) => {
      console.error(error);
      setIsTesting(false);
    });
  };
  const stopTest = () => {
    setIsTesting(false);
    postDeviceStatus(buildSidesPayload(SIDES, { isAlarmVibrating: false })).catch(error => console.error(error));
  };

  // A strength saved as some other percentage shows as the level nearest to it
  const strengthLevel = _.minBy(STRENGTH_LEVELS, level => Math.abs(level.percent - savedAlarm.vibrationIntensity))?.percent;
  const lengthMinutes = Math.round(savedAlarm.duration / SECONDS_PER_MINUTE);
  // An alarm saved with some other length keeps it until a new one is picked
  const lengthOptions = _.sortBy(_.union(ALARM_LENGTH_MINUTES, [lengthMinutes]));

  return (
    <Section
      title="Alarm"
      action={ <Button size="small" onClick={ isTesting ? stopTest : startTest }>{ isTesting ? 'Stop test' : 'Test for a minute' }</Button> }
    >
      <Box sx={ { display: 'flex', flexDirection: 'column', gap: 2 } }>
        <Box sx={ { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 } }>
          <Typography variant="body2" sx={ { fontWeight: 500 } }>
            Vibration <InfoTip text="Ramp up builds to full strength over 40 seconds. Pulses start at full strength."/>
          </Typography>
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
            <ToggleButton value="rise" sx={ { whiteSpace: 'nowrap', px: 2 } }>{ PATTERN_NAMES.rise }</ToggleButton>
            <ToggleButton value="double" sx={ { whiteSpace: 'nowrap', px: 2 } }>{ PATTERN_NAMES.double }</ToggleButton>
          </ToggleButtonGroup>
        </Box>

        <Box sx={ { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 } }>
          <Typography variant="body2" sx={ { fontWeight: 500 } }>
            Length <InfoTip text="How long it keeps going. It stops sooner if you dismiss it."/>
          </Typography>
          <TextField
            select
            size="small"
            disabled={ isUpdating }
            value={ lengthMinutes }
            onChange={ (event) => saveVibration({ duration: Number(event.target.value) * SECONDS_PER_MINUTE }) }
            sx={ { width: 132 } }
            slotProps={ { htmlInput: { 'aria-label': 'Alarm length' } } }
          >
            { lengthOptions.map(minutes => (
              <MenuItem key={ minutes } value={ minutes }>{ minutes < 1 ? 'Under 1 min' : `${minutes} min` }</MenuItem>
            )) }
          </TextField>
        </Box>
        <Box sx={ { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 } }>
          <Typography variant="body2" sx={ { fontWeight: 500 } }>Strength</Typography>
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
              <ToggleButton key={ percent } value={ percent } sx={ { whiteSpace: 'nowrap', px: 2 } }>{ name }</ToggleButton>
            )) }
          </ToggleButtonGroup>
        </Box>
        <Typography variant="caption" sx={ { color: 'text.secondary' } }>
          For every night and both sides. Each night&apos;s wake time, warm-up and whether it vibrates are set in Schedules.
        </Typography>
      </Box>
    </Section>
  );
}
