import { Typography } from '@mui/material';
import { useAutopilot } from '@api/autopilot.ts';
import { formatTemperature } from '@lib/temperatureConversions.ts';
import { useTemperatureFormat } from '@lib/useTemperatureFormat.ts';
import { useAppStore } from '@state/appStore.tsx';

const REFRESH_MS = 30_000;

// With the autopilot on, says in a line what it is doing and what happens to a temperature set on
// this page, which is the way to adjust it by hand: there is no separate control for that.
export default function AutopilotNotice() {
  const { side } = useAppStore();
  const { data: autopilot } = useAutopilot(REFRESH_MS);
  const temperatureFormat = useTemperatureFormat();
  if (!autopilot?.available || !autopilot.enabled) return null;

  const { holdingF, offsetF, sleepKind } = autopilot[side];
  const isSteering = offsetF !== undefined || sleepKind === 'night';
  let notice = 'Autopilot is on and takes over once you are asleep. A temperature you set here is held, and it learns from it.';
  if (holdingF !== undefined) {
    notice = `Autopilot is holding the ${formatTemperature(holdingF, temperatureFormat)} you set, and carries on from it later tonight.`;
  } else if (isSteering) {
    notice = 'Autopilot is steering tonight. Set a temperature here and it holds what you set, then learns from it.';
  }
  return (
    <Typography
      variant="caption"
      role="status"
      sx={ { display: 'block', mt: 2, px: 2, textAlign: 'center', color: 'text.secondary', textWrap: 'balance' } }
    >
      { notice }
    </Typography>
  );
}
