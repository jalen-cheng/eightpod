import { Box, Tab, Tabs, Typography } from '@mui/material';
import { useAppStore } from '@state/appStore.tsx';
import { LOWERCASE_DAYS } from './days.ts';
import { useScheduleStore } from './scheduleStore.tsx';
import { SHORT_DAY_NAMES, WEEK_ORDER } from './scheduleDays.ts';

// The week as a row of tabs, one per day. Opening a day shows that night's schedule; which days
// an edit is saved to is chosen when saving.
export default function DayPicker() {
  const { isUpdating } = useAppStore();
  const { selectedDayIndex, selectDay, hasEdits } = useScheduleStore();

  return (
    <Box sx={ { width: '100%' } }>
      <Tabs
        value={ selectedDayIndex }
        onChange={ (_event, dayIndex: number) => selectDay(dayIndex) }
        variant="fullWidth"
        aria-label="Day of the week"
        sx={ { borderBottom: 1, borderColor: 'divider', minHeight: 40 } }
      >
        { /* Shown Monday first; a day's index is still its place in the Sunday-first list the store uses */ }
        { WEEK_ORDER.map((day) => {
          const dayIndex = LOWERCASE_DAYS.indexOf(day);
          return (
            <Tab
              key={ day }
              value={ dayIndex }
              label={ SHORT_DAY_NAMES[day] }
              // Opening another day would throw away what is on screen, so it waits for Save or Discard
              disabled={ isUpdating || (hasEdits && dayIndex !== selectedDayIndex) }
              sx={ { minWidth: 0, minHeight: 40, px: 0, letterSpacing: '0.08em' } }
            />
          );
        }) }
      </Tabs>
      { hasEdits && (
        <Typography variant="caption" sx={ { color: 'text.secondary', display: 'block', mt: 0.5 } }>
          Save or discard your changes to open another day.
        </Typography>
      ) }
    </Box>
  );
}
