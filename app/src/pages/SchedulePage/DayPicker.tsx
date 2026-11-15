import { Box, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import { DayOfWeek } from '@api/schedulesSchema.ts';
import { useAppStore } from '@state/appStore.tsx';
import { LOWERCASE_DAYS } from './days.ts';
import { useScheduleStore } from './scheduleStore.tsx';
import { DayMode, WEEK_ORDER, getDayGroup } from './scheduleDays.ts';

const MODE_NAMES: Record<DayMode, string> = {
  everyDay: 'Every day',
  weekdaysWeekend: 'Weekdays / weekend',
  eachDay: 'Each day',
};

const DAY_NAMES: Record<DayOfWeek, string> = {
  monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed', thursday: 'Thu', friday: 'Fri', saturday: 'Sat', sunday: 'Sun',
};

// The tabs for a mode: one per schedule the week is split into. `day` is the day that is opened.
const MODE_TABS: Record<DayMode, { day: DayOfWeek; label: string }[]> = {
  everyDay: [],
  weekdaysWeekend: [{ day: 'monday', label: 'Weekdays' }, { day: 'saturday', label: 'Weekend' }],
  eachDay: WEEK_ORDER.map(day => ({ day, label: DAY_NAMES[day] })),
};

const toggleGroupSx = { width: '100%', '& .MuiToggleButton-root': { flex: 1, minWidth: 0, px: 0.5, whiteSpace: 'nowrap' } };

// Chooses how the week is split into schedules, then which of them to look at.
// "Same every day" needs no second choice, so most people only ever see one row.
export default function DayPicker() {
  const { isUpdating } = useAppStore();
  const { selectedDay, dayMode, setDayMode, selectDay, hasEdits } = useScheduleStore();
  const tabs = MODE_TABS[dayMode];
  // The tab whose group contains the opened day
  const selectedTab = tabs.find(tab => getDayGroup(tab.day, dayMode).includes(selectedDay))?.day;

  return (
    <Box sx={ { display: 'flex', flexDirection: 'column', gap: 1 } }>
      <ToggleButtonGroup
        exclusive
        size="small"
        value={ dayMode }
        disabled={ isUpdating }
        onChange={ (_event, newDayMode: DayMode | null) => { if (newDayMode !== null) setDayMode(newDayMode); } }
        aria-label="How the week is split"
        // Sized by their text: the middle label is the longest and would crowd its neighbours at equal widths
        sx={ { ...toggleGroupSx, '& .MuiToggleButton-root': { flex: '1 1 auto', px: 1, whiteSpace: 'nowrap' } } }
      >
        { (Object.keys(MODE_NAMES) as DayMode[]).map(mode => (
          <ToggleButton key={ mode } value={ mode }>{ MODE_NAMES[mode] }</ToggleButton>
        )) }
      </ToggleButtonGroup>

      { tabs.length > 0 && (
        <ToggleButtonGroup
          exclusive
          size="small"
          value={ selectedTab }
          // Switching would throw away what is on screen, so it waits for Save or Discard
          disabled={ isUpdating || hasEdits }
          onChange={ (_event, day: DayOfWeek | null) => { if (day !== null) selectDay(LOWERCASE_DAYS.indexOf(day)); } }
          aria-label="Which schedule"
          sx={ toggleGroupSx }
        >
          { tabs.map(tab => <ToggleButton key={ tab.day } value={ tab.day }>{ tab.label }</ToggleButton>) }
        </ToggleButtonGroup>
      ) }

      { tabs.length > 0 && hasEdits && (
        <Typography variant="caption" sx={ { color: 'text.secondary' } }>
          Save or discard your changes to switch.
        </Typography>
      ) }
    </Box>
  );
}
