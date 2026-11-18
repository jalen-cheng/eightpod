import { DeepPartial } from 'ts-essentials';
import { Box, Switch, Typography } from '@mui/material';
import StatusTag, { StatusTone } from '@components/StatusTag.tsx';
import { Settings } from '@api/settingsSchema.ts';
import { AutopilotSnapshot, useAutopilot } from '@api/autopilot.ts';
import { useAppStore } from '@state/appStore.tsx';
import Section from './Section.tsx';
import SettingToggle from './SettingToggle.tsx';

type AutopilotSectionProps = {
  settings?: Settings;
  updateSettings: (settings: DeepPartial<Settings>) => void;
};

const REFRESH_MS = 30_000;
const SIDES = ['left', 'right'] as const;

const AUTOPILOT_INFO = 'While you sleep, moves the bed a few degrees around the temperature you set: cooler early in the '
  + 'night and in deep sleep, back up toward morning, and against a room that warms or cools. Change the temperature '
  + 'yourself at any time and it keeps your change and learns from it. Experimental: sleep is judged from heart rate and '
  + 'stillness, and works best with one person in the bed.';

const STAGE_NAMES: Record<AutopilotSnapshot['left']['stage'], string> = { out: 'empty', awake: 'awake', asleep: 'asleep', deep: 'deep sleep' };
const STAGE_TONES: Record<AutopilotSnapshot['left']['stage'], StatusTone> = { out: 'neutral', awake: 'info', asleep: 'good', deep: 'good' };

// One side in a line: heart rate while there is one, and what the autopilot last did
const describeSide = (side: AutopilotSnapshot['left']): string => {
  const facts = [
    side.heartRate !== undefined && `${side.heartRate} bpm`,
    side.lastChange,
  ].filter(Boolean);
  return facts.length > 0 ? facts.join(' · ') : 'No change yet';
};

// Switches the autopilot on and shows what it sees. Hidden on Pods without the sensors it needs.
export default function AutopilotSection({ settings, updateSettings }: AutopilotSectionProps) {
  const { isUpdating } = useAppStore();
  const { data: autopilot } = useAutopilot(REFRESH_MS);
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
      </Box>
    </Section>
  );
}
