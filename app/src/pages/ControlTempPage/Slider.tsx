import { CircularSliderWithChildren } from 'react-circular-slider-svg';
import { Typography } from '@mui/material';
import { useAppStore } from '@state/appStore';
import styles from './Slider.module.scss';
import TemperatureLabel from './TemperatureLabel.tsx';
import TemperatureButtons from './TemperatureButtons.tsx';
import { useControlTempStore } from './controlTempStore.tsx';
import { useTargetTemperature } from './useTargetTemperature.ts';
import { useTheme } from '@mui/material/styles';
import { useResizeDetector } from 'react-resize-detector';
import { useSettings } from '@api/settings.ts';
import { useTemperatureFormat } from '@lib/useTemperatureFormat.ts';
import {
  MAX_TEMP_F, MIN_TEMP_F, formatTemperature, getDirectionColor,
} from '@lib/temperatureConversions.ts';

type SliderProps = {
  isOn: boolean;
  currentTargetTemp: number;
  currentTemperatureF: number;
  refetch: () => Promise<unknown>;
}

// Labels for the two ends of the dial. They sit below where the arc stops, clear of the handle
// when the target is at either limit.
const rangeLabelSx = { position: 'absolute', top: '79%', color: 'text.secondary', pointerEvents: 'none' };

export default function Slider({ isOn, currentTargetTemp, refetch, currentTemperatureF }: SliderProps) {
  const deviceStatus = useControlTempStore(state => state.deviceStatus);
  const { isUpdating, side } = useAppStore();
  const { data: settings } = useSettings();
  const temperatureFormat = useTemperatureFormat();
  const { previewTargetTemperature, commitTargetTemperature, stepTargetTemperature } = useTargetTemperature(refetch);
  const isInAwayMode = settings?.[side]?.awayMode;
  const disabled = isUpdating || isInAwayMode || !isOn;
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

  return (
    <div
      ref={ ref }
      style={ { position: 'relative', display: 'inline-block', width: '100%', maxWidth: '320px' } }
    >
      { /* The dial is square, and its labels and buttons are placed over the open bottom of the arc */ }
      <div style={ { position: 'relative' } }>
        { /* Circular Slider */ }
        <div className={ `${styles.Slider} ${disabled && styles.Disabled} ${isHeating && styles.Heating}` }>
          <CircularSliderWithChildren
            disabled={ disabled }
            onControlFinished={ () => void commitTargetTemperature() }
            size={ width ?? 280 }
            trackWidth={ 7 }
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
            handleSize={ 11 }
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
        { isOn && !isInAwayMode && (
          <TemperatureButtons
            targetTemperatureF={ targetTemperatureF }
            temperatureFormat={ temperatureFormat }
            disabled={ isUpdating }
            onStep={ stepTargetTemperature }
          />
        ) }
      </div>
    </div>
  );
};
