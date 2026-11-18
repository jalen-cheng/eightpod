import { ToggleButtonGroup, ToggleButton, Typography } from '@mui/material';
import { useAppStore } from '@state/appStore.tsx';
import { useTemperatureFormat } from '@lib/useTemperatureFormat.ts';
import { useDeviceStatus } from '@api/deviceStatus.ts';
import { formatTemperature } from '@lib/temperatureConversions.ts';

type SideControlProps = {
  showTemp?: boolean;
  // Called after the link is switched on or off, for pages that need to act on it right away
  onLinkSidesChange?: (linkSides: boolean) => void;
  // For a page with unsaved edits that changing side or linking would throw away
  disabled?: boolean;
};

// The picker's value while the sides are linked and controlled as one
const BOTH_SIDES = 'both';
const CHOICES = [
  { value: 'left', name: 'Left', letter: 'L', label: 'Left side' },
  { value: 'right', name: 'Right', letter: 'R', label: 'Right side' },
  { value: BOTH_SIDES, name: 'Both', letter: 'Both', label: 'Both sides, controlled as one' },
] as const;
// eslint-disable-next-line @typescript-eslint/no-type-alias
type Choice = typeof CHOICES[number]['value'];

// Picks what is being controlled: the left side, the right side, or both as one. "Both" links
// the sides, so every change applies to the whole bed until a single side is picked again.
export default function SideControl({ showTemp, onLinkSidesChange, disabled }: SideControlProps) {
  const { side, setSide, linkSides, setLinkSides, isUpdating } = useAppStore();
  const { data: deviceStatus } = useDeviceStatus();
  const temperatureFormat = useTemperatureFormat();

  const choose = (choice: Choice | null) => {
    if (choice === null) return;
    const shouldLink = choice === BOTH_SIDES;
    if (!shouldLink) setSide(choice);
    if (shouldLink !== linkSides) {
      setLinkSides(shouldLink);
      onLinkSidesChange?.(shouldLink);
    }
  };

  return (
    <ToggleButtonGroup
      exclusive
      fullWidth
      value={ linkSides ? BOTH_SIDES : side }
      onChange={ (_, choice: Choice | null) => choose(choice) }
      size="small"
      disabled={ disabled || isUpdating }
      aria-label="Bed side"
    >
      { CHOICES.map(({ value, name, letter, label }) => (
        <ToggleButton key={ value } value={ value } aria-label={ label } sx={ { gap: 1 } }>
          { /* A phone shows the letter; anything wider has room for the word */ }
          <Typography component="span" variant="body2" sx={ { display: { xs: 'none', sm: 'inline' } } }>{ name }</Typography>
          <Typography component="span" variant="body2" sx={ { display: { xs: 'inline', sm: 'none' } } }>{ letter }</Typography>
          { /* What the side not on screen is set to */ }
          { showTemp && value !== BOTH_SIDES && !linkSides && side !== value && (
            <Typography component="span" variant="caption" sx={ { color: 'text.secondary' } }>
              { deviceStatus?.[value]?.isOn ? formatTemperature(deviceStatus[value].targetTemperatureF, temperatureFormat) : 'Off' }
            </Typography>
          ) }
        </ToggleButton>
      )) }
    </ToggleButtonGroup>
  );
}
