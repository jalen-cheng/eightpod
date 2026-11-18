import { MenuItem, TextField } from '@mui/material';
import moment from 'moment-timezone';
import { DeepPartial } from 'ts-essentials';

import { TIME_ZONES } from '@api/timeZones.ts';
import { Settings } from '@api/settingsSchema.ts';
import { useAppStore } from '@state/appStore.tsx';
import SettingRow from '../SettingRow.tsx';

type TimeZoneSelectorProps = {
  settings?: Settings;
  updateSettings: (settings: DeepPartial<Settings>) => void;
}

// A zone as people say it: its short name where it has one, its offset from UTC today, and its
// city. "PST (UTC-8) Los Angeles". Some zones only have a number for a short name; that is left out.
const describeZone = (zone: string) => {
  const now = moment.tz(zone);
  const shortName = now.format('z');
  const offset = now.format('Z').replace(/^([+-])0/, '$1').replace(':00', '').replace('-', '\u2212');
  const city = zone === 'UTC' ? '' : (zone.split('/').pop() ?? zone).replace(/_/g, ' ');
  const hasWordName = /^[A-Z]{2,5}$/.test(shortName) && shortName !== 'UTC';
  return [hasWordName ? shortName : '', `(UTC${zone === 'UTC' ? '' : offset})`, city].filter(Boolean).join(' ');
};

// West to east, as a clock list reads
const ZONES_BY_OFFSET = [...TIME_ZONES].sort((first, second) => moment.tz(first).utcOffset() - moment.tz(second).utcOffset());

// The clock the schedule and alarms run on
export default function TimeZoneSelector({ settings, updateSettings }: TimeZoneSelectorProps) {
  const { isUpdating } = useAppStore();

  return (
    <SettingRow label="Time zone" detail="Schedules and alarms run on this clock">
      <TextField
        select
        size="small"
        error={ settings?.timeZone === null }
        disabled={ isUpdating }
        value={ settings?.timeZone || '' }
        onChange={ (event) => updateSettings({ timeZone: event.target.value as Settings['timeZone'] }) }
        sx={ { width: { xs: '100%', sm: 250 } } }
        slotProps={ { htmlInput: { 'aria-label': 'Time zone' } } }
      >
        { ZONES_BY_OFFSET.map(zone => <MenuItem value={ zone } key={ zone }>{ describeZone(zone) }</MenuItem>) }
      </TextField>
    </SettingRow>
  );
}
