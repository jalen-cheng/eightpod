import {
  Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Typography,
} from '@mui/material';
import { AutopilotSnapshot } from '@api/autopilot.ts';

type TrackerLinkDialogProps = {
  open: boolean;
  onClose: () => void;
  autopilot: AutopilotSnapshot;
};

// The request the phone sends each morning
const REQUEST_BODY = '{"source":"Apple Health","samples":[Combined Text]}';

// How well the bed's own sleep and wake times agree with the tracker's, in a line
const describeLink = (link: AutopilotSnapshot['left']['tracker']): string => {
  if (!link) return 'Nothing received yet.';
  const nights = `${link.nights} ${link.nights === 1 ? 'night' : 'nights'}`;
  return `${link.source}, last received ${new Date(link.syncedAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}. `
    + `Over ${nights} the bed agreed with it ${link.agreementPercent}% of the time.`;
};

// How to send a watch's or band's sleep and wake times to the bed every morning. Apple Watch,
// Whoop and Fitbit all write sleep to Apple Health, where only something on the phone can read
// it: an app that posts it on a schedule, or a Shortcut run by an automation. Either way, once
// set up it runs by itself. iPhone only: Android's Health Connect has no such route built here.
export default function TrackerLinkDialog({ open, onClose, autopilot }: TrackerLinkDialogProps) {
  const podAddress = import.meta.env.VITE_ENV === 'demo' ? 'http://sevensleep.local' : window.location.origin;
  const steps = [
    'In Shortcuts, tap + and add Find Health Samples: Type is Sleep, Start Date is in the last 1 day.',
    'Add Repeat with Each over the samples. Inside it add a Text action holding '
      + '{"start":"Start Date","end":"End Date","value":"Value"}, picking each from Repeat Item with the dates set to ISO 8601.',
    'After the repeat, add Combine Text on the Repeat Results, with a comma as the separator.',
    `Add a Text action holding ${REQUEST_BODY}, with Combined Text picked from the step before.`,
    `Add Get Contents of URL: ${podAddress}/api/autopilot/sleepTimes, Method POST, a header Content-Type: application/json, `
      + 'Request Body File, and that Text as the file.',
    'In Automation, run it every morning: when your Sleep Focus turns off, or at a set time.',
  ];

  return (
    <Dialog open={ open } onClose={ onClose } fullWidth maxWidth="sm">
      <DialogTitle>Link a sleep tracker</DialogTitle>
      <DialogContent sx={ { display: 'flex', flexDirection: 'column', gap: 1.5 } }>
        <Typography variant="body2" sx={ { color: 'text.secondary' } }>
          Each morning your iPhone sends the times your watch or band says you fell asleep and woke. The bed compares them
          with its own and adjusts how it judges sleep. Apple Watch, Whoop and Fitbit all write sleep to Apple Health, and
          Apple Health can only be read by something on the phone, so it is set up once there. It then runs on its own,
          though only once the phone has been unlocked that morning. Android is not supported yet.
        </Typography>
        <Typography variant="body2">{ describeLink(autopilot.left.tracker) }</Typography>
        <Typography variant="subtitle2">With an app, no Shortcut</Typography>
        <Typography variant="body2" sx={ { fontSize: 13.5, overflowWrap: 'anywhere' } }>
          The paid iPhone app Health Auto Export can post Apple Health data on a schedule. Add a REST API automation for
          Sleep Analysis with the address { podAddress }/api/autopilot/sleepTimes and switch Summarize Data off.
        </Typography>
        <Typography variant="subtitle2">With a Shortcut</Typography>
        <Box
          component="ol"
          sx={ { m: 0, pl: 2.5, display: 'flex', flexDirection: 'column', gap: 0.75, fontSize: 13.5, overflowWrap: 'anywhere' } }
        >
          { steps.map(step => <li key={ step }>{ step }</li>) }
        </Box>
        <Typography variant="caption" sx={ { color: 'text.secondary' } }>
          Neither route has been run on a phone yet. Any script can send the same request; see the API guide.
        </Typography>
      </DialogContent>
      <DialogActions sx={ { px: 3, pb: 2 } }>
        <Button onClick={ onClose }>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
