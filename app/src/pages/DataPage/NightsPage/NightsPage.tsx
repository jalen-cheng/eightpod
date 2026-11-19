/* eslint-disable react/no-multi-comp */
import { ReactNode, useState } from 'react';
import moment, { Moment } from 'moment-timezone';
import {
  Alert, Box, Button, IconButton, Paper, Skeleton, ToggleButton, ToggleButtonGroup, Typography,
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import BedOutlinedIcon from '@mui/icons-material/BedOutlined';
import NavigateBeforeIcon from '@mui/icons-material/NavigateBefore';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import BedtimeOutlinedIcon from '@mui/icons-material/BedtimeOutlined';
import AlarmOutlinedIcon from '@mui/icons-material/AlarmOutlined';
import HourglassEmptyOutlinedIcon from '@mui/icons-material/HourglassEmptyOutlined';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import WatchOutlinedIcon from '@mui/icons-material/WatchOutlined';
import { NightDetail, useAutopilot, useNightsOn } from '@api/autopilot.ts';
import StatusTag from '@components/StatusTag.tsx';
import { useAppStore } from '@state/appStore.tsx';
import PageContainer from '../../PageContainer.tsx';
import Header from '../Header.tsx';
import ExportMenu from './ExportMenu.tsx';
import NightChart from './NightChart.tsx';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import SleepTimesDialog from './SleepTimesDialog.tsx';
import TuningCard from './TuningCard.tsx';

const DATE_FORMAT = 'YYYY-MM-DD';
// What a stay in bed is called where the day has several: by its sleep, or "In bed" when none was seen
const STAY_NAMES = { night: 'Night', nap: 'Nap', none: 'In bed' } as const;
// A night still being recorded gains a row a minute
const TODAY_REFRESH_MS = 60_000;

const formatClock = (timeMs: number) => moment(timeMs).format('h:mm A');
const formatLength = (minutes: number) => `${Math.floor(minutes / 60)}h ${String(Math.round(minutes % 60)).padStart(2, '0')}m`;

type SummaryRowProps = { icon: ReactNode; label: string; value: string };

// One figure of the night: an icon, its name, and the figure on the right
const SummaryRow = ({ icon, label, value }: SummaryRowProps) => (
  <Box sx={ { display: 'flex', alignItems: 'center', gap: 1.5 } }>
    <Box sx={ { display: 'grid', placeItems: 'center', color: 'text.secondary', '& svg': { fontSize: 20 } } }>{ icon }</Box>
    <Typography sx={ { fontSize: 14, fontWeight: 500, flex: 1 } }>{ label }</Typography>
    <Typography sx={ { fontSize: 14 } }>{ value }</Typography>
  </Box>
);

// When the sleeper went to sleep and woke, for how long, and how often sleep was broken, with
// a way to say when they really slept
const NightSummary = ({ night, onCorrected }: { night: NightDetail; onCorrected: () => void }) => {
  const { asleepAtMs, awakeAtMs, tracker } = night;
  const [isCorrecting, setIsCorrecting] = useState(false);
  const hasSleep = asleepAtMs !== undefined && awakeAtMs !== undefined;
  return (
    <Paper sx={ { p: 2, display: 'flex', flexDirection: 'column', gap: 1.25 } }>
      <Box sx={ { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } }>
        <Typography sx={ { fontWeight: 600 } }>Summary</Typography>
        <StatusTag
          tone={ !hasSleep ? 'neutral' : night.kind === 'nap' ? 'info' : 'good' }
          label={ !hasSleep ? 'No sleep seen' : night.kind === 'nap' ? 'Nap' : 'Night' }
        />
      </Box>
      <SummaryRow icon={ <BedtimeOutlinedIcon/> } label="Bedtime" value={ hasSleep ? formatClock(asleepAtMs) : '-' }/>
      <SummaryRow icon={ <AlarmOutlinedIcon/> } label="Wake time" value={ hasSleep ? formatClock(awakeAtMs) : '-' }/>
      <SummaryRow
        icon={ <HourglassEmptyOutlinedIcon/> }
        label="Duration"
        value={ hasSleep ? formatLength((awakeAtMs - asleepAtMs) / 60_000) : '-' }
      />
      <SummaryRow icon={ <VisibilityOutlinedIcon/> } label="Wake-ups" value={ hasSleep ? String(night.wakeUps) : '-' }/>
      { tracker && (
        <SummaryRow
          icon={ <WatchOutlinedIcon/> }
          label={ tracker.source }
          value={ `${formatClock(tracker.asleepAtMs)} to ${formatClock(tracker.awakeAtMs)}` }
        />
      ) }
      <Button
        size="small"
        variant="outlined"
        startIcon={ <EditOutlinedIcon/> }
        onClick={ () => setIsCorrecting(true) }
        sx={ { alignSelf: 'flex-start', mt: 0.5 } }
      >
        Manual override
      </Button>
      { isCorrecting && (
        <SleepTimesDialog
          night={ night }
          onClose={ () => setIsCorrecting(false) }
          onSaved={ () => {
            setIsCorrecting(false);
            onCorrected();
          } }
        />
      ) }
    </Paper>
  );
};

// One day at a time: last night by default, with arrows and a calendar to move to another.
// A night belongs to the morning it ended on. These come from the bed's own log, so they are
// here whether or not biometrics is on. With the sides linked the bed is one sleeper's and is
// shown as one, whichever side they lay on; otherwise it is the side this device controls.
export default function NightsPage() {
  const { side, linkSides } = useAppStore();
  const shownSide = linkSides ? undefined : side;
  // Until a day is picked the page shows today, worked out afresh each time it draws: the app
  // keeps the clock in the Pod's time zone, and a page left open overnight moves on with it
  const [pickedDay, setPickedDay] = useState<Moment | undefined>(undefined);
  const today = moment().startOf('day');
  const day = pickedDay ?? today;
  const isToday = day.isSameOrAfter(today, 'day');
  const [stayIndex, setStayIndex] = useState(0);
  const {
    data: nights, isPending, isError, refetch: refetchNights,
  } = useNightsOn(day.format(DATE_FORMAT), shownSide, isToday ? TODAY_REFRESH_MS : undefined);
  const { data: autopilot, refetch: refetchAutopilot } = useAutopilot();
  // Times set by hand change the night shown and how the bed's detection stands against them
  const reloadAfterCorrection = () => {
    void refetchNights();
    void refetchAutopilot();
  };
  const night = nights?.[Math.min(stayIndex, nights.length - 1)];

  const showDay = (nextDay: Moment) => {
    // Going back to today lets the page follow the clock again
    setPickedDay(nextDay.isSameOrAfter(today, 'day') ? undefined : nextDay.clone().startOf('day'));
    setStayIndex(0);
  };

  return (
    <PageContainer sx={ { mb: 15, mt: 2 } }>
      <Box sx={ { display: 'flex', alignItems: 'flex-start', gap: 1, width: '100%' } }>
        <Header title="Sleep" icon={ <BedOutlinedIcon/> }/>
        <ExportMenu/>
      </Box>
      <Box sx={ { display: 'flex', flexDirection: 'column', gap: 2, width: '100%' } }>
        <Box sx={ { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 } }>
          <IconButton aria-label="Previous day" onClick={ () => showDay(day.clone().subtract(1, 'day')) }>
            <NavigateBeforeIcon/>
          </IconButton>
          <DatePicker
            value={ day }
            onChange={ (picked) => picked?.isValid() && showDay(picked) }
            maxDate={ today }
            format="ddd D MMM YYYY"
            slotProps={ { textField: { size: 'small', sx: { width: 190 }, 'aria-label': 'Day shown' } } }
          />
          <IconButton aria-label="Next day" disabled={ isToday } onClick={ () => showDay(day.clone().add(1, 'day')) }>
            <NavigateNextIcon/>
          </IconButton>
        </Box>
        { nights && nights.length > 1 && (
          <ToggleButtonGroup
            exclusive
            size="small"
            value={ Math.min(stayIndex, nights.length - 1) }
            onChange={ (_event, picked: number | null) => picked !== null && setStayIndex(picked) }
            aria-label="Which sleep of the day"
            // A day can hold several stays: they stay on one line and scroll sideways on a narrow screen
            sx={ { alignSelf: 'stretch', overflowX: 'auto', scrollbarWidth: 'none', '&::-webkit-scrollbar': { display: 'none' } } }
          >
            { nights.map((stay, index) => (
              <ToggleButton key={ `${stay.side}-${stay.startedAtMs}` } value={ index } sx={ { px: 1.5, flexShrink: 0, whiteSpace: 'nowrap' } }>
                { STAY_NAMES[stay.kind ?? 'none'] } { formatClock(stay.asleepAtMs ?? stay.startedAtMs) }
              </ToggleButton>
            )) }
          </ToggleButtonGroup>
        ) }
        { isPending && <Skeleton variant="rounded" height={ 180 }/> }
        { isError && <Alert severity="error">Unable to load this day from your Pod.</Alert> }
        { nights?.length === 0 && (
          <Typography sx={ { color: 'text.secondary', textAlign: 'center', py: 3 } }>Nothing saved for this day.</Typography>
        ) }
        { night && (
          <>
            <NightSummary key={ `${night.side}-${night.startedAtMs}` } night={ night } onCorrected={ reloadAfterCorrection }/>
            <NightChart night={ night }/>
          </>
        ) }
        { autopilot?.available && <TuningCard tuning={ autopilot.left }/> }
      </Box>
    </PageContainer>
  );
}
