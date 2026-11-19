/* eslint-disable react/no-multi-comp */
import { Box, Button, IconButton, Paper, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import AlarmIcon from '@mui/icons-material/Alarm';
import AlarmOffIcon from '@mui/icons-material/AlarmOff';
import moment from 'moment-timezone';
import { PropsWithChildren, useState } from 'react';
import { DailySchedule, Time } from '@api/schedulesSchema.ts';
import { useAppStore } from '@state/appStore.tsx';
import InfoTip from '@components/InfoTip.tsx';
import { useScheduleStore } from './scheduleStore.tsx';
import { NARROW_PHONE_QUERY, TemperatureSelect, TimeField } from './ScheduleFields.tsx';
import AlarmOptionsDialog from './AlarmOptionsDialog.tsx';
import { OFF_AFTER_ALARM_MINUTES, offTimeAfterAlarm } from '@api/automaticOffTime.ts';
import { getTemperatureColor } from '@lib/temperatureConversions.ts';
import { findChangeProblem, findNewChangeTime, isNightLengthValid, minutesBetween } from './scheduleValidation.ts';

const NEW_CHANGE_TEMPERATURE_F = 70;
// Wide enough for the longest label ("Bed on") so every row's controls start at the same place
const ROW_LABEL_WIDTH_PX = 52;
// The line down the left of the night, and the dots on it
const RAIL_GUTTER_PX = 12;
// Buttons inside a row are smaller than the app's usual 44 px so a row fits a narrow phone
const ROW_BUTTON_PX = 32;
const MAIN_DOT_PX = 14;
const CHANGE_DOT_PX = 9;

const rowButtonSx = { p: 0.25, minWidth: ROW_BUTTON_PX, minHeight: ROW_BUTTON_PX };

const formatClockTime = (time: Time) => moment(time, 'HH:mm').format('h:mm A');

type NightRowProps = PropsWithChildren<{
  // What the row is, e.g. "Bed on". Left empty for the temperature changes after the first
  label?: string;
  // Detail worth having but not worth a line of its own; shown from an "i" beside the controls
  info?: string;
  // Something wrong with this row, shown under it
  error?: string;
  // The colour of this row's dot on the line down the left. No dot when left out.
  dotColor?: string;
  // The night's main events (bed on, alarm, bed off) get a larger, hollow dot
  isMainEvent?: boolean;
}>;

// One line of the night: a dot on the line down the left, what it is, and its controls beside
// it. Kept to a single line so the whole night fits on a phone screen.
const NightRow = ({ label, info, error, dotColor, isMainEvent, children }: NightRowProps) => {
  const dotSize = isMainEvent ? MAIN_DOT_PX : CHANGE_DOT_PX;
  return (
    <Box sx={ { position: 'relative' } }>
      { dotColor && (
        <Box
          aria-hidden
          sx={ {
            // Centred on the line, which runs down the middle of the gutter's left edge
            position: 'absolute', left: -RAIL_GUTTER_PX - dotSize / 2 + 1, top: 20 - dotSize / 2,
            width: dotSize, height: dotSize, borderRadius: '50%',
            bgcolor: isMainEvent ? 'background.paper' : dotColor, border: isMainEvent ? '2px solid' : 'none', borderColor: dotColor,
          } }
        />
      ) }
      <Box sx={ { display: 'flex', alignItems: 'center', gap: 0.75, minHeight: 40 } }>
        <Typography
          variant="body2"
          sx={ { width: ROW_LABEL_WIDTH_PX, flexShrink: 0, color: 'text.secondary', whiteSpace: 'nowrap', [NARROW_PHONE_QUERY]: { width: 44 } } }
        >
          { label }
        </Typography>
        <Box sx={ { display: 'flex', alignItems: 'center', gap: 0.75, flex: 1, minWidth: 0 } }>
          { children }
          { info && <InfoTip text={ info }/> }
        </Box>
      </Box>
      { error && (
        <Typography variant="caption" color="error" sx={ { display: 'block', ml: `${ROW_LABEL_WIDTH_PX + 8}px` } }>{ error }</Typography>
      ) }
    </Box>
  );
};


// One night, top to bottom in the order it happens: bedtime, temperature changes and wake-up.
// One line each, joined by a line down the left whose dots take the colour of each temperature.
// There is no off time to choose: the bed turns off OFF_AFTER_ALARM_MINUTES after wake-up. The
// wake-up time is the alarm's time; the button beside it says whether the
// alarm vibrates and opens everything else about it.
type NightTimelineProps = {
  // Saves the night being edited
  onSave: () => Promise<void>;
};

export default function NightTimeline({ onSave }: NightTimelineProps) {
  const { isUpdating } = useAppStore();
  const { selectedSchedule, updateSelectedSchedule, updateSelectedTemperatures } = useScheduleStore();
  const [areAlarmOptionsOpen, setAreAlarmOptionsOpen] = useState(false);
  if (!selectedSchedule) return null;

  const { power, alarm, temperatures } = selectedSchedule;
  const disabled = isUpdating || !power.enabled;
  const changes = Object.entries(temperatures)
    .sort(([timeA], [timeB]) => minutesBetween(power.on, timeA) - minutesBetween(power.on, timeB));

  const replaceChange = (oldTime: Time, newTime: Time, temperatureF: number) => {
    // Two changes cannot share a time; moving one onto another would silently delete it
    if (newTime !== oldTime && newTime in temperatures) return;
    const nextTemperatures = { ...temperatures };
    delete nextTemperatures[oldTime];
    nextTemperatures[newTime] = temperatureF;
    updateSelectedTemperatures(nextTemperatures);
  };

  const removeChange = (time: Time) => {
    const nextTemperatures = { ...temperatures };
    delete nextTemperatures[time];
    updateSelectedTemperatures(nextTemperatures);
  };

  // Where a new change would go, if the night has room for one
  const lastChangeTime = changes.length > 0 ? changes[changes.length - 1][0] : power.on;
  const newChangeTime = findNewChangeTime(lastChangeTime, power.on, alarm.time, Object.keys(temperatures));
  const addChange = () => {
    if (newChangeTime) updateSelectedTemperatures({ ...temperatures, [newChangeTime]: NEW_CHANGE_TEMPERATURE_F });
  };

  // Applies a change to the wake-up time or the alarm; the off time always follows the wake-up time
  const updateWakeUp = (alarmChanges: Partial<DailySchedule['alarm']>) => {
    const nextAlarm = { ...alarm, ...alarmChanges };
    updateSelectedSchedule({ alarm: alarmChanges, power: { off: offTimeAfterAlarm(nextAlarm.time) } });
  };

  const isNightValid = isNightLengthValid(power.on, alarm.time);

  // What to tell the user about a change whose time cannot be saved. The usual cause is the
  // wake time: the bed turns off soon after it, so a later change would never run.
  const describeChangeProblem = (time: Time) => {
    const problem = findChangeProblem(time, power.on, alarm.time);
    if (problem === undefined) return undefined;
    if (problem === 'notAfterBedOn') return 'Must be after Bed on';
    const wakeMoment = moment(alarm.time, 'HH:mm', true);
    // While the wake time is being typed, its own row carries the error
    if (!wakeMoment.isValid()) return 'Must be earlier than the wake time';
    return `Must be earlier than the ${wakeMoment.format('h:mm A')} wake time`;
  };

  return (
    <Paper sx={ { p: { xs: 1.5, sm: 2.5 }, width: '100%', borderRadius: '16px' } }>
      <Box
        sx={ {
          display: 'flex', flexDirection: 'column', gap: 0.75,
          // The line the dots sit on
          ml: 0.5, pl: `${RAIL_GUTTER_PX}px`, borderLeft: '2px solid', borderColor: 'divider',
        } }
      >
        <NightRow label="Bed on" dotColor={ getTemperatureColor(power.onTemperature) } isMainEvent>
          <TimeField label="Bedtime" value={ power.on } onChange={ (on) => updateSelectedSchedule({ power: { on } }) } disabled={ disabled }/>
          <TemperatureSelect
            label="Bedtime temperature"
            value={ power.onTemperature }
            onChange={ (onTemperature) => updateSelectedSchedule({ power: { onTemperature } }) }
            disabled={ disabled }
          />
        </NightRow>

        { changes.map(([time, temperatureF], changeIndex) => (
          <NightRow
            // Keyed by position, so a row keeps focus while its time is typed
            key={ changeIndex }
            label={ changeIndex === 0 ? 'Then' : undefined }
            dotColor={ getTemperatureColor(temperatureF) }
            error={ describeChangeProblem(time) }
          >
            <TimeField
              label="Change time"
              value={ time }
              onChange={ (newTime) => replaceChange(time, newTime, temperatureF) }
              disabled={ disabled }
              error={ describeChangeProblem(time) !== undefined }
            />
            <TemperatureSelect
              label="Change temperature"
              value={ temperatureF }
              onChange={ (newTemperatureF) => replaceChange(time, time, newTemperatureF) }
              disabled={ disabled }
            />
            <IconButton
              size="small"
              onClick={ () => removeChange(time) }
              disabled={ disabled }
              aria-label="Remove this change"
              sx={ { ...rowButtonSx, color: 'text.secondary' } }
            >
              <CloseIcon sx={ { fontSize: 18 } }/>
            </IconButton>
          </NightRow>
        )) }

        <NightRow>
          <Button
            size="small"
            color="inherit"
            startIcon={ <AddIcon/> }
            onClick={ addChange }
            disabled={ disabled || !newChangeTime }
            sx={ { ml: -0.5, color: 'text.secondary' } }
          >
            Add a change
          </Button>
        </NightRow>

        <NightRow
          label="Wake"
          dotColor={ alarm.enabled ? 'warning.main' : 'text.disabled' }
          isMainEvent
          error={ isNightValid ? undefined : '1 to 23 hours after Bed on' }
        >
          <TimeField
            label="Wake-up time"
            value={ alarm.time }
            onChange={ (time) => updateWakeUp({ time }) }
            disabled={ disabled }
            error={ !isNightValid }
          />
          <Button
            size="small"
            variant="outlined"
            onClick={ () => setAreAlarmOptionsOpen(true) }
            disabled={ disabled }
            aria-label="Alarm options"
            startIcon={ alarm.enabled ? <AlarmIcon sx={ { color: 'warning.main' } }/> : <AlarmOffIcon/> }
            sx={ { whiteSpace: 'nowrap', color: alarm.enabled ? 'text.primary' : 'text.secondary' } }
          >
            { alarm.enabled ? 'Alarm on' : 'Alarm off' }
          </Button>
          <InfoTip text={ `The bed turns off at ${formatClockTime(power.off)}, ${OFF_AFTER_ALARM_MINUTES} minutes after this.` }/>
        </NightRow>
      </Box>
      <AlarmOptionsDialog open={ areAlarmOptionsOpen } onClose={ () => setAreAlarmOptionsOpen(false) } onSave={ onSave }/>
    </Paper>
  );
}
