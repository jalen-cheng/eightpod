import { Box, Button, ButtonBase, Dialog, DialogActions, DialogContent, DialogTitle } from '@mui/material';
import { useEffect, useState } from 'react';
import { DayOfWeek } from '@api/schedulesSchema.ts';
import { DAY_NAMES, SHORT_DAY_NAMES, WEEK_ORDER } from './scheduleDays.ts';

type SaveDaysDialogProps = {
  open: boolean;
  // The day whose saved schedule is being copied
  openDay: DayOfWeek;
  onClose: () => void;
  // Called with the days picked, which never include the open day
  onSave: (days: DayOfWeek[]) => void;
};

// Asks which other days the open night should be copied to. The week is one row of seven equal
// boxes; the open day is marked as the source and cannot be picked.
export default function SaveDaysDialog({ open, openDay, onClose, onSave }: SaveDaysDialogProps) {
  const [days, setDays] = useState<DayOfWeek[]>([]);
  // Each time it opens it starts with nothing picked
  useEffect(() => {
    if (open) setDays([]);
  }, [open, openDay]);

  const toggleDay = (day: DayOfWeek) => {
    setDays(days.includes(day) ? days.filter(otherDay => otherDay !== day) : [...days, day]);
  };
  const otherDays = WEEK_ORDER.filter(day => day !== openDay);
  const areAllPicked = days.length === otherDays.length;

  return (
    <Dialog open={ open } onClose={ onClose } fullWidth maxWidth="xs">
      <DialogTitle>Copy { DAY_NAMES[openDay] } night to</DialogTitle>
      <DialogContent sx={ { display: 'flex', flexDirection: 'column', gap: 1.5 } }>
        <Box role="group" aria-label="Days to copy to" sx={ { display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 0.75 } }>
          { WEEK_ORDER.map((day) => {
            const isSource = day === openDay;
            const isPicked = days.includes(day);
            return (
              <ButtonBase
                key={ day }
                disabled={ isSource }
                onClick={ () => toggleDay(day) }
                aria-pressed={ isPicked }
                aria-label={ isSource ? `${DAY_NAMES[day]}, the night being copied` : DAY_NAMES[day] }
                sx={ {
                  height: 44, borderRadius: '10px', fontSize: 13, fontWeight: 500,
                  border: '1px solid', borderColor: isSource ? 'divider' : 'transparent',
                  bgcolor: isPicked ? 'primary.main' : isSource ? 'transparent' : 'action.selected',
                  color: isPicked ? 'primary.contrastText' : isSource ? 'text.disabled' : 'text.primary',
                  transition: 'background-color 120ms ease',
                } }
              >
                { SHORT_DAY_NAMES[day] }
              </ButtonBase>
            );
          }) }
        </Box>
        <Button
          size="small"
          color="inherit"
          onClick={ () => setDays(areAllPicked ? [] : otherDays) }
          sx={ { alignSelf: 'flex-start', ml: -1, color: 'text.secondary' } }
        >
          { areAllPicked ? 'Clear' : 'Every day' }
        </Button>
      </DialogContent>
      <DialogActions sx={ { px: 3, pb: 2 } }>
        <Button onClick={ onClose } sx={ { mr: 'auto' } }>Cancel</Button>
        <Button variant="contained" disabled={ days.length === 0 } onClick={ () => onSave(days) }>
          Copy
        </Button>
      </DialogActions>
    </Dialog>
  );
}
