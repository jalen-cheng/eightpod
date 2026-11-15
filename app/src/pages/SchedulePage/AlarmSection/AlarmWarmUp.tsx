import { Box, FormControl, FormControlLabel, InputLabel, MenuItem, Select, Switch } from '@mui/material';
import _ from 'lodash';
import { useAppStore } from '@state/appStore.tsx';
import { formatTemperature, getTemperatureOptions } from '@lib/temperatureConversions.ts';
import { useTemperatureFormat } from '@lib/useTemperatureFormat.ts';
import { useScheduleStore } from '../scheduleStore.tsx';

// 0 means no warm-up
const WARM_UP_MINUTES = [0, 15, 30, 45];

// Alarm options beyond the vibration itself: warming the side up before the alarm, to a
// temperature of its own that overrides the schedule, and switching the side off on dismissal.
export default function AlarmWarmUp() {
  const { isUpdating } = useAppStore();
  const { selectedSchedule, updateSelectedSchedule } = useScheduleStore();
  const temperatureFormat = useTemperatureFormat();
  if (!selectedSchedule) return null;

  const { alarm } = selectedSchedule;
  const preWarmMinutes = alarm.preWarmMinutes ?? 0;
  // A temperature saved in another unit may sit between the options, so it is added
  const temperatureOptions = _.sortBy(_.union(getTemperatureOptions(temperatureFormat), [alarm.alarmTemperature]));

  return (
    <Box sx={ { display: 'flex', flexDirection: 'column', gap: 2, px: 2, mb: 2 } }>
      <Box sx={ { display: 'flex', gap: 1 } }>
        <FormControl fullWidth>
          <InputLabel>Warm up before alarm</InputLabel>
          <Select
            variant="standard"
            disabled={ isUpdating }
            value={ preWarmMinutes }
            onChange={ (event) => updateSelectedSchedule({ alarm: { preWarmMinutes: Number(event.target.value) } }) }
          >
            { WARM_UP_MINUTES.map(minutes => (
              <MenuItem key={ minutes } value={ minutes }>{ minutes === 0 ? 'Off' : `${minutes} minutes` }</MenuItem>
            )) }
          </Select>
        </FormControl>
        <FormControl fullWidth>
          <InputLabel>Warm up to</InputLabel>
          <Select
            variant="standard"
            disabled={ isUpdating || preWarmMinutes === 0 }
            value={ alarm.alarmTemperature }
            onChange={ (event) => updateSelectedSchedule({ alarm: { alarmTemperature: Number(event.target.value) } }) }
          >
            { temperatureOptions.map(temperatureF => (
              <MenuItem key={ temperatureF } value={ temperatureF }>
                { formatTemperature(temperatureF, temperatureFormat) }
              </MenuItem>
            )) }
          </Select>
        </FormControl>
      </Box>
      <FormControlLabel
        label="Turn this side off when the alarm is dismissed"
        control={
          <Switch
            disabled={ isUpdating }
            checked={ alarm.turnOffAfterDismiss ?? false }
            onChange={ (event) => updateSelectedSchedule({ alarm: { turnOffAfterDismiss: event.target.checked } }) }
          />
        }
      />
    </Box>
  );
}
