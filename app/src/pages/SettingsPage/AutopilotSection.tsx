import { DeepPartial } from 'ts-essentials';
import { useState } from 'react';
import { Box, Button, Switch, Typography } from '@mui/material';
import StatusTag, { StatusTone } from '@components/StatusTag.tsx';
import { Settings } from '@api/settingsSchema.ts';
import { AutopilotSnapshot, useAutopilot } from '@api/autopilot.ts';
import { useAppStore } from '@state/appStore.tsx';
import Section from './Section.tsx';
import SettingRow from './SettingRow.tsx';
import SettingToggle from './SettingToggle.tsx';
import TrackerLinkDialog from './TrackerLinkDialog.tsx';

type AutopilotSectionProps = {
  settings?: Settings;
  updateSettings: (settings: DeepPartial<Settings>) => void;
};

const REFRESH_MS = 30_000;
const SIDES = ['left', 'right'] as const;

const AUTOPILOT_INFO = 'While you sleep, moves the bed a few degrees around the temperature you set: cooler early in the '
  + 'night, back up toward morning, and against a room that warms or cools. Change the temperature '
  + 'yourself at any time and it keeps your change and learns from it. Experimental: sleep is judged from lying still, '
  + 'and a nap is left alone.';
const TRACKER_INFO = 'Send the sleep and wake times from a watch or band each morning, and the bed tunes how it judges '
  + 'sleep to match them.';

const STAGE_NAMES: Record<AutopilotSnapshot['left']['stage'], string> = { out: 'empty', awake: 'awake', asleep: 'asleep' };
const STAGE_TONES: Record<AutopilotSnapshot['left']['stage'], StatusTone> = { out: 'neutral', awake: 'info', asleep: 'good' };

// One side in a line: a nap or not, heart rate while there is one, and what the autopilot last did
const describeSide = (side: AutopilotSnapshot['left']): string => {
  const facts = [
    side.sleepKind === 'nap' && 'Nap, not adjusted',
    side.heartRate !== undefined && `${side.heartRate} bpm`,
    side.sleepKind !== 'nap' && side.lastChange,
  ].filter(Boolean);
  return facts.length > 0 ? facts.join(' · ') : 'No change yet';
};

// Which sides a tracker has reported on, in a few words
const describeTrackers = (autopilot: AutopilotSnapshot): string => {
  const linked = SIDES.filter(side => autopilot[side].tracker);
  if (linked.length === 0) return 'Not linked';
  return linked.map(side => `${side === 'left' ? 'Left' : 'Right'}: ${autopilot[side].tracker?.source}`).join(' · ');
};

// Switches the autopilot on and shows what it sees. Hidden on Pods without the sensors it needs.
export default function AutopilotSection({ settings, updateSettings }: AutopilotSectionProps) {
  const { isUpdating } = useAppStore();
  const { data: autopilot } = useAutopilot(REFRESH_MS);
  const [isLinkOpen, setIsLinkOpen] = useState(false);
  if (!settings || !autopilot?.available) return null;
  const isEnabled = settings.autopilot.enabled;

  return (
    <Section
      title="Autopilot"
      action={ SIDES.map(side => (
        <StatusTag
          key={ side }
          tone={ STAGE_TONES[autopilot[side].stage] }
          label={ `${side === 'left' ? 'Left' : 'Right'} ${STAGE_NAMES[autopilot[side].stage]}` }
        />
      )) }
    >
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
        { isEnabled && SIDES.filter(side => autopilot[side].stage !== 'out').map(side => (
          <Box key={ side } sx={ { display: 'flex', justifyContent: 'space-between', gap: 2 } }>
            <Typography sx={ { fontSize: 14, fontWeight: 500 } }>{ side === 'left' ? 'Left' : 'Right' }</Typography>
            <Typography variant="body2" sx={ { color: 'text.secondary', textAlign: 'right' } }>{ describeSide(autopilot[side]) }</Typography>
          </Box>
        )) }
        <SettingRow label="Sleep tracker" info={ TRACKER_INFO }>
          <Typography variant="body2" sx={ { color: 'text.secondary' } }>{ describeTrackers(autopilot) }</Typography>
          <Button size="small" variant="outlined" onClick={ () => setIsLinkOpen(true) }>Link</Button>
        </SettingRow>
      </Box>
      <TrackerLinkDialog open={ isLinkOpen } onClose={ () => setIsLinkOpen(false) } autopilot={ autopilot }/>
    </Section>
  );
}
