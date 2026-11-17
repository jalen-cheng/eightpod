import { ListSubheader, MenuItem, TextField } from '@mui/material';
import { DayOfWeek } from '@api/schedulesSchema.ts';
import { useAppStore } from '@state/appStore.tsx';
import { LOWERCASE_DAYS } from './days.ts';
import { useScheduleStore } from './scheduleStore.tsx';
import { DayMode, WEEK_ORDER, getDayGroup } from './scheduleDays.ts';

// One thing that can be opened and saved: a split of the week, and a day that stands for the
// group it falls in.
type ScheduleTarget = { key: string; label: string; dayMode: DayMode; day: DayOfWeek };

const DAY_NAMES: Record<DayOfWeek, string> = {
  monday: 'Monday', tuesday: 'Tuesday', wednesday: 'Wednesday', thursday: 'Thursday',
  friday: 'Friday', saturday: 'Saturday', sunday: 'Sunday',
};

// The choices, grouped by how the week is split
const TARGET_GROUPS: { heading: string; targets: ScheduleTarget[] }[] = [
  {
    heading: 'One schedule for the week',
    targets: [{ key: 'everyDay', label: 'Every day', dayMode: 'everyDay', day: 'monday' }],
  },
  {
    heading: 'Weekdays and weekend',
    targets: [
      { key: 'weekdays', label: 'Weekdays', dayMode: 'weekdaysWeekend', day: 'monday' },
      { key: 'weekend', label: 'Weekend', dayMode: 'weekdaysWeekend', day: 'saturday' },
    ],
  },
  {
    heading: 'A single day',
    targets: WEEK_ORDER.map(day => ({ key: day, label: DAY_NAMES[day], dayMode: 'eachDay' as const, day })),
  },
];
const ALL_TARGETS = TARGET_GROUPS.flatMap(group => group.targets);

// The one control for which nights a schedule covers. Picking an entry both chooses how the week
// is split and opens that schedule; saving then writes to exactly the days it names.
export default function DayPicker() {
  const { isUpdating } = useAppStore();
  const { selectedDay, dayMode, setDayMode, selectDay, hasEdits } = useScheduleStore();

  const coversOpenDay = (target: ScheduleTarget) => getDayGroup(target.day, target.dayMode).includes(selectedDay);
  const selectedTarget = ALL_TARGETS.find(target => target.dayMode === dayMode && coversOpenDay(target));

  // A target that covers the open day keeps what is on screen, so it can be chosen with unsaved
  // edits (for example to save Monday's edits for every day). Any other opens a different
  // schedule, which would throw the edits away, so it waits for Save or Discard.
  const choose = (target: ScheduleTarget) => {
    setDayMode(target.dayMode);
    if (!coversOpenDay(target)) selectDay(LOWERCASE_DAYS.indexOf(target.day));
  };

  return (
    <TextField
      select
      fullWidth
      size="small"
      label="Schedule for"
      value={ selectedTarget?.key ?? '' }
      disabled={ isUpdating }
      onChange={ (event) => {
        const target = ALL_TARGETS.find(candidate => candidate.key === event.target.value);
        if (target) choose(target);
      } }
      helperText={ hasEdits ? 'Save or discard your changes to open a different schedule.' : undefined }
    >
      { TARGET_GROUPS.flatMap(group => [
        <ListSubheader key={ group.heading }>{ group.heading }</ListSubheader>,
        ...group.targets.map(target => (
          <MenuItem key={ target.key } value={ target.key } disabled={ hasEdits && !coversOpenDay(target) }>
            { target.label }
          </MenuItem>
        )),
      ]) }
    </TextField>
  );
}
