import { MenuItem, TextField } from '@mui/material';
import moment from 'moment-timezone';
import { DeepPartial } from 'ts-essentials';

import { TIME_ZONES } from '@api/timeZones.ts';
import { Settings } from '@api/settingsSchema.ts';
import { useAppStore } from '@state/appStore.tsx';
import SettingRow, { CONTROL_WIDTH_PX } from '../SettingRow.tsx';

type TimeZoneSelectorProps = {
  settings?: Settings;
  updateSettings: (settings: DeepPartial<Settings>) => void;
}

// A zone as people say it: its short name where it has one, and its offset from UTC today.
// "PST (UTC-8)". Some zones only have a number for a short name; that is left out.
const describeZone = (zone: string) => {
  const now = moment.tz(zone);
  const shortName = now.format('z');
  const offset = now.format('Z').replace(/^([+-])0/, '$1').replace(':00', '').replace('-', '\u2212');
  const hasWordName = /^[A-Z]{2,5}$/.test(shortName) && shortName !== 'UTC';
  return [hasWordName ? shortName : '', zone === 'UTC' ? 'UTC' : `(UTC${offset})`].filter(Boolean).join(' ');
};
const nameCity = (zone: string) => (zone === 'UTC' ? '' : (zone.split('/').pop() ?? zone).replace(/_/g, ' '));

// West to east, as a clock list reads
const ZONES_BY_OFFSET = [...TIME_ZONES].sort((first, second) => moment.tz(first).utcOffset() - moment.tz(second).utcOffset());

// The clock the schedule and alarms run on. The box shows the short form; the list adds the city.
export default function TimeZoneSelector({ settings, updateSettings }: TimeZoneSelectorProps) {
  const { isUpdating } = useAppStore();

  return (
    <SettingRow label="Time zone" info="Schedules and alarms run on this clock.">
      <TextField
        select
        size="small"
        error={ settings?.timeZone === null }
        disabled={ isUpdating }
        value={ settings?.timeZone || '' }
        onChange={ (event) => updateSettings({ timeZone: event.target.value as Settings['timeZone'] }) }
        sx={ { width: CONTROL_WIDTH_PX } }
        slotProps={ {
          htmlInput: { 'aria-label': 'Time zone' },
          select: { renderValue: (zone) => (zone ? describeZone(zone as string) : 'Choose') , displayEmpty: true },
        } }
      >
        { ZONES_BY_OFFSET.map(zone => (
          <MenuItem value={ zone } key={ zone }>{ [describeZone(zone), nameCity(zone)].filter(Boolean).join(' ') }</MenuItem>
        )) }
      </TextField>
    </SettingRow>
  );
}
