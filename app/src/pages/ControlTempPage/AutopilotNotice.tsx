import { Link as RouterLink } from 'react-router-dom';
import { Link, Typography } from '@mui/material';
import { useAutopilot } from '@api/autopilot.ts';
import { formatTemperature } from '@lib/temperatureConversions.ts';
import { useTemperatureFormat } from '@lib/useTemperatureFormat.ts';
import { useAppStore } from '@state/appStore.tsx';

const REFRESH_MS = 30_000;

// With the autopilot on, says in a line what it is doing and where it is adjusted
export default function AutopilotNotice() {
  const { side } = useAppStore();
  const { data: autopilot } = useAutopilot(REFRESH_MS);
  const temperatureFormat = useTemperatureFormat();
  if (!autopilot?.available || !autopilot.enabled) return null;

  const { holdingF, offsetF, sleepKind } = autopilot[side];
  const isSteering = offsetF !== undefined || sleepKind === 'night';
  let notice = 'Autopilot is on and takes over once you are asleep.';
  if (holdingF !== undefined) {
    notice = `Autopilot is holding the ${formatTemperature(holdingF, temperatureFormat)} you set.`;
  } else if (isSteering) {
    notice = 'Autopilot is steering tonight.';
  }
  return (
    <Typography
      variant="caption"
      role="status"
      sx={ { display: 'block', mt: 2, px: 2, textAlign: 'center', color: 'text.secondary', textWrap: 'balance' } }
    >
      { notice } Adjust it in{ ' ' }
      <Link component={ RouterLink } to="/settings" color="inherit" sx={ { whiteSpace: 'nowrap' } }>Settings &gt; Autopilot</Link>.
    </Typography>
  );
}
