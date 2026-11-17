import { useEffect, useState } from 'react';
import { Box, Button, FormControlLabel, Switch } from '@mui/material';
import { DeepPartial } from 'ts-essentials';
import moment from 'moment-timezone';

import DayPicker from './DayPicker.tsx';
import SaveDaysDialog from './SaveDaysDialog.tsx';
import NightTimeline from './NightTimeline.tsx';
import PageContainer from '../PageContainer.tsx';
import SideControl from '../../components/SideControl.tsx';
import { DayOfWeek, Schedules } from '@api/schedulesSchema.ts';
import { postSchedules } from '@api/schedules';
import { useAppStore } from '@state/appStore.tsx';
import { useSchedules } from '@api/schedules';
import { useScheduleStore } from './scheduleStore.tsx';
import { LOWERCASE_DAYS } from './days.ts';
import { SHORT_DAY_NAMES } from './scheduleDays.ts';
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

// The weekly schedule: open a day, edit that night as a sequence of events, then save it for
// that day or for any set of days
export default function SchedulePage() {
  const { isUpdating, setIsUpdating, side, linkSides } = useAppStore();
  const { data: schedules, refetch } = useSchedules();
  const {
    selectedSchedule,
    setOriginalSchedules,
    reloadScheduleData,
    checkForChanges,
    selectDay,
    selectedDay,
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

  const [isChoosingDays, setIsChoosingDays] = useState(false);

  // Writes the schedule on screen to the given days, on both sides when they are linked
  const handleSave = async (saveDays: DayOfWeek[]) => {
    setIsChoosingDays(false);
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

      <Box sx={ { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, width: '100%', flexWrap: 'wrap' } }>
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
        { /* With nothing to save, the only thing left to do with this night is copy it elsewhere */ }
        { !changesPresent && (
          <Button size="small" onClick={ () => setIsChoosingDays(true) } disabled={ isUpdating || !isValid() } sx={ { whiteSpace: 'nowrap' } }>
            Copy to other days
          </Button>
        ) }
      </Box>

      { changesPresent && (
        <Box sx={ { display: 'flex', justifyContent: 'flex-end', gap: 1, width: '100%' } }>
          { hasEdits && <Button onClick={ reloadScheduleData } disabled={ isUpdating }>Discard</Button> }
          <Button
            variant="outlined"
            onClick={ () => setIsChoosingDays(true) }
            disabled={ isUpdating || !isValid() }
            sx={ { whiteSpace: 'nowrap' } }
          >
            Other days…
          </Button>
          <Button
            variant="contained"
            onClick={ () => handleSave([selectedDay]) }
            disabled={ isUpdating || !isValid() }
            sx={ { whiteSpace: 'nowrap' } }
          >
            Save for { SHORT_DAY_NAMES[selectedDay] }
          </Button>
        </Box>
      ) }

      <SaveDaysDialog open={ isChoosingDays } openDay={ selectedDay } onClose={ () => setIsChoosingDays(false) } onSave={ handleSave }/>
    </PageContainer>
  );
}
