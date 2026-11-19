import { useEffect } from 'react';
import { Alert, Box, Button, IconButton, Paper, Skeleton } from '@mui/material';
import PowerSettingsNewIcon from '@mui/icons-material/PowerSettingsNew';
import AlarmDismissal from './AlarmDismissal.tsx';
import AwayNotification from './AwayNotification.tsx';
import PageContainer from '../PageContainer.tsx';
import PageHeader from '@components/PageHeader.tsx';
import AnalyzeSleepPrompt from './AnalyzeSleepPrompt.tsx';
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
  // While the side is off the whole section is the button that turns it on
  const isTurnOnTarget = !isOn && !isPending && !isError && power.canToggle;
  const turnOn = () => { if (!power.disabled) power.setPower(true); };

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
      sx={ {
        gap: 2,
        // On a phone the page fills the screen above the navigation bar, so the dial can sit in
        // the middle of it and the notices (the next alarm among them) at the bottom
        minHeight: { xs: `calc(100dvh - ${MOBILE_NAV_SPACE_PX}px - env(safe-area-inset-bottom))`, md: 0 },
      } }
    >
      <PageHeader title="Temperature">
        { /* On a phone the power button sits in line with the heading */ }
        <Box sx={ { display: { xs: 'flex', sm: 'none' } } }>{ powerButton }</Box>
      </PageHeader>
      <Paper
        // A press anywhere in the section turns an off side on. The power button does the same
        // for the keyboard and screen readers, so the section itself is not a button.
        onClick={ isTurnOnTarget ? turnOn : undefined }
        sx={ {
          px: { xs: 0, sm: 3 }, py: { xs: 1.5, sm: 3 }, overflow: 'hidden', my: { xs: 'auto', md: 0 },
          bgcolor: { xs: 'transparent', sm: 'background.paper' },
          borderWidth: { xs: 0, sm: 1 }, borderRadius: { xs: 0, sm: '16px' },
          ...(isTurnOnTarget && {
            cursor: power.disabled ? 'default' : 'pointer',
            transition: 'background-color 120ms, border-color 120ms',
            '@media (hover: hover)': { '&:hover': { borderColor: 'text.secondary' } },
          }),
        } }>
        { /* On a wider screen it sits in the top right corner of the dial's card */ }
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
