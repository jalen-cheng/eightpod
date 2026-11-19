import { ToggleButtonGroup, ToggleButton } from '@mui/material';
import { useAppStore } from '@state/appStore.tsx';
import { postDeviceStatus, useDeviceStatus } from '@api/deviceStatus.ts';
import { getOtherSide } from '@lib/sides.ts';

// The Pod takes a moment to report a change back
const STATUS_SETTLE_MS = 1_000;
// The picker's value while the sides are linked and controlled as one
const BOTH_SIDES = 'both';
const CHOICES = [
  { value: 'left', name: 'Left', label: 'Left side' },
  { value: 'right', name: 'Right', label: 'Right side' },
  { value: BOTH_SIDES, name: 'Both', label: 'Both sides, controlled as one' },
] as const;
// eslint-disable-next-line @typescript-eslint/no-type-alias
type Choice = typeof CHOICES[number]['value'];

// Picks what this device controls: the left side, the right side, or both as one. Left or right
// is remembered on the device, so two people can each keep their own side on their own phone.
// "Both" links the sides, which is a setting of the bed: every change then applies to the
// whole bed, from any device, until a single side is picked again.
export default function SideControl() {
  const { side, setSide, linkSides, setLinkSides, isUpdating, setIsUpdating } = useAppStore();
  const { data: deviceStatus, refetch } = useDeviceStatus();

  // Linking brings the other side in line with this one straight away, so both start from the
  // same state. The temperature is only sent to a side that is on, so a side that is off stays off.
  const matchOtherSide = () => {
    const sideStatus = deviceStatus?.[side];
    if (!sideStatus) return;
    const matchingStatus = sideStatus.isOn ? { isOn: true, targetTemperatureF: sideStatus.targetTemperatureF } : { isOn: false };
    setIsUpdating(true);
    postDeviceStatus({ [getOtherSide(side)]: matchingStatus })
      .then(() => new Promise(resolve => setTimeout(resolve, STATUS_SETTLE_MS)))
      .then(() => refetch())
      .catch(error => console.error(error))
      .finally(() => setIsUpdating(false));
  };

  const choose = (choice: Choice | null) => {
    if (choice === null) return;
    const shouldLink = choice === BOTH_SIDES;
    if (!shouldLink) setSide(choice);
    if (shouldLink === linkSides) return;
    setLinkSides(shouldLink);
    if (shouldLink) matchOtherSide();
  };

  return (
    <ToggleButtonGroup
      exclusive
      value={ linkSides ? BOTH_SIDES : side }
      onChange={ (_, choice: Choice | null) => choose(choice) }
      size="small"
      disabled={ isUpdating }
      aria-label="The side this device controls"
    >
      { CHOICES.map(({ value, name, label }) => (
        <ToggleButton key={ value } value={ value } aria-label={ label } sx={ { px: 1.5 } }>{ name }</ToggleButton>
      )) }
    </ToggleButtonGroup>
  );
}
