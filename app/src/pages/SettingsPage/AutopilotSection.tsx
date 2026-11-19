import { DeepPartial } from 'ts-essentials';
import ArrowOutwardIcon from '@mui/icons-material/ArrowOutward';
import { Box, Button, MenuItem, Switch, TextField, Typography } from '@mui/material';
import _ from 'lodash';
import { Settings } from '@api/settingsSchema.ts';
import { AutopilotSnapshot, useAutopilot } from '@api/autopilot.ts';
import { APPLE_HEALTH_GUIDE_URL } from '@lib/docsLinks.ts';
import { formatTemperature, getTemperatureOptions } from '@lib/temperatureConversions.ts';
import { useTemperatureFormat } from '@lib/useTemperatureFormat.ts';
import { useAppStore } from '@state/appStore.tsx';
import Section from './Section.tsx';
import SettingRow, { CONTROL_WIDTH_PX } from './SettingRow.tsx';
import SettingToggle from './SettingToggle.tsx';

type AutopilotSectionProps = {
  settings?: Settings;
  updateSettings: (settings: DeepPartial<Settings>) => void;
};

const REFRESH_MS = 30_000;
const SIDES = ['left', 'right'] as const;
// The choice that leaves the base to the schedule, in a menu whose other values are temperatures
const FROM_SCHEDULE = 'schedule';

const AUTOPILOT_INFO = 'While you sleep, moves the bed a few degrees around its base temperature: cooler early in the '
  + 'night and back up toward morning, one degree at a time. Set the temperature yourself at any time and it holds what '
  + 'you set and learns from it. It treats the bed as one sleeper\'s, so switching it on links the two sides. '
  + 'Experimental. Saved nights are under Data.';
const BASE_INFO = 'The temperature its changes are counted from. "The schedule\'s" follows your schedule, or what you set '
  + 'before falling asleep. A temperature of its own is kept all night: the schedule\'s temperature changes wait until '
  + 'the night is over, and bed on, bed off and the alarm still run.';
const TRACKER_INFO = 'An iPhone Shortcut sends last night\'s sleep from Apple Health each morning (Apple Watch, Whoop and '
  + 'Fitbit all write there), and the bed tunes how it judges sleep to match.';

// What the bed makes of whoever is in it right now, in a line. Nothing when it is empty.
const describeSleeper = (autopilot: AutopilotSnapshot, isEnabled: boolean): string | undefined => {
  const sleeper = SIDES.map(side => autopilot[side]).find(side => side.stage !== 'out');
  if (!sleeper) return undefined;
  const isNap = sleeper.sleepKind === 'nap';
  const isSteered = isEnabled && !isNap;
  return [
    sleeper.stage === 'asleep' ? (isNap && isEnabled ? 'Napping, not adjusted' : 'Asleep') : 'Awake',
    isSteered && sleeper.lastChange,
  ].filter(Boolean).join(' · ');
};

// The autopilot: its switch, the temperature it works from, and the link to Apple Health. Only
// on Pods with the sensors for it. Who is in bed is shown by the In-bed detection section.
export default function AutopilotSection({ settings, updateSettings }: AutopilotSectionProps) {
  const { isUpdating } = useAppStore();
  const { data: autopilot } = useAutopilot(REFRESH_MS);
  const temperatureFormat = useTemperatureFormat();
  if (!settings || !autopilot?.available) return null;

  const isEnabled = settings.autopilot.enabled;
  const sleeper = describeSleeper(autopilot, isEnabled);
  const baseTemperatureF = settings.autopilot.baseTemperatureF ?? undefined;
  // A base saved in another unit may sit between the options, so it is added
  const baseOptions = _.sortBy(_.union(getTemperatureOptions(temperatureFormat), baseTemperatureF === undefined ? [] : [baseTemperatureF]));

  return (
    <Section title="Autopilot">
      <Box sx={ { display: 'flex', flexDirection: 'column', gap: 1.5 } }>
        <SettingToggle
          label="Adjust the temperature while I sleep"
          info={ AUTOPILOT_INFO }
          control={
            <Switch
              disabled={ isUpdating }
              checked={ isEnabled }
              onChange={ (event) => updateSettings({ autopilot: { enabled: event.target.checked } }) }
            />
          }
        />
        { sleeper && <Typography variant="body2" sx={ { color: 'text.secondary' } }>{ sleeper }</Typography> }
        <SettingRow label="Base temperature" info={ BASE_INFO }>
          <TextField
            select
            size="small"
            disabled={ isUpdating }
            value={ baseTemperatureF ?? FROM_SCHEDULE }
            onChange={ (event) => updateSettings({
              autopilot: { baseTemperatureF: event.target.value === FROM_SCHEDULE ? null : Number(event.target.value) },
            }) }
            sx={ { width: CONTROL_WIDTH_PX } }
            slotProps={ { htmlInput: { 'aria-label': 'Autopilot base temperature' } } }
          >
            <MenuItem value={ FROM_SCHEDULE }>The schedule&apos;s</MenuItem>
            { baseOptions.map(temperatureF => (
              <MenuItem key={ temperatureF } value={ temperatureF }>{ formatTemperature(temperatureF, temperatureFormat) }</MenuItem>
            )) }
          </TextField>
        </SettingRow>
        <SettingRow label="Sleep tracker" info={ TRACKER_INFO }>
          <Button
            size="small"
            variant="outlined"
            component="a"
            href={ APPLE_HEALTH_GUIDE_URL }
            target="_blank"
            rel="noopener noreferrer"
            endIcon={ <ArrowOutwardIcon/> }
            sx={ { whiteSpace: 'nowrap' } }
          >
            Link Apple Health
          </Button>
        </SettingRow>
      </Box>
    </Section>
  );
}
