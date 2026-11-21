import { MouseEvent, useEffect } from 'react';
import { Alert, Box, Button, IconButton, Paper, Skeleton } from '@mui/material';
import PowerSettingsNewIcon from '@mui/icons-material/PowerSettingsNew';
import AlarmDismissal from './AlarmDismissal.tsx';
import AwayNotification from './AwayNotification.tsx';
import PageContainer from '../PageContainer.tsx';
import PageHeader from '@components/PageHeader.tsx';
import { SIDEBAR_WIDTH_PX } from '@components/pageFrame.ts';
import AnalyzeSleepPrompt from './AnalyzeSleepPrompt.tsx';
import AutopilotNotice from './AutopilotNotice.tsx';
import PrimingNotification from './PrimingNotification.tsx';
import Slider from './Slider.tsx';
import WaterNotification from './WaterNotification.tsx';
import { useAppStore } from '@state/appStore.tsx';
import { useControlTempStore } from './controlTempStore.tsx';
import { usePowerToggle } from './usePowerToggle.ts';
import { useDeviceStatus } from '@api/deviceStatus';
import { useSettings } from '@api/settings.ts';

// The room the layout keeps free at the bottom of a phone screen for the navigation bar
const MOBILE_NAV_SPACE_PX = 88;

export default function ControlTempPage() {
  const { isError, isPending, refetch, data: deviceStatus } = useDeviceStatus();
  const setDeviceStatus = useControlTempStore(state => state.setDeviceStatus);
  const { data: settings } = useSettings();
  const { isUpdating, side } = useAppStore();
  const sideStatus = deviceStatus?.[side];
  // While a press is being sent, show what was asked for instead of waiting for the Pod's reply
  const requestedIsOn = useControlTempStore(state => state.deviceStatus?.[side]?.isOn);
  const isOn = (isUpdating ? requestedIsOn : undefined) ?? sideStatus?.isOn ?? false;

  const power = usePowerToggle(sideStatus !== undefined, refetch);
  // While the side is off the whole page beside the navigation is the button that turns it on
  const isTurnOnTarget = !isOn && !isPending && !isError && power.canToggle;
  const turnOn = () => { if (!power.disabled) power.setPower(true); };
  // A press on the page, the dial included, turns the side on, unless it landed on a button or link of its own
  const turnOnFromPage = (event: MouseEvent<HTMLElement>) => {
    const pressed = event.target as HTMLElement;
    // A dialog opened from this page is drawn elsewhere in the document but still reports its presses here
    if (!event.currentTarget.contains(pressed)) return;
    if (!pressed.closest('button, a')) turnOn();
  };

  useEffect(() => { refetch(); }, [side, refetch]);
  const hasPendingEdit = useControlTempStore(state => state.hasPendingEdit);
  // Polled state must not replace a temperature the user is still adjusting
  useEffect(() => {
    if (deviceStatus && !hasPendingEdit) setDeviceStatus(deviceStatus);
  }, [deviceStatus, hasPendingEdit, setDeviceStatus]);

  // One button for both directions, so it keeps focus through a toggle. Its state shows in
  // its weight, not its colour: filled while the side is on, plain while it is off.
  const powerButton = !isPending && !isError && power.canToggle && (
    <IconButton
      aria-label={ isOn ? 'Turn off' : 'Turn on' }
      disabled={ power.disabled }
      onClick={ (event) => {
        // The section's own press handler must not also run
        event.stopPropagation();
        power.setPower(!isOn);
      } }
      sx={ { color: isOn ? 'text.primary' : 'text.secondary', bgcolor: isOn ? 'action.selected' : 'transparent' } }
    >
      <PowerSettingsNewIcon sx={ { fontSize: 22 } }/>
    </IconButton>
  );

  return (
    <PageContainer
      containerProps={ { onClick: isTurnOnTarget ? turnOnFromPage : undefined } }
      sx={ {
        gap: 2,
        // Above the layer that takes presses on the empty space around the page
        position: 'relative', zIndex: 1, cursor: isTurnOnTarget && !power.disabled ? 'pointer' : undefined,
        // On a phone the page fills the screen above the navigation bar, so the dial can sit in
        // the middle of it and the notices (the next alarm among them) at the bottom
        minHeight: { xs: `calc(100dvh - ${MOBILE_NAV_SPACE_PX}px - env(safe-area-inset-bottom))`, md: 0 },
      } }
    >
      <PageHeader title="Temperature">
        { /* On a phone the power button sits in line with the heading */ }
        <Box sx={ { display: { xs: 'flex', sm: 'none' } } }>{ powerButton }</Box>
      </PageHeader>
      { /* The space outside the page's column, up to the navigation, turns an off side on too */ }
      { isTurnOnTarget && (
        // A press on it reaches the page's own handler above, so it has none of its own
        <Box
          aria-hidden
          sx={ { position: 'fixed', inset: 0, left: { md: SIDEBAR_WIDTH_PX }, zIndex: -1, cursor: power.disabled ? 'default' : 'pointer' } }
        />
      ) }
      <Paper
        // Off a phone the dial is framed by an outline, with no fill of its own. The power button turns
        // the side on for the keyboard and screen readers, so the page itself is not a button.
        sx={ {
          px: { xs: 0, sm: 3 }, py: { xs: 1.5, sm: 3 }, overflow: 'hidden', my: { xs: 'auto', md: 0 },
          bgcolor: 'transparent', borderWidth: { xs: 0, sm: 1 }, borderRadius: { xs: 0, sm: '16px' },
          ...(isTurnOnTarget && {
            transition: 'border-color 120ms',
            '@media (hover: hover)': { '&:hover': { borderColor: 'text.secondary' } },
          }),
        } }>
        { /* On a wider screen it sits in the top right corner of the dial's frame */ }
        <Box sx={ { display: { xs: 'none', sm: 'flex' }, justifyContent: 'flex-end', mb: 0.5, minHeight: 44 } }>{ powerButton }</Box>
        { isPending ? (
          <Skeleton variant="circular" width={ 240 } height={ 240 } sx={ { mx: 'auto', my: 3 } }/>
        ) : isError ? (
          <Alert severity="error" sx={ { my: 3 } }>Unable to reach your Pod. Try connecting again.</Alert>
        ) : (
          <Box sx={ { display: 'flex', justifyContent: 'center', pt: 1 } }>
            <Slider
              isOn={ isOn }
              currentTargetTemp={ sideStatus?.targetTemperatureF ?? 55 }
              refetch={ refetch }
              currentTemperatureF={ sideStatus?.currentTemperatureF ?? 55 }
            />
          </Box>
        ) }
        { isError && (
          <Button fullWidth variant="contained" onClick={ () => refetch() } disabled={ isUpdating }>Reconnect</Button>
        ) }
        { !isPending && !isError && <AutopilotNotice/> }
      </Paper>
      <AnalyzeSleepPrompt isOffered={ power.isAnalyzeOffered }/>
      <Box sx={ { display: 'flex', flexDirection: 'column', gap: 1.5 } }>
        { deviceStatus?.isPriming && <PrimingNotification/> }
        <AwayNotification settings={ settings }/>
        <WaterNotification/>
      </Box>
      <AlarmDismissal refetch={ refetch }/>
    </PageContainer>
  );
}
