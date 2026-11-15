/* eslint-disable react/no-multi-comp */
import { MenuItem, TextField } from '@mui/material';
import _ from 'lodash';
import { Time } from '@api/schedulesSchema.ts';
import { formatTemperature, getTemperatureOptions } from '@lib/temperatureConversions.ts';
import { useTemperatureFormat } from '@lib/useTemperatureFormat.ts';

type TimeFieldProps = {
  label: string;
  value: Time;
  onChange: (time: Time) => void;
  disabled?: boolean;
  error?: boolean;
};

// A time of day. Uses the browser's own time picker and nothing else, so there is one clock icon.
export function TimeField({ label, value, onChange, disabled, error }: TimeFieldProps) {
  return (
    <TextField
      type="time"
      size="small"
      value={ value }
      onChange={ (event) => { if (event.target.value) onChange(event.target.value); } }
      disabled={ disabled }
      error={ error }
      sx={ { width: 148, flexShrink: 0 } }
      slotProps={ { htmlInput: { 'aria-label': label } } }
    />
  );
}

type TemperatureSelectProps = {
  label: string;
  // Always °F; shown in the unit chosen in Settings
  value: number;
  onChange: (temperatureF: number) => void;
  disabled?: boolean;
};

// A temperature, picked from the values the chosen display unit can show
export function TemperatureSelect({ label, value, onChange, disabled }: TemperatureSelectProps) {
  const temperatureFormat = useTemperatureFormat();
  // A temperature saved in another unit may sit between the options, so it is added
  const temperatureOptions = _.sortBy(_.union(getTemperatureOptions(temperatureFormat), [value]));

  return (
    <TextField
      select
      size="small"
      value={ value }
      onChange={ (event) => onChange(Number(event.target.value)) }
      disabled={ disabled }
      sx={ { width: 104, flexShrink: 0 } }
      slotProps={ { htmlInput: { 'aria-label': label } } }
    >
      { temperatureOptions.map(temperatureF => (
        <MenuItem key={ temperatureF } value={ temperatureF }>{ formatTemperature(temperatureF, temperatureFormat) }</MenuItem>
      )) }
    </TextField>
  );
}
