/* eslint-disable react/no-multi-comp */
import { useMemo } from 'react';
import moment from 'moment-timezone';
import { Box, Paper, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { LineChart } from '@mui/x-charts/LineChart';
import { useResizeDetector } from 'react-resize-detector';
import { NightDetail } from '@api/autopilot.ts';
import { COOLING_COLOR } from '@lib/temperatureConversions.ts';

// Along the axis a whole hour is written short ("6 AM"), so the last label fits on a narrow phone;
// the tooltip keeps the minutes
const formatAxisTime = (time: Date, context: { location: string }) => (
  moment(time).format(context.location === 'tick' && time.getMinutes() === 0 ? 'h A' : 'h:mm A')
);

const MINUTE_MS = 60_000;
const CHART_HEIGHT_PX = 150;
// About one point for every few pixels: more than that only slows the page
const PIXELS_PER_POINT = 3;

type Series = { label: string; unit: string; color: string; values: (number | null)[] };
type SeriesChartProps = { times: Date[]; series: Series; width: number };

// One reading through the night as a line against the clock
const SeriesChart = ({ times, series, width }: SeriesChartProps) => {
  const hasReadings = series.values.some(value => value !== null);
  return (
    <Box>
      <Typography sx={ { fontSize: 13, fontWeight: 500, color: 'text.secondary' } }>{ series.label }</Typography>
      { hasReadings ? (
        <LineChart
          width={ width }
          height={ CHART_HEIGHT_PX }
          margin={ { top: 8, right: 16, bottom: 4, left: 0 } }
          hideLegend
          xAxis={ [{ data: times, scaleType: 'time', valueFormatter: formatAxisTime }] }
          yAxis={ [{ width: 44, valueFormatter: (value: number) => String(value) }] }
          series={ [{
            data: series.values, color: series.color, showMark: false, connectNulls: false, curve: 'linear',
            valueFormatter: value => (value === null ? '' : `${value} ${series.unit}`),
          }] }
        />
      ) : (
        <Typography variant="body2" sx={ { color: 'text.disabled', py: 2 } }>No readings</Typography>
      ) }
    </Box>
  );
};

// A night's breathing, pressure on the bed and the autopilot's temperature changes, each
// against the same clock
export default function NightChart({ night }: { night: NightDetail }) {
  const { width = 300, ref } = useResizeDetector();
  const theme = useTheme();

  const { times, series } = useMemo(() => {
    // The night is cut into stretches of a few minutes, one point each: the average of the
    // readings in it, so a short spike still shows
    const step = Math.max(1, Math.ceil(night.minutes.length / (width / PIXELS_PER_POINT)));
    const stretches: NightDetail['minutes'][] = [];
    for (let start = 0; start < night.minutes.length; start += step) stretches.push(night.minutes.slice(start, start + step));
    const read = (pick: (minute: NightDetail['minutes'][number]) => number | undefined) => stretches.map((stretch) => {
      const readings = stretch.flatMap((minute) => {
        const reading = pick(minute);
        return reading === undefined ? [] : [reading];
      });
      if (readings.length === 0) return null;
      return Math.round(readings.reduce((sum, reading) => sum + reading, 0) / readings.length * 10) / 10;
    });
    return {
      times: stretches.map((_stretch, index) => new Date(night.startedAtMs + index * step * MINUTE_MS)),
      series: [
        { label: 'Movement', unit: 's/min', color: theme.palette.primary.main, values: read(minute => minute.movementSeconds) },
        { label: 'Pressure', unit: '', color: theme.palette.text.secondary, values: read(minute => minute.pressure) },
        { label: 'Temperature change', unit: '°F', color: COOLING_COLOR, values: read(minute => minute.offsetF) },
      ] satisfies Series[],
    };
  }, [night, width, theme]);

  return (
    <Paper ref={ ref } sx={ { p: 2, display: 'flex', flexDirection: 'column', gap: 1.5, overflow: 'hidden' } }>
      { series.map(one => <SeriesChart key={ one.label } times={ times } series={ one } width={ Math.max(200, width - 32) }/>) }
    </Paper>
  );
}
