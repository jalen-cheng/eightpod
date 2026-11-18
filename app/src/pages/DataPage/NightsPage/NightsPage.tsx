/* eslint-disable react/no-multi-comp */
import { ReactNode, useState } from 'react';
import moment, { Moment } from 'moment-timezone';
import { Box, IconButton, Paper, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import NightsStayOutlinedIcon from '@mui/icons-material/NightsStayOutlined';
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
import TuningCard from './TuningCard.tsx';

const DATE_FORMAT = 'YYYY-MM-DD';
const SIDES = ['left', 'right'] as const;

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

// When the sleeper went to sleep and woke, for how long, and how often sleep was broken
const NightSummary = ({ night }: { night: NightDetail }) => {
  const { asleepAtMs, awakeAtMs, tracker } = night;
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
    </Paper>
  );
};

// One day at a time: last night by default, with arrows and a calendar to move to another.
// A night belongs to the morning it ended on. These come from the autopilot's own log, so
// they are here whether or not biometrics is on.
export default function NightsPage() {
  const { side, setSide } = useAppStore();
  const [day, setDay] = useState<Moment>(moment().startOf('day'));
  const [stayIndex, setStayIndex] = useState(0);
  const { data: nights } = useNightsOn(day.format(DATE_FORMAT), side);
  const { data: autopilot } = useAutopilot();
  const isToday = day.isSameOrAfter(moment(), 'day');
  const night = nights?.[Math.min(stayIndex, nights.length - 1)];

  const showDay = (nextDay: Moment) => {
    setDay(nextDay.clone().startOf('day'));
    setStayIndex(0);
  };

  return (
    <PageContainer sx={ { mb: 15, mt: 2 } }>
      <Box sx={ { display: 'flex', alignItems: 'flex-start', gap: 1, width: '100%' } }>
        <Header title="Nights" icon={ <NightsStayOutlinedIcon/> }/>
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
            disableFuture
            format="ddd D MMM YYYY"
            slotProps={ { textField: { size: 'small', sx: { width: 190 }, 'aria-label': 'Day shown' } } }
          />
          <IconButton aria-label="Next day" disabled={ isToday } onClick={ () => showDay(day.clone().add(1, 'day')) }>
            <NavigateNextIcon/>
          </IconButton>
        </Box>
        <Box sx={ { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1, flexWrap: 'wrap' } }>
          <ToggleButtonGroup
            exclusive
            size="small"
            value={ side }
            onChange={ (_event, picked: typeof side | null) => picked && setSide(picked) }
          >
            { SIDES.map(option => (
              <ToggleButton key={ option } value={ option } sx={ { px: 2 } }>{ option === 'left' ? 'Left' : 'Right' }</ToggleButton>
            )) }
          </ToggleButtonGroup>
          { nights && nights.length > 1 && (
            <ToggleButtonGroup
              exclusive
              size="small"
              value={ stayIndex }
              onChange={ (_event, picked: number | null) => picked !== null && setStayIndex(picked) }
            >
              { nights.map((stay, index) => (
                <ToggleButton key={ stay.startedAtMs } value={ index } sx={ { px: 1.5 } }>
                  { stay.kind === 'nap' ? 'Nap' : 'Night' } { formatClock(stay.asleepAtMs ?? stay.startedAtMs) }
                </ToggleButton>
              )) }
            </ToggleButtonGroup>
          ) }
        </Box>
        { nights?.length === 0 && (
          <Typography sx={ { color: 'text.secondary', textAlign: 'center', py: 3 } }>Nothing saved for this day.</Typography>
        ) }
        { night && (
          <>
            <NightSummary night={ night }/>
            <NightChart night={ night }/>
          </>
        ) }
        { autopilot?.available && <TuningCard tuning={ autopilot[side] }/> }
      </Box>
    </PageContainer>
  );
}
