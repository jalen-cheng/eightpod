import { Box, ButtonBase, Typography } from '@mui/material';
import { useAppStore } from '@state/appStore.tsx';
import { useScheduleStore } from './scheduleStore.tsx';
import { WEEK_ORDER } from './scheduleDays.ts';

const DAY_LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

// The row of days at the top of the schedule. Filled days are the ones the schedule on screen
// belongs to and a save writes to; the ringed one is the day that was opened.
export default function DayChips() {
  const { isUpdating } = useAppStore();
  const { selectedDay, selectedDays, changesPresent, tapDay } = useScheduleStore();

  return (
    <Box>
      <Typography variant="caption" sx={ { color: 'text.secondary', display: 'block', mb: 0.75 } }>
        This schedule runs on
      </Typography>
      <Box sx={ { display: 'flex', gap: 0.75 } }>
        { WEEK_ORDER.map((day, dayIndex) => {
          const isOpened = day === selectedDay;
          const isIncluded = isOpened || selectedDays[day];
          return (
            <ButtonBase
              key={ day }
              disabled={ isUpdating }
              onClick={ () => tapDay(day) }
              aria-label={ day }
              aria-pressed={ isIncluded }
              sx={ {
                flex: 1, py: 1, borderRadius: 1, fontSize: 13, fontWeight: 500,
                border: '1px solid', borderColor: isIncluded ? 'primary.main' : 'divider',
                bgcolor: isIncluded ? 'action.selected' : 'transparent',
                color: isIncluded ? 'text.primary' : 'text.secondary',
                outline: isOpened ? '2px solid' : 'none', outlineColor: 'primary.main', outlineOffset: 1,
              } }
            >
              { DAY_LETTERS[dayIndex] }
            </ButtonBase>
          );
        }) }
      </Box>
      <Typography variant="caption" sx={ { color: 'text.secondary', display: 'block', mt: 0.75 } }>
        { changesPresent
          ? 'Tap more days to save these changes to them too.'
          : 'Tap a day to open it. Highlighted days share its schedule.' }
      </Typography>
    </Box>
  );
}
