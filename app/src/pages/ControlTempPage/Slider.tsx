import { KeyboardEvent } from 'react';
import { CircularSliderWithChildren } from 'react-circular-slider-svg';
import { Box, Typography } from '@mui/material';
import { useAppStore } from '@state/appStore';
import styles from './Slider.module.scss';
import TemperatureLabel from './TemperatureLabel.tsx';
import NextSwitch from './NextSwitch.tsx';
import { useControlTempStore } from './controlTempStore.tsx';
import { useTargetTemperature } from './useTargetTemperature.ts';
import { useTheme } from '@mui/material/styles';
import { useResizeDetector } from 'react-resize-detector';
import { useSettings } from '@api/settings.ts';
import { useTemperatureFormat } from '@lib/useTemperatureFormat.ts';
import {
  MAX_TEMP_F, MIN_TEMP_F, describeTemperature, formatTemperature, getDirectionColor,
} from '@lib/temperatureConversions.ts';

type SliderProps = {
  isOn: boolean;
  currentTargetTemp: number;
  currentTemperatureF: number;
  refetch: () => Promise<unknown>;
}

// The row across the open bottom of the dial, below where the arc stops: the labels for the two
// ends of the dial at its sides, and what the bed does next between them
const FOOT_ROW = { position: 'absolute', top: '79%', height: 30, pointerEvents: 'none' } as const;
const rangeLabelSx = { ...FOOT_ROW, lineHeight: `${FOOT_ROW.height}px`, color: 'text.secondary' };
// How far each arrow key moves the target, in steps of the display unit
const KEY_STEPS: Record<string, number> = { ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1 };

export default function Slider({ isOn, currentTargetTemp, refetch, currentTemperatureF }: SliderProps) {
  const deviceStatus = useControlTempStore(state => state.deviceStatus);
  const { isUpdating, side } = useAppStore();
  const { data: settings } = useSettings();
  const temperatureFormat = useTemperatureFormat();
  const { previewTargetTemperature, commitTargetTemperature, stepTargetTemperature } = useTargetTemperature(refetch);
  const isInAwayMode = settings?.[side]?.awayMode;
  const disabled = Boolean(isUpdating || isInAwayMode || !isOn);
  const { width, ref } = useResizeDetector();
  const theme = useTheme();
  const sideStatus = deviceStatus?.[side];
  const targetTemperatureF = sideStatus?.targetTemperatureF ?? currentTargetTemp;
  const sliderColor = getDirectionColor(sideStatus?.currentTemperatureF, sideStatus?.targetTemperatureF);
  const arcBackgroundColor = theme.palette.divider;

  // The arc is drawn between the bed's current temperature and the target, so the dial has two
  // handles. The stylesheet hides whichever one sits on the current temperature.
  const minTemp = Math.min(sideStatus?.currentTemperatureF || MIN_TEMP_F, targetTemperatureF);
  const maxTemp = Math.max(sideStatus?.currentTemperatureF || MIN_TEMP_F, targetTemperatureF);
  const isHeating = (sideStatus?.currentTemperatureF ?? MIN_TEMP_F) < targetTemperatureF;

  const handleDrag = (value: number) => {
    if (!disabled) previewTargetTemperature(value);
  };

  // The dial is dragged; the arrow keys step it for keyboards and screen readers
  const handleKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const steps = KEY_STEPS[event.key];
    if (steps === undefined || disabled) return;
    event.preventDefault();
    stepTargetTemperature(steps);
  };

  return (
    <div
      ref={ ref }
      style={ {
        position: 'relative', display: 'inline-block', width: '100%', maxWidth: '320px',
        // Read by the stylesheet to draw the handle as a ring in the arc's colour
        ['--dial-color' as string]: sliderColor, ['--dial-knob-fill' as string]: theme.palette.background.default,
      } }
    >
      { /* The dial is square, and its foot row is placed over the open bottom of the arc */ }
      <div style={ { position: 'relative' } }>
        { /* Circular Slider */ }
        <div
          className={ `${styles.Slider} ${disabled && styles.Disabled} ${isHeating && styles.Heating}` }
          role="slider"
          tabIndex={ disabled ? -1 : 0 }
          aria-label="Target temperature"
          aria-disabled={ disabled }
          aria-valuemin={ MIN_TEMP_F }
          aria-valuemax={ MAX_TEMP_F }
          aria-valuenow={ targetTemperatureF }
          aria-valuetext={ describeTemperature(targetTemperatureF, temperatureFormat) }
          onKeyDown={ handleKey }
        >
          <CircularSliderWithChildren
            disabled={ disabled }
            onControlFinished={ () => void commitTargetTemperature() }
            size={ width ?? 280 }
            trackWidth={ 10 }
            minValue={ MIN_TEMP_F }
            maxValue={ MAX_TEMP_F }
            startAngle={ 60 }
            endAngle={ 300 }
            angleType={ {
              direction: 'cw',
              axis: '-y'
            } }
            handle1={ { value: minTemp, onChange: handleDrag } }
            arcColor={ isOn ? sliderColor : arcBackgroundColor }
            arcBackgroundColor={ arcBackgroundColor }
            handle2={ { value: maxTemp, onChange: handleDrag } }
            handleSize={ 10 }
          >
            <TemperatureLabel
              isOn={ isOn }
              sliderTemp={ targetTemperatureF }
              sliderColor={ sliderColor }
              currentTargetTemp={ currentTargetTemp }
              currentTemperatureF={ currentTemperatureF }
              measuredTemperatureF={ sideStatus?.measuredTemperatureF }
              temperatureFormat={ temperatureFormat }
            />
          </CircularSliderWithChildren>
        </div>
        { isOn && (
          <>
            <Typography variant="caption" sx={ { ...rangeLabelSx, left: 0 } }>
              { formatTemperature(MIN_TEMP_F, temperatureFormat) }
            </Typography>
            <Typography variant="caption" sx={ { ...rangeLabelSx, right: 0 } }>
              { formatTemperature(MAX_TEMP_F, temperatureFormat) }
            </Typography>
          </>
        ) }
        <Box sx={ { ...FOOT_ROW, left: 0, right: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' } }>
          <NextSwitch isOn={ isOn }/>
        </Box>
      </div>
    </div>
  );
};
