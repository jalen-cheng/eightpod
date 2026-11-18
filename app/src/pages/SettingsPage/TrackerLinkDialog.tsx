import { useState } from 'react';
import {
  Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, ToggleButton, ToggleButtonGroup, Typography,
} from '@mui/material';
import { AutopilotSnapshot } from '@api/autopilot.ts';

type TrackerLinkDialogProps = {
  open: boolean;
  onClose: () => void;
  autopilot: AutopilotSnapshot;
};

const SIDES = ['left', 'right'] as const;

// The request the phone sends each morning, with this Pod's address and the chosen side in it
const buildRequestBody = (side: typeof SIDES[number]) => (
  `{"side":"${side}","source":"Apple Health","samples":[Combined Text]}`
);

// How well the bed's own sleep and wake times agree with the tracker's, in a line
const describeLink = (link: AutopilotSnapshot['left']['tracker']): string => {
  if (!link) return 'Nothing received yet.';
  const nights = `${link.nights} ${link.nights === 1 ? 'night' : 'nights'}`;
  return `${link.source}, last received ${new Date(link.syncedAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}. `
    + `Over ${nights} the bed was off by ${link.onsetErrorMinutes} min falling asleep and ${link.wakeErrorMinutes} min waking.`;
};

// How to send a watch's or band's sleep and wake times to the bed every morning. Whoop, Fitbit
// (through a sync app) and Apple Watch all write sleep to Apple Health, and a Shortcut can read
// it there, so one recipe covers them without any account or cloud link on the Pod.
export default function TrackerLinkDialog({ open, onClose, autopilot }: TrackerLinkDialogProps) {
  const [side, setSide] = useState<typeof SIDES[number]>('left');
  const podAddress = import.meta.env.VITE_ENV === 'demo' ? 'http://eightpod.local' : window.location.origin;
  const steps = [
    'In Shortcuts, tap + and add Find Health Samples: Type is Sleep, Start Date is in the last 1 day.',
    'Add Repeat with Each over the samples. Inside it add a Text action holding '
      + '{"start":"Start Date","end":"End Date","value":"Value"}, picking each from Repeat Item with the dates set to ISO 8601.',
    'After the repeat, add Combine Text on the Repeat Results, with a comma as the separator.',
    `Add a Text action holding ${buildRequestBody(side)}, with Combined Text picked from the step before.`,
    `Add Get Contents of URL: ${podAddress}/api/autopilot/sleepTimes, Method POST, a header Content-Type: application/json, `
      + 'Request Body File, and that Text as the file.',
    'In Automation, run it every morning: when your Sleep Focus turns off, or at a set time.',
  ];

  return (
    <Dialog open={ open } onClose={ onClose } fullWidth maxWidth="sm">
      <DialogTitle>Link a sleep tracker</DialogTitle>
      <DialogContent sx={ { display: 'flex', flexDirection: 'column', gap: 1.5 } }>
        <Typography variant="body2" sx={ { color: 'text.secondary' } }>
          Each morning your phone sends the times your watch or band says you fell asleep and woke. The bed compares them
          with its own and adjusts how it judges sleep. It works with anything that writes sleep to Apple Health.
        </Typography>
        <ToggleButtonGroup
          exclusive
          size="small"
          value={ side }
          onChange={ (_event, value: typeof side | null) => value && setSide(value) }
        >
          { SIDES.map(option => (
            <ToggleButton key={ option } value={ option }>{ option === 'left' ? 'Left side' : 'Right side' }</ToggleButton>
          )) }
        </ToggleButtonGroup>
        <Typography variant="body2">{ describeLink(autopilot[side].tracker) }</Typography>
        <Box
          component="ol"
          sx={ { m: 0, pl: 2.5, display: 'flex', flexDirection: 'column', gap: 0.75, fontSize: 13.5, overflowWrap: 'anywhere' } }
        >
          { steps.map(step => <li key={ step }>{ step }</li>) }
        </Box>
        <Typography variant="caption" sx={ { color: 'text.secondary' } }>
          These steps have not been run on a phone yet. Any script can send the same request; see the API guide.
        </Typography>
      </DialogContent>
      <DialogActions sx={ { px: 3, pb: 2 } }>
        <Button onClick={ onClose }>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
