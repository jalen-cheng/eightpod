import moment from 'moment-timezone';
import { Box, Paper, Typography } from '@mui/material';
import { AutopilotSnapshot } from '@api/autopilot.ts';

type TuningCardProps = { tuning: AutopilotSnapshot['left'] };

const PART_NAMES = { early: 'Early', middle: 'Middle', late: 'Late' } as const;

// How the bed's sleep detection stands against a linked sleep tracker, in a few words
const describeDetection = ({ tracker }: AutopilotSnapshot['left']): string => {
  if (!tracker) return 'Default';
  const nights = `${tracker.nights} ${tracker.nights === 1 ? 'night' : 'nights'}`;
  return `${tracker.isTuned ? 'Tuned to' : 'Default, checked against'} ${tracker.source}: ${tracker.agreementPercent}% match over ${nights}`;
};

// The record received last, from a tracker or set by hand: its longest sleep, and whether the
// Pod had a stay in bed to file it with. Nothing when no record has arrived.
const describeLastRecord = ({ tracker }: AutopilotSnapshot['left']): string | undefined => {
  const longest = [...(tracker?.lastSleeps ?? [])].sort((first, second) => (
    (second.awakeAtMs - second.asleepAtMs) - (first.awakeAtMs - first.asleepAtMs)
  ))[0];
  if (!tracker || !longest) return undefined;
  const times = `${moment(longest.asleepAtMs).format('ddd h:mm A')} to ${moment(longest.awakeAtMs).format('h:mm A')}`;
  return `${tracker.source}, ${times}. ${tracker.lastMatchedStays ? 'Filed with a stay in bed.' : 'No stay in bed matched it.'}`;
};

// What the sleeper's own temperature changes have taught the autopilot, whole degrees only
const describePreference = ({ learned }: AutopilotSnapshot['left']): string => {
  const parts = (Object.keys(PART_NAMES) as (keyof typeof PART_NAMES)[])
    .map(part => ({ name: PART_NAMES[part], offsetF: Math.round(learned[part]) }))
    .filter(part => part.offsetF !== 0)
    .map(part => `${part.name} ${part.offsetF > 0 ? '+' : ''}${part.offsetF}°F`);
  return parts.length > 0 ? parts.join(' · ') : 'None yet';
};

// What the autopilot has tuned for the bed's sleeper, and the record it last received, each in a line
export default function TuningCard({ tuning }: TuningCardProps) {
  const lastRecord = describeLastRecord(tuning);
  const facts = [
    ['Sleep detection', describeDetection(tuning)],
    ...(lastRecord ? [['Last record', lastRecord]] : []),
    ['Your adjustments', describePreference(tuning)],
  ];
  return (
    <Paper sx={ { p: 2, display: 'flex', flexDirection: 'column', gap: 1 } }>
      { facts.map(([label, value]) => (
        <Box key={ label } sx={ { display: 'flex', justifyContent: 'space-between', gap: 2 } }>
          <Typography sx={ { fontSize: 14, fontWeight: 500, flexShrink: 0 } }>{ label }</Typography>
          <Typography sx={ { fontSize: 14, textAlign: 'right', color: 'text.secondary' } }>{ value }</Typography>
        </Box>
      )) }
    </Paper>
  );
}
