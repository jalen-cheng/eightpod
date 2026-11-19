import { useState } from 'react';
import { DeepPartial } from 'ts-essentials';
import { Box, Button, Divider, Switch, Typography } from '@mui/material';
import { Settings } from '@api/settingsSchema.ts';
import { AutopilotSnapshot, startRehearsal, stopRehearsal, useAutopilot } from '@api/autopilot.ts';
import { APPLE_HEALTH_GUIDE_URL } from '@lib/docsLinks.ts';
import { useAppStore } from '@state/appStore.tsx';
import BiometricsSetting from './BiometricsSetting.tsx';
import Section from './Section.tsx';
import SettingRow from './SettingRow.tsx';
import SettingToggle from './SettingToggle.tsx';

type AutopilotSectionProps = {
  settings?: Settings;
  updateSettings: (settings: DeepPartial<Settings>) => void;
};

const REFRESH_MS = 30_000;
const SIDES = ['left', 'right'] as const;

const AUTOPILOT_INFO = 'While you sleep, moves the bed a few degrees around the temperature you set: cooler early in the '
  + 'night and back up toward morning, one degree at a time. Set the temperature yourself at any time and it holds what '
  + 'you set and learns from it. It treats the bed as one sleeper\'s, so switching it on links the two sides. '
  + 'Experimental. Saved nights are under Data.';
const TEST_INFO = 'Plays a whole night\'s plan in 20 minutes on the bed as it is set now, so you can watch what the '
  + 'autopilot does without sleeping through it: about a degree a minute, never more than 4 from where it started, and '
  + 'back to where it started at the end. Change the temperature while it runs to see it hold what you set. Nobody needs '
  + 'to be in bed, and nothing is learned from it.';
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
    sleeper.breathingRate !== undefined && `${sleeper.breathingRate} breaths/min`,
    isSteered && !autopilot.rehearsal && sleeper.lastChange,
  ].filter(Boolean).join(' · ');
};

// When and how well a linked tracker's sleep has been matching the bed's, in a line
const describeLink = (link: AutopilotSnapshot['left']['tracker']): string | undefined => {
  if (!link) return undefined;
  const nights = `${link.nights} ${link.nights === 1 ? 'night' : 'nights'}`;
  const received = new Date(link.syncedAt).toLocaleDateString([], { dateStyle: 'medium' });
  return `${link.source}, last received ${received}. ${link.agreementPercent}% match over ${nights}.`;
};

const captionSx = { color: 'text.secondary', display: 'block' };

// Everything about following sleep: the autopilot with its 20-minute test and the link to
// Apple Health (on Pods with the sensors for it), and the older biometrics service. Who is in
// bed is shown by the In-bed detection section.
export default function AutopilotSection({ settings, updateSettings }: AutopilotSectionProps) {
  const { isUpdating } = useAppStore();
  const { data: autopilot, refetch } = useAutopilot(REFRESH_MS);
  const [testRefusal, setTestRefusal] = useState<string | undefined>(undefined);
  const [isTestChanging, setIsTestChanging] = useState(false);
  if (!settings) return null;
  // A Pod without the sensors has only the biometrics service to offer
  if (!autopilot?.available) return <Section title="Sleep tracking"><BiometricsSetting/></Section>;

  const isEnabled = settings.autopilot.enabled;
  const test = autopilot.rehearsal;
  const sleeper = describeSleeper(autopilot, isEnabled);
  const link = describeLink(autopilot.left.tracker);

  // Starts the test, or stops the one running; a refusal from the Pod is shown under the button
  const changeTest = () => {
    setIsTestChanging(true);
    setTestRefusal(undefined);
    (test ? stopRehearsal() : startRehearsal())
      .then(refusal => setTestRefusal(refusal))
      .then(() => refetch())
      .catch(error => console.error(error))
      .finally(() => setIsTestChanging(false));
  };

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
        <Box>
          <SettingRow label="20-minute test" info={ TEST_INFO }>
            <Button size="small" variant="outlined" disabled={ isTestChanging || (!isEnabled && !test) } onClick={ changeTest }>
              { test ? 'Stop' : 'Start' }
            </Button>
          </SettingRow>
          { test && (
            <Typography variant="caption" sx={ captionSx } role="status">
              { test.minutesLeft } min left{ autopilot.left.lastChange ? ` · ${autopilot.left.lastChange}` : '' }
            </Typography>
          ) }
          { !test && testRefusal && <Typography variant="caption" sx={ { ...captionSx, color: 'warning.main' } }>{ testRefusal }</Typography> }
          { !test && !testRefusal && !isEnabled && (
            <Typography variant="caption" sx={ captionSx }>Switch the autopilot on to run it.</Typography>
          ) }
        </Box>
        <Box>
          <SettingRow label="Sleep tracker" info={ TRACKER_INFO }>
            <Button size="small" variant="outlined" component="a" href={ APPLE_HEALTH_GUIDE_URL } target="_blank" rel="noopener noreferrer">
              Link Apple Health
            </Button>
          </SettingRow>
          { link && <Typography variant="caption" sx={ captionSx }>{ link }</Typography> }
        </Box>
        <Divider/>
        <BiometricsSetting/>
      </Box>
    </Section>
  );
}
