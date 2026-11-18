import { useState } from 'react';
import { DeepPartial } from 'ts-essentials';
import { postDeviceStatus } from '@api/deviceStatus.ts';
import { DeviceStatus } from '@api/deviceStatusSchema.ts';
import { useSettings } from '@api/settings.ts';
import { useAppStore } from '@state/appStore.tsx';
import { buildSidesPayload, getControlledSides } from '@lib/sides.ts';
import { useControlTempStore } from './controlTempStore.tsx';

// The Pod takes a moment to report a change back
const STATUS_SETTLE_MS = 1_000;
// How long the offer to analyze the night stays up after the bed is turned off
const ANALYZE_OFFER_MS = 20_000;

// Turns the selected side (both, when linked) on or off, and says when that is allowed.
// `isStatusLoaded` is false until the Pod has reported its state: until then the app's idea of
// on or off is a placeholder, and a press could turn off a side that is actually on.
export function usePowerToggle(isStatusLoaded: boolean, refetch: () => Promise<{ data?: DeviceStatus }>) {
  const { isUpdating, setIsUpdating, side, linkSides } = useAppStore();
  const { data: settings } = useSettings();
  const setDeviceStatus = useControlTempStore(state => state.setDeviceStatus);
  const [isAnalyzeOffered, setIsAnalyzeOffered] = useState(false);
  const isInAwayMode = Boolean(settings?.[side]?.awayMode);

  const setPower = (powerOn: boolean) => {
    const deviceStatus: DeepPartial<DeviceStatus> = buildSidesPayload(getControlledSides(side, linkSides), { isOn: powerOn });
    setIsAnalyzeOffered(!powerOn);
    if (!powerOn) setTimeout(() => setIsAnalyzeOffered(false), ANALYZE_OFFER_MS);

    setIsUpdating(true);
    setDeviceStatus(deviceStatus);
    postDeviceStatus(deviceStatus)
      .then(() => new Promise((resolve) => setTimeout(resolve, STATUS_SETTLE_MS)))
      .then(() => refetch())
      .then((result) => { if (result.data) setDeviceStatus(result.data); })
      .catch(error => console.error(error))
      .finally(() => setIsUpdating(false));
  };

  return {
    setPower,
    // Away mode keeps the side off, so there is nothing to toggle
    canToggle: !isInAwayMode,
    disabled: isUpdating || isInAwayMode || !isStatusLoaded,
    isAnalyzeOffered: isAnalyzeOffered && !isUpdating,
  };
}
