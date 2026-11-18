/* eslint-disable react/no-multi-comp */
import moment from 'moment-timezone';
import { Box, Button, Divider, Paper, Typography } from '@mui/material';
import NightsStayOutlinedIcon from '@mui/icons-material/NightsStayOutlined';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import { baseURL } from '@api/api';
import { AutopilotSnapshot, NightSummary, useAutopilot, useAutopilotNights } from '@api/autopilot.ts';
import StatusTag from '@components/StatusTag.tsx';
import PageContainer from '../../PageContainer.tsx';
import Header from '../Header.tsx';

const SIDES = ['left', 'right'] as const;
const NIGHTS_SHOWN = 30;
const EXPORT_ADDRESS = `${baseURL}/api/autopilot/nights/export`;

const formatClock = (timeMs: number) => moment(timeMs).format('h:mm A');
const formatSpan = (fromMs: number, untilMs: number) => `${formatClock(fromMs)} to ${formatClock(untilMs)}`;
const formatLength = (minutes: number) => `${Math.floor(minutes / 60)} h ${String(Math.round(minutes % 60)).padStart(2, '0')} min`;
const formatDegrees = (offsetF: number) => `${offsetF > 0 ? '+' : ''}${offsetF}°F`;

// "12 min later" or "3 min earlier": how the bed's time compares with the worn tracker's
const formatDifference = (bedMs: number, trackerMs: number) => {
  const minutes = Math.round((bedMs - trackerMs) / 60_000);
  return minutes === 0 ? 'same' : `${Math.abs(minutes)} min ${minutes > 0 ? 'later' : 'earlier'}`;
};

type FactProps = { label: string; value: string };

// One labelled figure on a line
const Fact = ({ label, value }: FactProps) => (
  <Box sx={ { display: 'flex', justifyContent: 'space-between', gap: 2 } }>
    <Typography variant="body2" sx={ { color: 'text.secondary' } }>{ label }</Typography>
    <Typography variant="body2" sx={ { textAlign: 'right' } }>{ value }</Typography>
  </Box>
);

// One stay in bed: when the bed thought sleep began and ended, and what a worn tracker said
const NightCard = ({ night }: { night: NightSummary }) => {
  const hasSleep = night.asleepAtMs !== undefined && night.awakeAtMs !== undefined;
  const readings = [
    night.heartRate !== undefined && `${Math.round(night.heartRate)} bpm`,
    night.breathingRate !== undefined && `${Math.round(night.breathingRate)} breaths a minute`,
  ].filter(Boolean).join(' · ');
  return (
    <Paper sx={ { p: 2, display: 'flex', flexDirection: 'column', gap: 0.75 } }>
      <Box sx={ { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1 } }>
        <Typography sx={ { fontWeight: 600 } }>
          { moment(night.startedAtMs).format('ddd D MMM') } · { night.side === 'left' ? 'Left' : 'Right' }
        </Typography>
        <StatusTag
          tone={ !hasSleep ? 'neutral' : night.kind === 'nap' ? 'info' : 'good' }
          label={ !hasSleep ? 'No sleep seen' : night.kind === 'nap' ? 'Nap' : 'Night' }
        />
      </Box>
      <Fact label="In bed" value={ `${formatClock(night.startedAtMs)}, ${formatLength(night.minutesLogged)}` }/>
      { night.asleepAtMs !== undefined && night.awakeAtMs !== undefined && (
        <Fact
          label="Asleep (bed)"
          value={ `${formatSpan(night.asleepAtMs, night.awakeAtMs)}, ${formatLength((night.awakeAtMs - night.asleepAtMs) / 60_000)}` }
        />
      ) }
      { night.tracker && (
        <Fact
          label={ `Asleep (${night.tracker.source})` }
          value={ formatSpan(night.tracker.asleepAtMs, night.tracker.awakeAtMs) }
        />
      ) }
      { night.tracker && night.asleepAtMs !== undefined && night.awakeAtMs !== undefined && (
        <Fact
          label="Bed against tracker"
          value={
            `asleep ${formatDifference(night.asleepAtMs, night.tracker.asleepAtMs)}, `
            + `awake ${formatDifference(night.awakeAtMs, night.tracker.awakeAtMs)}`
          }
        />
      ) }
      { readings && <Fact label="While asleep" value={ readings }/> }
    </Paper>
  );
};

// What the bed has tuned for one side: how it judges sleep, and what your changes taught it
const TuningCard = ({ side, tuning }: { side: typeof SIDES[number]; tuning: AutopilotSnapshot['left'] }) => {
  const { rules, tracker, learned } = tuning;
  const breathing = rules.maxBreathingSpread === undefined ? '' : `, breathing steady to ${rules.maxBreathingSpread} a minute`;
  return (
    <Paper sx={ { p: 2, display: 'flex', flexDirection: 'column', gap: 0.75 } }>
      <Typography sx={ { fontWeight: 600 } }>{ side === 'left' ? 'Left' : 'Right' }</Typography>
      <Fact label="Asleep after" value={ `${rules.stillMinutesToSleep} still minutes${breathing}` }/>
      <Fact label="Awake after" value={ `3 minutes in 5 with ${rules.restlessSecondsToWake}+ moving seconds` }/>
      <Fact
        label="Sleep tracker"
        value={ tracker
          ? `${tracker.source}, ${tracker.nights} ${tracker.nights === 1 ? 'night' : 'nights'}: off by ${tracker.onsetErrorMinutes} min asleep, `
            + `${tracker.wakeErrorMinutes} min awake`
          : 'Not linked' }
      />
      <Fact
        label="Learned from your changes"
        value={ `early ${formatDegrees(learned.early)}, middle ${formatDegrees(learned.middle)}, late ${formatDegrees(learned.late)}` }
      />
    </Paper>
  );
};

// The stays in bed the Pod has saved, what it has tuned from them, and a way to keep a copy.
// These come from the autopilot's own log, so they are here whether or not biometrics is on.
export default function NightsPage() {
  const { data: nights } = useAutopilotNights(NIGHTS_SHOWN);
  const { data: autopilot } = useAutopilot();

  return (
    <PageContainer sx={ { mb: 15, mt: 2 } }>
      <Header title="Nights" icon={ <NightsStayOutlinedIcon/> }/>
      <Box sx={ { display: 'flex', flexDirection: 'column', gap: 2, width: '100%' } }>
        <Box sx={ { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2 } }>
          <Typography variant="body2" sx={ { color: 'text.secondary' } }>
            Every stay in bed of 20 minutes or more, saved on the Pod. The newest 180 are kept.
          </Typography>
          <Button
            size="small"
            variant="outlined"
            component="a"
            href={ EXPORT_ADDRESS }
            download
            startIcon={ <FileDownloadOutlinedIcon/> }
            sx={ { flexShrink: 0 } }
          >
            Export
          </Button>
        </Box>
        { autopilot?.available && (
          <>
            <Typography variant="h6">Tuning</Typography>
            { SIDES.map(side => <TuningCard key={ side } side={ side } tuning={ autopilot[side] }/>) }
            <Divider/>
          </>
        ) }
        { nights?.length === 0 && (
          <Typography sx={ { color: 'text.secondary' } }>Nothing saved yet. The first night appears here in the morning.</Typography>
        ) }
        { nights?.map(night => <NightCard key={ `${night.side}-${night.startedAtMs}` } night={ night }/>) }
      </Box>
    </PageContainer>
  );
}
