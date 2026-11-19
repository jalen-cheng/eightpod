import { DeepPartial } from 'ts-essentials';
import ArrowOutwardIcon from '@mui/icons-material/ArrowOutward';
import { Box, Button, MenuItem, Switch, TextField, Typography } from '@mui/material';
import _ from 'lodash';
import { Settings } from '@api/settingsSchema.ts';
import { AutopilotSnapshot, MIN_NIGHTS_TO_CALIBRATE, useAutopilot } from '@api/autopilot.ts';
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
// The choice that leaves the base to the bed as it is set, in a menu whose other values are temperatures
const AS_SET = 'asSet';

const AUTOPILOT_INFO = 'While you sleep, the temperature is the autopilot\'s: it moves the bed a few degrees around a base '
  + 'temperature, cooler early in the night and back up toward morning, one degree at a time, and the schedule\'s '
  + 'temperature changes wait until the night is over. Bed on, bed off, the warm-up and the alarm still follow the '
  + 'schedule. Set the temperature yourself at any time and it holds what you set and learns from it. It treats the bed '
  + 'as one sleeper\'s, so switching it on links the two sides. Experimental. Saved nights are under Data.';
const BASE_INFO = 'The temperature its changes are counted from. "Bed\'s setting" uses whatever the bed is set to when '
  + 'you fall asleep, whether that night\'s schedule or you set it. Pick a temperature and every night is counted from '
  + 'that instead.';
const CALIBRATE_INFO = 'The bed judges sleep by how still you lie. A watch or band knows better, so the bed compares its '
  + 'own nights with the tracker\'s and adjusts how it judges. An iPhone Shortcut sends each night from Apple Health '
  + '(Apple Watch, Whoop and Fitbit all write there).';

// Where calibration stands, in a line: how many nights have a record, and what came of them
const describeCalibration = (tracker: AutopilotSnapshot['left']['tracker']): string => {
  const nights = tracker?.nights ?? 0;
  if (tracker?.isTuned) return `Fitted to ${tracker.source} over ${nights} nights.`;
  if (nights >= MIN_NIGHTS_TO_CALIBRATE) return `Checked against ${nights} nights: the standard settings already fit.`;
  return `${nights} of ${MIN_NIGHTS_TO_CALIBRATE} nights received.`;
};

// The autopilot: its switch, the temperature it works from, and calibrating how it judges sleep
// against a worn tracker. Only on Pods with the sensors for it.
export default function AutopilotSection({ settings, updateSettings }: AutopilotSectionProps) {
  const { isUpdating } = useAppStore();
  const { data: autopilot } = useAutopilot(REFRESH_MS);
  const temperatureFormat = useTemperatureFormat();
  if (!settings || !autopilot?.available) return null;

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
              checked={ settings.autopilot.enabled }
              onChange={ (event) => updateSettings({ autopilot: { enabled: event.target.checked } }) }
            />
          }
        />
        <SettingRow label="Base temperature" info={ BASE_INFO }>
          <TextField
            select
            size="small"
            disabled={ isUpdating }
            value={ baseTemperatureF ?? AS_SET }
            onChange={ (event) => updateSettings({
              autopilot: { baseTemperatureF: event.target.value === AS_SET ? null : Number(event.target.value) },
            }) }
            sx={ { width: CONTROL_WIDTH_PX } }
            slotProps={ { htmlInput: { 'aria-label': 'Autopilot base temperature' } } }
          >
            <MenuItem value={ AS_SET }>Bed&apos;s setting</MenuItem>
            { baseOptions.map(temperatureF => (
              <MenuItem key={ temperatureF } value={ temperatureF }>{ formatTemperature(temperatureF, temperatureFormat) }</MenuItem>
            )) }
          </TextField>
        </SettingRow>
        <Box>
          <SettingRow label="Calibrate with sleep tracker" info={ CALIBRATE_INFO }>
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
              Set up
            </Button>
          </SettingRow>
          <Typography variant="caption" sx={ { display: 'block', mt: 0.5, color: 'text.secondary', lineHeight: 1.6 } }>
            Add the Shortcut and tap it every week or so: one run sends the last two weeks. With or without a tracker, you can set your own times
            for a night under Data &gt; Sleep.
            At least { MIN_NIGHTS_TO_CALIBRATE } nights are recommended for the best fit. { describeCalibration(autopilot.left.tracker) }
          </Typography>
        </Box>
      </Box>
    </Section>
  );
}
