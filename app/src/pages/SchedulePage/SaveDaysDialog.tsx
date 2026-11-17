import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, ToggleButton, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import { DayOfWeek } from '@api/schedulesSchema.ts';
import { SHORT_DAY_NAMES, WEEK_ORDER, describeDays } from './scheduleDays.ts';

type SaveDaysDialogProps = {
  open: boolean;
  // The day whose schedule is on screen; it starts out ticked
  openDay: DayOfWeek;
  onClose: () => void;
  onSave: (days: DayOfWeek[]) => void;
};

// Asks which days the schedule on screen should be saved to. Each day is ticked on its own.
export default function SaveDaysDialog({ open, openDay, onClose, onSave }: SaveDaysDialogProps) {
  const [days, setDays] = useState<DayOfWeek[]>([openDay]);
  // Each time it opens it starts again from the open day
  useEffect(() => {
    if (open) setDays([openDay]);
  }, [open, openDay]);

  const toggleDay = (day: DayOfWeek) => {
    setDays(days.includes(day) ? days.filter(otherDay => otherDay !== day) : [...days, day]);
  };

  return (
    <Dialog open={ open } onClose={ onClose } fullWidth maxWidth="xs">
      <DialogTitle>Save for which days?</DialogTitle>
      <DialogContent sx={ { display: 'flex', flexDirection: 'column', gap: 2 } }>
        <Box sx={ { display: 'flex', gap: 0.5 } }>
          { WEEK_ORDER.map(day => (
            <ToggleButton
              key={ day }
              value={ day }
              size="small"
              selected={ days.includes(day) }
              onChange={ () => toggleDay(day) }
              sx={ { flex: 1, minWidth: 0, px: 0 } }
            >
              { SHORT_DAY_NAMES[day] }
            </ToggleButton>
          )) }
        </Box>
        <Typography variant="body2" sx={ { color: 'text.secondary' } }>
          { days.length === 0 ? 'Pick at least one day.' : `This night's schedule replaces the one saved for ${describeDays(days)}.` }
        </Typography>
      </DialogContent>
      <DialogActions sx={ { px: 3, pb: 2 } }>
        <Button onClick={ onClose }>Cancel</Button>
        <Button variant="contained" disabled={ days.length === 0 } onClick={ () => onSave(days) }>Save</Button>
      </DialogActions>
    </Dialog>
  );
}
