/* eslint-disable react/no-multi-comp */
import { Box, Button, IconButton, MenuItem, Paper, Switch, TextField, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import TuneIcon from '@mui/icons-material/Tune';
import _ from 'lodash';
import moment from 'moment-timezone';
import { PropsWithChildren, ReactNode, useState } from 'react';
import { DailySchedule, LATE_ALARM_WINDOW_HOURS, MAX_ALARM_SECONDS, Time } from '@api/schedulesSchema.ts';
import { useAppStore } from '@state/appStore.tsx';
import { describeTemperature } from '@lib/temperatureConversions.ts';
import { useTemperatureFormat } from '@lib/useTemperatureFormat.ts';
import { useScheduleStore } from './scheduleStore.tsx';
import { TemperatureSelect, TimeField } from './ScheduleFields.tsx';
import AlarmOptionsDialog, { PATTERN_NAMES } from './AlarmOptionsDialog.tsx';
import { isPowerScheduleDurationValid } from './scheduleValidation.ts';

const COOL_COLOR = '#2196f3';
const WARM_COLOR = '#db5858';
const MINUTES_PER_HOUR = 60;
const NEW_CHANGE_TEMPERATURE_F = 70;
// When the bed turns off with the alarm, this is how long after the alarm time it turns off
// anyway if the alarm is never dismissed. Longer than the longest alarm.
const OFF_AFTER_ALARM_MINUTES = 60;

const addMinutes = (time: Time, minutes: number): Time => moment(time, 'HH:mm').add(minutes, 'minutes').format('HH:mm');
const formatClockTime = (time: Time) => moment(time, 'HH:mm').format('h:mm A');

type TimelineRowProps = PropsWithChildren<{
  title: string;
  // One line, or several shown one under another
  subtitle?: string | string[];
  // The dot's colour; the night's main events get a larger, hollow dot
  color: string;
  isMainEvent?: boolean;
  // Shown at the end of the title line, e.g. an on/off switch
  headerAction?: ReactNode;
}>;

// One event of the night: a dot on the line, what it is, and its controls underneath.
// Stacked rather than side by side so the label never has to wrap on a phone.
const TimelineRow = ({ title, subtitle, color, isMainEvent, headerAction, children }: TimelineRowProps) => {
  const dotSize = isMainEvent ? 16 : 10;
  const subtitleLines = _.castArray(subtitle ?? []);
  return (
    <Box sx={ { position: 'relative', display: 'flex', flexDirection: 'column', gap: 0.75 } }>
      <Box
        sx={ {
          position: 'absolute', left: -25 - dotSize / 2, top: 4, width: dotSize, height: dotSize, borderRadius: '50%',
          bgcolor: isMainEvent ? 'background.paper' : color, border: isMainEvent ? `2px solid ${color}` : 'none',
        } }
      />
      <Box sx={ { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, minHeight: 24 } }>
        <Typography variant="body2" sx={ { fontWeight: isMainEvent ? 500 : 400, color: isMainEvent ? 'text.primary' : 'text.secondary' } }>
          { title }
        </Typography>
        { headerAction }
      </Box>
      { /* Under the title line and full width, so a switch beside the title never squeezes the text */ }
      { subtitleLines.length > 0 && (
        <Box sx={ { mt: -0.5 } }>
          { subtitleLines.map(line => (
            <Typography key={ line } variant="caption" sx={ { color: 'text.secondary', display: 'block' } }>{ line }</Typography>
          )) }
        </Box>
      ) }
      { children && <Box sx={ { display: 'flex', alignItems: 'center', gap: 0.75 } }>{ children }</Box> }
    </Box>
  );
};

// Upstream's alarms ran for seconds. One saved that short has never been set up in this app.
const SET_UP_ALARM_SECONDS = 600;
const SECONDS_PER_MINUTE = 60;

// "45 s" for a short alarm, "10 min" otherwise
const formatAlarmLength = (seconds: number) => (
  seconds < SECONDS_PER_MINUTE ? `${seconds} s` : `${Math.round(seconds / SECONDS_PER_MINUTE)} min`
);

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

// One night, top to bottom in the order it happens: bedtime, temperature changes, the alarm
// (with its warm-up), and when the bed turns off.
export default function NightTimeline() {
  const { isUpdating } = useAppStore();
  const { selectedSchedule, updateSelectedSchedule, updateSelectedTemperatures, setValidations } = useScheduleStore();
  const temperatureFormat = useTemperatureFormat();
  const [areAlarmOptionsOpen, setAreAlarmOptionsOpen] = useState(false);
  if (!selectedSchedule) return null;

  const { power, alarm, temperatures } = selectedSchedule;
  const disabled = isUpdating || !power.enabled;
  const changes = Object.entries(temperatures)
    .sort(([timeA], [timeB]) => minutesAfterBedtime(timeA, power.on) - minutesAfterBedtime(timeB, power.on));
  const isAlarmTimeValid = isAlarmTimeAllowed(selectedSchedule);
  const isAlarmAfterOff = alarm.enabled && isAlarmTimeValid && minutesAlarmIsAfterOff(selectedSchedule) > 0;
  const preWarmMinutes = alarm.preWarmMinutes ?? 0;
  // With an alarm, the bed can turn off when it is dismissed, so no off time needs choosing
  const turnsOffWithAlarm = alarm.enabled && (alarm.turnOffAfterDismiss ?? false);

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

  // Applies a change to the alarm and/or the off time, and rechecks that the alarm is in the night
  const updateAlarmAndOffTime = (alarmChanges: Partial<DailySchedule['alarm']>, off: Time = power.off) => {
    const nextAlarm = { ...alarm, ...alarmChanges };
    const nextSchedule = { ...selectedSchedule, alarm: nextAlarm, power: { ...power, off } };
    setValidations({ alarmTimeIsValid: !nextAlarm.enabled || isAlarmTimeAllowed(nextSchedule) });
    updateSelectedSchedule({ alarm: alarmChanges, power: { off } });
  };

  // The off time follows the alarm while the bed turns off with it
  const setAlarmTime = (time: Time) => {
    updateAlarmAndOffTime({ time }, turnsOffWithAlarm ? addMinutes(time, OFF_AFTER_ALARM_MINUTES) : power.off);
  };

  // Switching the alarm on gives it sensible settings if it has never been set up: a ramp-up
  // that keeps going until dismissed, after which the bed turns off
  const setAlarmEnabled = (enabled: boolean) => {
    const needsDefaults = enabled && alarm.duration < SET_UP_ALARM_SECONDS;
    if (!needsDefaults) return updateAlarmAndOffTime({ enabled });
    updateAlarmAndOffTime(
      { enabled, duration: MAX_ALARM_SECONDS, vibrationPattern: 'rise', turnOffAfterDismiss: true },
      addMinutes(alarm.time, OFF_AFTER_ALARM_MINUTES),
    );
  };

  const setTurnsOffWithAlarm = (turnOffAfterDismiss: boolean) => {
    updateAlarmAndOffTime(
      { turnOffAfterDismiss },
      turnOffAfterDismiss ? addMinutes(alarm.time, OFF_AFTER_ALARM_MINUTES) : power.off,
    );
  };

  // One fact per line: how it vibrates, the warm-up before it, and whether the bed waits for it
  const warmUpStart = formatClockTime(addMinutes(alarm.time, -preWarmMinutes));
  const alarmSummary = _.compact([
    `${PATTERN_NAMES[alarm.vibrationPattern]} for up to ${formatAlarmLength(alarm.duration)}, until dismissed`,
    preWarmMinutes > 0 && `Bed warms to ${describeTemperature(alarm.alarmTemperature, temperatureFormat)} from ${warmUpStart}`,
    isAlarmAfterOff && 'Bed stays on until it has gone off',
  ]);

  const lateAlarmError = `Too long after the bed turns off (over ${LATE_ALARM_WINDOW_HOURS} hours)`;
  const alarmSubtitle = !alarm.enabled ? 'Off' : isAlarmTimeValid ? alarmSummary : lateAlarmError;

  const offSubtitle = !isPowerScheduleDurationValid(power.on, power.off)
    ? 'Must differ from bedtime'
    : turnsOffWithAlarm ? `Or at ${formatClockTime(power.off)} if it is never dismissed`
      : isAlarmAfterOff ? 'Stays on until the alarm has gone off' : undefined;

  return (
    <Paper sx={ { p: { xs: 2, sm: 2.5 }, width: '100%' } }>
      <Box sx={ { borderLeft: '2px solid', borderColor: 'divider', ml: 1, pl: 3, display: 'flex', flexDirection: 'column', gap: 1.5 } }>
        <TimelineRow title="Bedtime" subtitle="Bed turns on" color={ COOL_COLOR } isMainEvent>
          <TimeField label="Bedtime" value={ power.on } onChange={ (on) => updateSelectedSchedule({ power: { on } }) } disabled={ disabled }/>
          <TemperatureSelect
            label="Bedtime temperature"
            value={ power.onTemperature }
            onChange={ (onTemperature) => updateSelectedSchedule({ power: { onTemperature } }) }
            disabled={ disabled }
          />
        </TimelineRow>

        { changes.map(([time, temperatureF]) => (
          <TimelineRow
            key={ time }
            title="Then change to"
            subtitle={ isDuringNight(time, selectedSchedule) ? undefined : 'Outside this night' }
            color={ COOL_COLOR }
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
            <IconButton size="small" onClick={ () => removeChange(time) } disabled={ disabled } aria-label="Remove this change">
              <CloseIcon fontSize="small"/>
            </IconButton>
          </TimelineRow>
        )) }

        <Box>
          <Button size="small" startIcon={ <AddIcon/> } onClick={ addChange } disabled={ disabled }>
            Add a temperature change
          </Button>
        </Box>

        <TimelineRow
          title="Alarm"
          subtitle={ alarmSubtitle }
          color={ WARM_COLOR }
          isMainEvent
          headerAction={
            <Switch
              checked={ alarm.enabled }
              onChange={ (event) => setAlarmEnabled(event.target.checked) }
              disabled={ disabled }
              slotProps={ { input: { 'aria-label': 'Alarm' } } }
            />
          }
        >
          { alarm.enabled && (
            <>
              <TimeField label="Alarm time" value={ alarm.time } onChange={ setAlarmTime } disabled={ disabled } error={ !isAlarmTimeValid }/>
              <Button
                size="small"
                variant="outlined"
                startIcon={ <TuneIcon fontSize="small"/> }
                onClick={ () => setAreAlarmOptionsOpen(true) }
                disabled={ disabled }
              >
                Options
              </Button>
            </>
          ) }
        </TimelineRow>

        <TimelineRow title="Bed turns off" subtitle={ offSubtitle } color="text.disabled">
          { alarm.enabled && (
            <TextField
              select
              size="small"
              value={ turnsOffWithAlarm ? 'alarm' : 'time' }
              onChange={ (event) => setTurnsOffWithAlarm(event.target.value === 'alarm') }
              disabled={ disabled }
              sx={ { minWidth: 0, flexShrink: 0 } }
              slotProps={ {
                htmlInput: { 'aria-label': 'When the bed turns off' },
                // Shown short next to the time field, which says the rest
                select: { renderValue: (value) => (value === 'alarm' ? 'When the alarm is dismissed' : 'At') },
              } }
            >
              <MenuItem value="alarm">When the alarm is dismissed</MenuItem>
              <MenuItem value="time">At a set time</MenuItem>
            </TextField>
          ) }
          { !turnsOffWithAlarm && (
            <TimeField
              label="Bed turns off"
              value={ power.off }
              onChange={ (off) => updateAlarmAndOffTime({}, off) }
              disabled={ disabled }
              error={ !isPowerScheduleDurationValid(power.on, power.off) }
            />
          ) }
        </TimelineRow>
      </Box>
      <AlarmOptionsDialog open={ areAlarmOptionsOpen } onClose={ () => setAreAlarmOptionsOpen(false) }/>
    </Paper>
  );
}
