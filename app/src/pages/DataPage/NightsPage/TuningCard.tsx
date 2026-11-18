import { Box, Paper, Typography } from '@mui/material';
import { AutopilotSnapshot } from '@api/autopilot.ts';

type TuningCardProps = { tuning: AutopilotSnapshot['left'] };

const formatDegrees = (offsetF: number) => `${offsetF > 0 ? '+' : ''}${offsetF}°F`;

// What the bed has tuned for one side: how it judges sleep, how that compares with a linked
// sleep tracker, and what the sleeper's own temperature changes taught it
export default function TuningCard({ tuning }: TuningCardProps) {
  const { rules, tracker, learned } = tuning;
  const breathing = rules.maxBreathingSpread === undefined ? '' : `, breathing steady to ${rules.maxBreathingSpread}/min`;
  const facts = [
    ['Asleep after', `${rules.stillMinutesToSleep} still min${breathing}`],
    ['Awake after', `3 min in 5 with ${rules.restlessSecondsToWake}+ s moving`],
    ['Sleep tracker', tracker
      ? `${tracker.source}, ${tracker.nights} ${tracker.nights === 1 ? 'night' : 'nights'}: ${tracker.onsetErrorMinutes} min off asleep, `
        + `${tracker.wakeErrorMinutes} awake`
      : 'Not linked'],
    ['Learned', `early ${formatDegrees(learned.early)}, middle ${formatDegrees(learned.middle)}, late ${formatDegrees(learned.late)}`],
  ];
  return (
    <Paper sx={ { p: 2, display: 'flex', flexDirection: 'column', gap: 0.75 } }>
      <Typography sx={ { fontWeight: 600, mb: 0.5 } }>Tuning</Typography>
      { facts.map(([label, value]) => (
        <Box key={ label } sx={ { display: 'flex', justifyContent: 'space-between', gap: 2 } }>
          <Typography variant="body2" sx={ { color: 'text.secondary', flexShrink: 0 } }>{ label }</Typography>
          <Typography variant="body2" sx={ { textAlign: 'right' } }>{ value }</Typography>
        </Box>
      )) }
    </Paper>
  );
}
