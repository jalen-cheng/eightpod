/* eslint-disable react/no-multi-comp */
import { MouseEvent } from 'react';
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

// A time of day. Uses the browser's own time picker; a click anywhere on the field opens it, so
// the field needs no clock icon.
export function TimeField({ label, value, onChange, disabled, error }: TimeFieldProps) {
  return (
    <TextField
      type="time"
      size="small"
      value={ value }
      onChange={ (event) => { if (event.target.value) onChange(event.target.value); } }
      disabled={ disabled }
      error={ error }
      sx={ {
        width: 104, flexShrink: 0,
        '& input': { fontWeight: 500, textAlign: 'center', px: 1 },
        '& input::-webkit-calendar-picker-indicator': { display: 'none' },
      } }
      slotProps={ {
        htmlInput: {
          'aria-label': label,
          onClick: (event: MouseEvent<HTMLInputElement>) => {
            // Not every browser has showPicker, and it throws when the field is disabled
            try { event.currentTarget.showPicker?.(); } catch { /* typing still works */ }
          },
        },
      } }
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
      sx={ { width: 92, flexShrink: 0, '& .MuiSelect-select': { fontWeight: 500 } } }
      slotProps={ { htmlInput: { 'aria-label': label } } }
    >
      { temperatureOptions.map(temperatureF => (
        <MenuItem key={ temperatureF } value={ temperatureF }>{ formatTemperature(temperatureF, temperatureFormat) }</MenuItem>
      )) }
    </TextField>
  );
}
