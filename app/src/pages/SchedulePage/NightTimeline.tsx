/* eslint-disable react/no-multi-comp */
import { Box, Button, IconButton, Paper, Switch, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import TuneIcon from '@mui/icons-material/Tune';
import moment from 'moment-timezone';
import { PropsWithChildren, useState } from 'react';
import { DailySchedule, LATE_ALARM_WINDOW_HOURS, MAX_ALARM_SECONDS, Time } from '@api/schedulesSchema.ts';
import { useAppStore } from '@state/appStore.tsx';
import InfoTip from '@components/InfoTip.tsx';
import { useScheduleStore } from './scheduleStore.tsx';
import { TemperatureSelect, TimeField } from './ScheduleFields.tsx';
import AlarmOptionsDialog from './AlarmOptionsDialog.tsx';
import { OFF_AFTER_ALARM_MINUTES, offTimeAfterAlarm } from '@api/automaticOffTime.ts';
import { getTemperatureColor } from '@lib/temperatureConversions.ts';
import { isPowerScheduleDurationValid } from './scheduleValidation.ts';

const MINUTES_PER_HOUR = 60;
const NEW_CHANGE_TEMPERATURE_F = 70;
// Wide enough for the longest label ("Bed off") so every row's controls start at the same place
const ROW_LABEL_WIDTH_PX = 46;
// The line down the left of the night, and the dots on it
const RAIL_GUTTER_PX = 14;
const MAIN_DOT_PX = 14;
const CHANGE_DOT_PX = 9;
const ALARM_COLOR = '#db5858';

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
      <Box sx={ { display: 'flex', alignItems: 'center', gap: 1, minHeight: 40 } }>
        <Typography variant="body2" sx={ { width: ROW_LABEL_WIDTH_PX, flexShrink: 0, color: 'text.secondary', whiteSpace: 'nowrap' } }>
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

// Upstream's alarms ran for seconds. One saved that short has never been set up in this app.
const SET_UP_ALARM_SECONDS = 600;


// Minutes from bedtime to a time later that night (past midnight counts as later)
const minutesAfterBedtime = (time: Time, bedtime: Time) => {
  const difference = moment(time, 'HH:mm').diff(moment(bedtime, 'HH:mm'), 'minutes');
  return difference < 0 ? difference + 24 * 60 : difference;
};

// True when a time falls between bedtime and the time the bed turns off
const isDuringNight = (time: Time, { power }: DailySchedule) => {
  return minutesAfterBedtime(time, power.on) <= minutesAfterBedtime(power.off, power.on);
};

// How long after the bed's off time the alarm is. Zero or less: at or before it.
const minutesAlarmIsAfterOff = ({ alarm, power }: DailySchedule) => (
  minutesAfterBedtime(alarm.time, power.on) - minutesAfterBedtime(power.off, power.on)
);

// An alarm may be later than the off time: the bed then stays on until it has gone off. Much
// later than that and it would belong to another night.
const isAlarmTimeAllowed = (schedule: DailySchedule) => (
  minutesAlarmIsAfterOff(schedule) <= LATE_ALARM_WINDOW_HOURS * MINUTES_PER_HOUR
);

// One night, top to bottom in the order it happens: bedtime, temperature changes, the alarm,
// and when the bed turns off. One line each, joined by a line down the left whose dots take the
// colour of each temperature. With an alarm the off time is not chosen: it follows the alarm.
export default function NightTimeline() {
  const { isUpdating } = useAppStore();
  const { selectedSchedule, updateSelectedSchedule, updateSelectedTemperatures, setValidations } = useScheduleStore();
  const [areAlarmOptionsOpen, setAreAlarmOptionsOpen] = useState(false);
  if (!selectedSchedule) return null;

  const { power, alarm, temperatures } = selectedSchedule;
  const disabled = isUpdating || !power.enabled;
  const changes = Object.entries(temperatures)
    .sort(([timeA], [timeB]) => minutesAfterBedtime(timeA, power.on) - minutesAfterBedtime(timeB, power.on));
  const isAlarmTimeValid = isAlarmTimeAllowed(selectedSchedule);

  const replaceChange = (oldTime: Time, newTime: Time, temperatureF: number) => {
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

  // A new change goes an hour after the last one (or after bedtime), if that time is free
  const addChange = () => {
    const lastTime = changes.length > 0 ? changes[changes.length - 1][0] : power.on;
    const nextTime = moment(lastTime, 'HH:mm').add(1, 'hour').format('HH:mm');
    if (nextTime in temperatures) return;
    updateSelectedTemperatures({ ...temperatures, [nextTime]: NEW_CHANGE_TEMPERATURE_F });
  };

  // Applies a change to the alarm. While the alarm is on, the off time follows it; without an
  // alarm the off time is whatever is chosen.
  const updateAlarmAndOffTime = (alarmChanges: Partial<DailySchedule['alarm']>, chosenOff: Time = power.off) => {
    const nextAlarm = { ...alarm, ...alarmChanges };
    const off = nextAlarm.enabled ? offTimeAfterAlarm(nextAlarm.time) : chosenOff;
    const nextSchedule = { ...selectedSchedule, alarm: nextAlarm, power: { ...power, off } };
    setValidations({ alarmTimeIsValid: !nextAlarm.enabled || isAlarmTimeAllowed(nextSchedule) });
    updateSelectedSchedule({ alarm: alarmChanges, power: { off } });
  };

  // Switching the alarm on gives it sensible settings if it has never been set up: a ramp-up
  // that keeps going until dismissed
  const setAlarmEnabled = (enabled: boolean) => {
    const needsDefaults = enabled && alarm.duration < SET_UP_ALARM_SECONDS;
    updateAlarmAndOffTime(needsDefaults ? { enabled, duration: MAX_ALARM_SECONDS, vibrationPattern: 'rise' } : { enabled });
  };

  const lateAlarmError = `Too long after the bed turns off (over ${LATE_ALARM_WINDOW_HOURS} hours)`;
  const automaticOffInfo = `${OFF_AFTER_ALARM_MINUTES} minutes after the alarm. A one-time alarm moves it: `
    + `${OFF_AFTER_ALARM_MINUTES} minutes after that alarm goes off.`;

  return (
    <Paper sx={ { p: { xs: 1.5, sm: 2.5 }, width: '100%' } }>
      <Box
        sx={ {
          display: 'flex', flexDirection: 'column', gap: 0.75,
          // The line the dots sit on
          ml: 0.75, pl: `${RAIL_GUTTER_PX}px`, borderLeft: '2px solid', borderColor: 'divider',
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
            key={ time }
            label={ changeIndex === 0 ? 'Then' : undefined }
            dotColor={ getTemperatureColor(temperatureF) }
            error={ isDuringNight(time, selectedSchedule) ? undefined : 'Outside this night' }
          >
            <TimeField
              label="Change time"
              value={ time }
              onChange={ (newTime) => replaceChange(time, newTime, temperatureF) }
              disabled={ disabled }
              error={ !isDuringNight(time, selectedSchedule) }
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
              sx={ { p: 0.25 } }
            >
              <CloseIcon fontSize="small"/>
            </IconButton>
          </NightRow>
        )) }

        <NightRow>
          <Button size="small" startIcon={ <AddIcon/> } onClick={ addChange } disabled={ disabled } sx={ { ml: -0.5 } }>
            Add a change
          </Button>
        </NightRow>

        <NightRow label="Alarm" dotColor={ ALARM_COLOR } isMainEvent error={ alarm.enabled && !isAlarmTimeValid ? lateAlarmError : undefined }>
          { alarm.enabled && (
            <>
              <TimeField
                label="Alarm time"
                value={ alarm.time }
                onChange={ (time) => updateAlarmAndOffTime({ time }) }
                disabled={ disabled }
                error={ !isAlarmTimeValid }
              />
              <IconButton onClick={ () => setAreAlarmOptionsOpen(true) } disabled={ disabled } aria-label="Alarm options">
                <TuneIcon fontSize="small"/>
              </IconButton>
            </>
          ) }
          <Switch
            checked={ alarm.enabled }
            onChange={ (event) => setAlarmEnabled(event.target.checked) }
            disabled={ disabled }
            sx={ { ml: 'auto' } }
            slotProps={ { input: { 'aria-label': 'Alarm' } } }
          />
        </NightRow>

        <NightRow
          label="Bed off"
          dotColor="text.disabled"
          isMainEvent
          info={ alarm.enabled ? automaticOffInfo : undefined }
          error={ isPowerScheduleDurationValid(power.on, power.off) ? undefined : 'Must differ from bedtime' }
        >
          { /* With an alarm the off time follows it, so it is shown, not chosen */ }
          { alarm.enabled
            ? <Typography variant="body2">{ formatClockTime(power.off) }</Typography>
            : (
              <TimeField
                label="Bed turns off"
                value={ power.off }
                onChange={ (off) => updateAlarmAndOffTime({}, off) }
                disabled={ disabled }
                error={ !isPowerScheduleDurationValid(power.on, power.off) }
              />
            ) }
        </NightRow>
      </Box>
      <AlarmOptionsDialog open={ areAlarmOptionsOpen } onClose={ () => setAreAlarmOptionsOpen(false) }/>
    </Paper>
  );
}
