import { Box, ToggleButtonGroup, ToggleButton, Typography } from '@mui/material';
import LinkIcon from '@mui/icons-material/Link';
import LinkOffIcon from '@mui/icons-material/LinkOff';
import { useAppStore } from '@state/appStore.tsx';
import { useSettings } from '@api/settings.ts';
import { useTemperatureFormat } from '@lib/useTemperatureFormat.ts';
import { useDeviceStatus } from '@api/deviceStatus.ts';
import { formatTemperature } from '@lib/temperatureConversions.ts';

type SideControlProps = {
  showTemp?: boolean;
  // Called after the link is switched on or off, for pages that need to act on it right away
  onLinkSidesChange?: (linkSides: boolean) => void;
};

// The side picker's value while the sides are linked and controlled as one
const BOTH_SIDES = 'both';

// Picks the side being viewed, with a button to link both sides so changes apply to the whole bed
export default function SideControl({ showTemp, onLinkSidesChange }: SideControlProps) {
  const { side, setSide, linkSides, setLinkSides, isUpdating } = useAppStore();
  const { data: settings } = useSettings();
  const { data: deviceStatus } = useDeviceStatus();
  const temperatureFormat = useTemperatureFormat();

  const handleLinkToggle = () => {
    const nextLinkSides = !linkSides;
    setLinkSides(nextLinkSides);
    onLinkSidesChange?.(nextLinkSides);
  };

  const sideName = (bedSide: 'left' | 'right') => settings?.[bedSide]?.name || `${bedSide === 'left' ? 'Left' : 'Right'} side`;

  return (
    <Box sx={ { display: 'flex', flexDirection: 'column', gap: 0.75 } }>
      <Box sx={ { display: 'flex', gap: 1 } }>
        { /* Linked: there is no side to pick, so the two buttons become one */ }
        <ToggleButtonGroup
          exclusive
          value={ linkSides ? BOTH_SIDES : side }
          onChange={ (_, selectedSide: unknown) => {
            if (selectedSide === 'left' || selectedSide === 'right') setSide(selectedSide);
          } }
          size="small"
          aria-label="Bed side"
          sx={ { flex: 1, minWidth: 0, '& .MuiToggleButton-root': { flex: 1, minWidth: 0 } } }
        >
          { linkSides && (
            <ToggleButton value={ BOTH_SIDES } aria-label={ `Both sides: ${sideName('left')} and ${sideName('right')}` }>
              <Typography component="span" variant="body2">Both sides</Typography>
            </ToggleButton>
          ) }
          { !linkSides && (['left', 'right'] as const).map(bedSide => (
            <ToggleButton key={ bedSide } value={ bedSide } aria-label={ `${bedSide} side` }>
              <Box component="span" sx={ { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, minWidth: 0 } }>
                <Typography component="span" variant="body2" sx={ { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }>
                  { sideName(bedSide) }
                </Typography>
                { showTemp && side !== bedSide && (
                  <Typography component="span" variant="caption" sx={ { color: 'text.secondary', flexShrink: 0 } }>
                    { deviceStatus?.[bedSide]?.isOn ? formatTemperature(deviceStatus[bedSide].targetTemperatureF, temperatureFormat) : 'Off' }
                  </Typography>
                ) }
              </Box>
            </ToggleButton>
          )) }
        </ToggleButtonGroup>
        { /* Says what pressing it will do, so the way back out of linking is never a guess */ }
        <ToggleButton
          value="linkSides"
          size="small"
          disabled={ isUpdating }
          onChange={ handleLinkToggle }
          aria-label={ linkSides ? 'Unlink sides' : 'Link both sides' }
          sx={ { gap: 0.75, px: 1.5, flexShrink: 0 } }
        >
          { linkSides ? <LinkOffIcon fontSize="small"/> : <LinkIcon fontSize="small"/> }
          { /* "Unlink" always shows. Unlinked on a phone, the two side names need the room, so "Link" is icon only */ }
          <Typography component="span" variant="body2" sx={ { display: { xs: linkSides ? 'inline' : 'none', sm: 'inline' } } }>
            { linkSides ? 'Unlink' : 'Link' }
          </Typography>
        </ToggleButton>
      </Box>
    </Box>
  );
}
