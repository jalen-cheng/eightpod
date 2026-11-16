import { useEffect } from 'react';
import { Box, Button, FormControlLabel, Switch, Typography } from '@mui/material';
import { DeepPartial } from 'ts-essentials';
import moment from 'moment-timezone';

import DayPicker from './DayPicker.tsx';
import NightTimeline from './NightTimeline.tsx';
import OneTimeAlarm from './OneTimeAlarm.tsx';
import PageContainer from '../PageContainer.tsx';
import SideControl from '../../components/SideControl.tsx';
import { DayOfWeek, Schedules } from '@api/schedulesSchema.ts';
import { postSchedules } from '@api/schedules';
import { useAppStore } from '@state/appStore.tsx';
import { useSchedules } from '@api/schedules';
import { useScheduleStore } from './scheduleStore.tsx';
import { LOWERCASE_DAYS } from './days.ts';
import { describeDays } from './scheduleDays.ts';
import TemperatureScheduleChart from './ScheduleChart.tsx';
import ErrorBoundary from '@components/ErrorBoundary.tsx';
import PageHeader from '@components/PageHeader.tsx';
import { buildSidesPayload, getControlledSides } from '@lib/sides.ts';

// The Pod takes a moment to write a schedule before it can be read back
const SAVE_SETTLE_MS = 1_000;

// A night belongs to the day it starts on, so before noon "tonight's schedule" is yesterday's
const getAdjustedDayOfWeek = (): DayOfWeek => {
  const now = moment();
  const scheduleDay = now.hour() < 12 ? now.subtract(1, 'day') : now;
  return scheduleDay.format('dddd').toLocaleLowerCase() as DayOfWeek;
};

// The weekly schedule: pick the days, then edit one night as a sequence of events
export default function SchedulePage() {
  const { isUpdating, setIsUpdating, side, linkSides } = useAppStore();
  const { data: schedules, refetch } = useSchedules();
  const {
    selectedSchedule,
    setOriginalSchedules,
    reloadScheduleData,
    checkForChanges,
    selectDay,
    getSaveDays,
    changesPresent,
    hasEdits,
    isValid,
    updateSelectedSchedule,
  } = useScheduleStore();

  useEffect(() => {
    if (!schedules) return;
    setOriginalSchedules(schedules);
    selectDay(LOWERCASE_DAYS.indexOf(getAdjustedDayOfWeek()));
  }, [schedules]);

  useEffect(() => {
    reloadScheduleData();
  }, [side]);

  // Linking or unlinking changes whether the other side's schedule counts as unsaved
  useEffect(() => {
    checkForChanges();
  }, [linkSides]);

  const saveDays = getSaveDays();

  const handleSave = async () => {
    setIsUpdating(true);
    const daySchedules = Object.fromEntries(saveDays.map(day => [day, selectedSchedule]));
    const payload: DeepPartial<Schedules> = buildSidesPayload(getControlledSides(side, linkSides), daySchedules);

    await postSchedules(payload)
      .then(() => new Promise(resolve => setTimeout(resolve, SAVE_SETTLE_MS)))
      .then(() => refetch())
      .catch(error => console.error(error))
      .finally(() => setIsUpdating(false));
  };

  return (
    <PageContainer sx={ { width: '100%', mx: 'auto', maxWidth: 800 } }>
      <PageHeader title="Schedules"/>
      <SideControl linkedHint="Sides linked: saving applies this schedule to both."/>
      <DayPicker/>

      <ErrorBoundary componentName="Scheduling chart">
        <TemperatureScheduleChart/>
      </ErrorBoundary>

      <NightTimeline/>

      <Box sx={ { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, width: '100%', minHeight: 40 } }>
        <FormControlLabel
          sx={ { whiteSpace: 'nowrap' } }
          label="Schedule on"
          control={
            <Switch
              checked={ selectedSchedule?.power.enabled || false }
              onChange={ (event) => updateSelectedSchedule({ power: { enabled: event.target.checked } }) }
              disabled={ isUpdating }
            />
          }
        />
        { changesPresent ? (
          <Box sx={ { display: 'flex', gap: 1 } }>
            { hasEdits && <Button onClick={ reloadScheduleData } disabled={ isUpdating }>Discard</Button> }
            <Button variant="contained" onClick={ handleSave } disabled={ isUpdating || !isValid() } sx={ { whiteSpace: 'nowrap' } }>
              Save for { describeDays(saveDays) }{ linkSides ? ', both sides' : '' }
            </Button>
          </Box>
        ) : (
          <Typography variant="caption" sx={ { color: 'text.secondary' } }>Saved</Typography>
        ) }
      </Box>

      <OneTimeAlarm/>
    </PageContainer>
  );
}
