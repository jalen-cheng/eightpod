import { Box, Typography } from '@mui/material';
import WaterDropOutlinedIcon from '@mui/icons-material/WaterDropOutlined';
import { useSettings } from '@api/settings.ts';
import { useAppStore } from '@state/appStore.tsx';
import { TemperatureFormat, describeTemperature, getTemperatureParts } from '@lib/temperatureConversions.ts';

type TemperatureLabelProps = {
  isOn: boolean;
  sliderTemp: number;
  sliderColor: string;
  currentTargetTemp: number;
  currentTemperatureF: number;
  // The water temperature the bed measures, when the Pod reports it
  measuredTemperatureF?: number;
  temperatureFormat: TemperatureFormat;
};

// The figures in the middle of the dial: the target, and where the bed is now
export default function TemperatureLabel({
  isOn, sliderTemp, sliderColor, currentTargetTemp, currentTemperatureF, measuredTemperatureF, temperatureFormat,
}: TemperatureLabelProps) {
  const { side } = useAppStore();
  const { data: settings } = useSettings();
  const temperature = getTemperatureParts(sliderTemp, temperatureFormat);
  const isAdjusting = sliderTemp !== currentTargetTemp;
  let targetLabel = '';
  if (sliderTemp < currentTemperatureF) targetLabel = isAdjusting ? 'Cool to' : 'Cooling to';
  if (sliderTemp > currentTemperatureF) targetLabel = isAdjusting ? 'Warm to' : 'Warming to';
  // A bare "+1" needs saying what it is; degrees carry their own unit
  if (temperatureFormat === 'level') targetLabel = targetLabel ? `${targetLabel} level` : 'Level';

  return (
    <Box sx={ { textAlign: 'center', whiteSpace: 'nowrap', pointerEvents: 'none' } }>
      <Typography variant="body2" sx={ { color: 'text.secondary', minHeight: 21 } }>{ isOn ? targetLabel : '' }</Typography>
      <Typography
        component="p"
        sx={ {
          fontSize: isOn ? 'clamp(44px, 14vw, 64px)' : 'clamp(40px, 12vw, 52px)',
          fontWeight: 500, letterSpacing: '-0.01em', lineHeight: 1.2, my: 0.5,
        } }
      >
        { isOn ? (
          <>
            { temperature.value }
            <Box component="span" sx={ { fontSize: 27, verticalAlign: 'top', lineHeight: 2 } }>
              { temperature.unit }
            </Box>
          </>
        ) : 'Off' }
      </Typography>
      { /* Where the bed is now. The measured water temperature when the Pod reports it; otherwise
           the firmware's own estimate of the level it has reached. */ }
      { isOn && (
        <Box sx={ { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 } }>
          { measuredTemperatureF === undefined
            ? <Box component="span" sx={ { width: 5, height: 5, borderRadius: '50%', bgcolor: sliderColor, mr: 0.25 } }/>
            : <WaterDropOutlinedIcon aria-hidden sx={ { fontSize: 13, color: sliderColor } }/> }
          <Typography variant="caption" sx={ { color: 'text.secondary' } }>
            { measuredTemperatureF === undefined
              ? `Currently at ${describeTemperature(currentTemperatureF, temperatureFormat)}`
              : `Bed at ${describeTemperature(Math.round(measuredTemperatureF), temperatureFormat)}` }
          </Typography>
        </Box>
      ) }
      { !isOn && !settings?.[side]?.awayMode && (
        <Typography variant="body2" sx={ { color: 'text.secondary' } }>Tap to turn on</Typography>
      ) }
    </Box>
  );
}
