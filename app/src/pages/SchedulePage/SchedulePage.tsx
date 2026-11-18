import { useEffect, useRef, useState } from 'react';
import { Box, Button, IconButton, Switch, Tooltip, Typography } from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
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
import { DAY_NAMES } from './scheduleDays.ts';
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

  // Tonight is opened once. Later reloads (after a save, or a change made elsewhere) keep the
  // day that is open, and keep edits that have not been saved.
  const hasOpenedTonight = useRef(false);
  useEffect(() => {
    if (!schedules) return;
    setOriginalSchedules(schedules);
    if (!hasOpenedTonight.current) {
      hasOpenedTonight.current = true;
      selectDay(LOWERCASE_DAYS.indexOf(getAdjustedDayOfWeek()));
      return;
    }
    checkForChanges();
    if (!useScheduleStore.getState().hasEdits) reloadScheduleData();
  }, [schedules]);

  useEffect(() => {
    reloadScheduleData();
  }, [side]);

  // Linking or unlinking changes whether the other side's schedule counts as unsaved
  useEffect(() => {
    checkForChanges();
  }, [linkSides]);

  const [isChoosingDays, setIsChoosingDays] = useState(false);
  const isScheduleOn = selectedSchedule?.power.enabled || false;

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
    <PageContainer>
      <PageHeader title="Schedules"/>
      { /* Like the day tabs, the side waits for Save or Discard: switching would drop the edits */ }
      <SideControl disabled={ hasEdits }/>
      <DayPicker/>

      { /* The night being edited, and whether its schedule runs at all */ }
      <Box sx={ { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, width: '100%' } }>
        <Typography component="h2" variant="body1" sx={ { fontWeight: 500, mr: 'auto' } }>{ DAY_NAMES[selectedDay] } night</Typography>
        { /* Copying is for a saved night, so it waits while there are unsaved changes */ }
        <Tooltip title="Copy this night to other days" describeChild>
          <span>
            <IconButton
              aria-label="Copy this night to other days"
              onClick={ () => setIsChoosingDays(true) }
              disabled={ isUpdating || changesPresent || !isValid() }
            >
              <ContentCopyIcon fontSize="small"/>
            </IconButton>
          </span>
        </Tooltip>
        <Switch
          checked={ isScheduleOn }
          onChange={ (event) => updateSelectedSchedule({ power: { enabled: event.target.checked } }) }
          disabled={ isUpdating }
          slotProps={ { input: { 'aria-label': `Schedule for ${DAY_NAMES[selectedDay]} night` } } }
        />
      </Box>

      <ErrorBoundary componentName="Scheduling chart">
        <TemperatureScheduleChart/>
      </ErrorBoundary>

      <NightTimeline onSave={ () => handleSave([selectedDay]) }/>

      { /* Unsaved changes: Discard and Save directly under the night they belong to, in the flow
           of the page. Other days are reached by saving, then copying the night. */ }
      { changesPresent && (
        <Box role="region" aria-label="Unsaved changes" sx={ { display: 'flex', alignItems: 'center', gap: 1, width: '100%' } }>
          <Typography variant="body2" sx={ { color: 'text.secondary', mr: 'auto' } }>Unsaved changes</Typography>
          { hasEdits && <Button color="inherit" onClick={ reloadScheduleData } disabled={ isUpdating }>Discard</Button> }
          <Button
            variant="contained"
            onClick={ () => handleSave([selectedDay]) }
            disabled={ isUpdating || !isValid() }
            sx={ { minWidth: 96 } }
          >
            Save
          </Button>
        </Box>
      ) }

      <SaveDaysDialog open={ isChoosingDays } openDay={ selectedDay } onClose={ () => setIsChoosingDays(false) } onSave={ handleSave }/>
    </PageContainer>
  );
}
