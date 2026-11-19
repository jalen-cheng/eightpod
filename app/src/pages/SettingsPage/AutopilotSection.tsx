import { DeepPartial } from 'ts-essentials';
import { Box, Button, Switch, Typography } from '@mui/material';
import { Settings } from '@api/settingsSchema.ts';
import { AutopilotSnapshot, useAutopilot } from '@api/autopilot.ts';
import { useAppStore } from '@state/appStore.tsx';
import Section from './Section.tsx';
import SettingRow from './SettingRow.tsx';
import SettingToggle from './SettingToggle.tsx';
import { TRACKER_LINK_GUIDE_URL } from '@lib/docsLinks.ts';

type AutopilotSectionProps = {
  settings?: Settings;
  updateSettings: (settings: DeepPartial<Settings>) => void;
};

const REFRESH_MS = 30_000;
const SIDES = ['left', 'right'] as const;

const AUTOPILOT_INFO = 'While you sleep, moves the bed a few degrees around the temperature you set: cooler early in the '
  + 'night, back up toward morning, and against a room that warms or cools. Set the temperature yourself at any time and it '
  + 'holds what you set and learns from it. It treats the bed as one sleeper\'s, so switching it on links the two sides. '
  + 'Experimental. Saved nights are under Data.';
const TRACKER_INFO = 'Send the sleep and wake times from a watch or band each morning, and the bed tunes how it judges '
  + 'sleep to match them. Link opens the steps for the iPhone Shortcut that sends them.';

// What the autopilot makes of whoever is in bed right now, in a line. Nothing when it is empty.
const describeNow = (autopilot: AutopilotSnapshot): string | undefined => {
  const sleeper = SIDES.map(side => autopilot[side]).find(side => side.stage !== 'out');
  if (!sleeper) return undefined;
  const isNap = sleeper.sleepKind === 'nap';
  return [
    sleeper.stage === 'asleep' ? (isNap ? 'Napping, not adjusted' : 'Asleep') : 'Awake',
    sleeper.breathingRate !== undefined && `${sleeper.breathingRate} breaths/min`,
    !isNap && sleeper.lastChange,
  ].filter(Boolean).join(' · ');
};

// Switches the autopilot on, shows what it is doing, and points to the guide for linking a sleep tracker. Hidden on Pods
// without the sensors it needs. Who is in bed is shown by the In-bed detection section.
export default function AutopilotSection({ settings, updateSettings }: AutopilotSectionProps) {
  const { isUpdating } = useAppStore();
  const { data: autopilot } = useAutopilot(REFRESH_MS);
  if (!settings || !autopilot?.available) return null;
  const isEnabled = settings.autopilot.enabled;
  const now = isEnabled ? describeNow(autopilot) : undefined;

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
        { now && <Typography variant="body2" sx={ { color: 'text.secondary' } }>{ now }</Typography> }
        <SettingRow label="Sleep tracker" info={ TRACKER_INFO }>
          <Typography variant="body2" sx={ { color: 'text.secondary' } }>{ autopilot.left.tracker?.source ?? 'Not linked' }</Typography>
          <Button size="small" variant="outlined" component="a" href={ TRACKER_LINK_GUIDE_URL } target="_blank" rel="noopener noreferrer">
            Link
          </Button>
        </SettingRow>
      </Box>
    </Section>
  );
}
