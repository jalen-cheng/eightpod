import { KeyboardEvent, useEffect } from 'react';
import { Alert, Box, Button, IconButton, Paper, Skeleton, Typography } from '@mui/material';
import PowerSettingsNewIcon from '@mui/icons-material/PowerSettingsNew';
import ThermostatOutlinedIcon from '@mui/icons-material/ThermostatOutlined';
import AlarmDismissal from './AlarmDismissal.tsx';
import AlarmNotification from './AlarmNotification.tsx';
import AwayNotification from './AwayNotification.tsx';
import ErrorBoundary from '@components/ErrorBoundary.tsx';
import PageContainer from '../PageContainer.tsx';
import PageHeader from '@components/PageHeader.tsx';
import AnalyzeSleepPrompt from './AnalyzeSleepPrompt.tsx';
import PrimingNotification from './PrimingNotification.tsx';
import SideControl from '@components/SideControl.tsx';
import Slider from './Slider.tsx';
import WaterNotification from './WaterNotification.tsx';
import { useAppStore } from '@state/appStore.tsx';
import { useControlTempStore } from './controlTempStore.tsx';
import { usePowerToggle } from './usePowerToggle.ts';
import { postDeviceStatus, useDeviceStatus } from '@api/deviceStatus';
import { getOtherSide } from '@lib/sides.ts';
import { useSettings } from '@api/settings.ts';

// The Pod takes a moment to report a change back
const STATUS_SETTLE_MS = 1_000;

// The room the layout keeps free at the bottom of a phone screen for the navigation bar
const MOBILE_NAV_SPACE_PX = 88;

export default function ControlTempPage() {
  const { isError, isPending, refetch, data: deviceStatus } = useDeviceStatus();
  const setDeviceStatus = useControlTempStore(state => state.setDeviceStatus);
  const { data: settings } = useSettings();
  const { isUpdating, setIsUpdating, side } = useAppStore();
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

  // Linking brings the other side in line with this one straight away, so both start from the same state
  const handleLinkSidesChange = (linkSides: boolean) => {
    if (!linkSides || !sideStatus) return;
    // The temperature is only sent to a side that is on, so a side that is off stays off
    const matchingStatus = sideStatus.isOn
      ? { isOn: true, targetTemperatureF: sideStatus.targetTemperatureF }
      : { isOn: false };
    setIsUpdating(true);
    postDeviceStatus({ [getOtherSide(side)]: matchingStatus })
      .then(() => new Promise(resolve => setTimeout(resolve, STATUS_SETTLE_MS)))
      .then(() => refetch())
      .catch(error => console.error(error))
      .finally(() => setIsUpdating(false));
  };

  return (
    <PageContainer
      sx={ {
        gap: 2,
        // On a phone the page fills the screen above the navigation bar, so the dial can sit in
        // the middle of it and the notices (the next alarm among them) at the bottom
        minHeight: { xs: `calc(100dvh - ${MOBILE_NAV_SPACE_PX}px - env(safe-area-inset-bottom))`, md: 0 },
      } }
    >
      <PageHeader title="Temperature"/>
      <SideControl
        showTemp
        onLinkSidesChange={ handleLinkSidesChange }
      />
      <Paper
        { ...(isTurnOnTarget && {
          role: 'button',
          tabIndex: 0,
          'aria-label': 'Turn on',
          'aria-disabled': power.disabled,
          onClick: turnOn,
          onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => {
            if (event.key !== 'Enter' && event.key !== ' ') return;
            event.preventDefault();
            turnOn();
          },
        }) }
        sx={ {
          px: { xs: 0, sm: 3 }, py: { xs: 1.5, sm: 3 }, overflow: 'hidden', my: { xs: 'auto', md: 0 },
          bgcolor: { xs: 'transparent', sm: 'background.paper' },
          borderWidth: { xs: 0, sm: 1 }, borderRadius: { xs: 0, sm: 3 },
          ...(isTurnOnTarget && {
            cursor: power.disabled ? 'default' : 'pointer',
            transition: 'background-color 120ms, border-color 120ms',
            '@media (hover: hover)': { '&:hover': { borderColor: 'text.secondary' } },
            '&:focus-visible': { outline: '2px solid', outlineColor: 'text.primary', outlineOffset: 2 },
          }),
        } }>
        <Box sx={ { display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5, minHeight: 44 } }>
          <Box sx={ { display: 'flex', alignItems: 'center', gap: 0.75 } }>
            <ThermostatOutlinedIcon sx={ { color: 'text.secondary', fontSize: 17 } }/>
            <Typography variant="body2" sx={ { fontWeight: 500 } }>Bed temperature</Typography>
          </Box>
          { /* The power mark: lit and a button of its own while the side is on, a dim hint that
               the section can be pressed while it is off */ }
          { !isPending && !isError && power.canToggle && (
            isOn ? (
              <IconButton
                aria-label="Turn off"
                disabled={ power.disabled }
                onClick={ () => power.setPower(false) }
                sx={ { color: 'success.main' } }
              >
                <PowerSettingsNewIcon sx={ { fontSize: 22 } }/>
              </IconButton>
            ) : (
              <Box aria-hidden sx={ { width: 44, height: 44, display: 'grid', placeItems: 'center', color: 'text.secondary' } }>
                <PowerSettingsNewIcon sx={ { fontSize: 22 } }/>
              </Box>
            )
          ) }
        </Box>
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
        <AnalyzeSleepPrompt isOffered={ power.isAnalyzeOffered }/>
      </Paper>
      <Box sx={ { display: 'flex', flexDirection: 'column', gap: 1.5 } }>
        { deviceStatus?.isPriming && <PrimingNotification/> }
        <ErrorBoundary componentName="Alarm notification"><AlarmNotification/></ErrorBoundary>
        <AwayNotification settings={ settings }/>
        <WaterNotification/>
      </Box>
      <AlarmDismissal refetch={ refetch }/>
    </PageContainer>
  );
}
