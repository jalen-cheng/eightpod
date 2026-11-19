import {
  Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Typography,
} from '@mui/material';
import { AutopilotSnapshot } from '@api/autopilot.ts';

type TrackerLinkDialogProps = {
  open: boolean;
  onClose: () => void;
  autopilot: AutopilotSnapshot;
};

// How well the bed's own sleep and wake times agree with the tracker's, in a line
const describeLink = (link: AutopilotSnapshot['left']['tracker']): string => {
  if (!link) return 'Nothing received yet.';
  const nights = `${link.nights} ${link.nights === 1 ? 'night' : 'nights'}`;
  return `Last received from ${link.source} on ${new Date(link.syncedAt).toLocaleDateString([], { dateStyle: 'medium' })}. `
    + `${link.agreementPercent}% match over ${nights}.`;
};

// How to send a watch's or band's sleep to the bed every morning: an iPhone Shortcut that reads
// last night from Apple Health and posts it, run by an automation. This is the short form with
// this Pod's address in it; the docs have every step. iPhone only.
export default function TrackerLinkDialog({ open, onClose, autopilot }: TrackerLinkDialogProps) {
  const podAddress = import.meta.env.VITE_ENV === 'demo' ? 'http://sevensleep.local' : window.location.origin;
  const steps = [
    'In Shortcuts, add Find Health Samples: Type is Sleep, from the last day.',
    'Repeat with Each: a Text of {"start":"Start Date","end":"End Date","value":"Value"} with ISO 8601 dates. Then Combine Text with commas.',
    `Get Contents of URL: POST to ${podAddress}/api/autopilot/sleepTimes with the JSON {"source":"Apple Health","samples":[Combined Text]}.`,
    'Add an Automation that runs it when your Sleep Focus turns off.',
  ];

  return (
    <Dialog open={ open } onClose={ onClose } fullWidth maxWidth="xs">
      <DialogTitle>Link a sleep tracker</DialogTitle>
      <DialogContent sx={ { display: 'flex', flexDirection: 'column', gap: 1.5 } }>
        <Typography variant="body2" sx={ { color: 'text.secondary' } }>
          An iPhone Shortcut sends last night&apos;s sleep from Apple Health each morning, and the bed tunes how it
          judges sleep to match.
        </Typography>
        <Box
          component="ol"
          sx={ { m: 0, pl: 2.5, display: 'flex', flexDirection: 'column', gap: 0.75, fontSize: 13.5, overflowWrap: 'anywhere' } }
        >
          { steps.map(step => <li key={ step }>{ step }</li>) }
        </Box>
        <Typography variant="caption" sx={ { color: 'text.secondary' } }>{ describeLink(autopilot.left.tracker) }</Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={ onClose }>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
