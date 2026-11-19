import { useState } from 'react';
import _ from 'lodash';
import moment from 'moment-timezone';
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, TextField, Typography } from '@mui/material';
import { NightDetail, postSleepTimes } from '@api/autopilot.ts';

const CLOCK_FORMAT = 'HH:mm';
const MINUTE_MS = 60_000;
// What a record entered here is filed under, where a tracker's would carry the tracker's name
const OWN_RECORD_SOURCE = 'You';

// The moment nearest to `aroundMs` at which the clock reads `clock` (HH:mm), looking at the day
// before, the same day and the day after: a stay in bed can cross midnight
const findNearestMoment = (clock: string, aroundMs: number) => {
  const [hours, minutes] = clock.split(':').map(Number);
  const sameDay = moment(aroundMs).hours(hours).minutes(minutes).seconds(0).milliseconds(0);
  const candidates = [-1, 0, 1].map(days => sameDay.clone().add(days, 'day'));
  return _.minBy(candidates, candidate => Math.abs(candidate.valueOf() - aroundMs)) ?? sameDay;
};

type SleepTimesDialogProps = { night: NightDetail; onClose: () => void; onSaved: () => void };

// Lets the sleeper say when they really fell asleep and woke during a stay. It is saved the way
// a worn tracker's record is, so the bed's sleep rules are fitted to it in the same way.
export default function SleepTimesDialog({ night, onClose, onSaved }: SleepTimesDialogProps) {
  const stayEndMs = night.startedAtMs + night.minutes.length * MINUTE_MS;
  const knownAsleepMs = night.tracker?.asleepAtMs ?? night.asleepAtMs ?? night.startedAtMs;
  const knownAwakeMs = night.tracker?.awakeAtMs ?? night.awakeAtMs ?? stayEndMs;
  const [asleepClock, setAsleepClock] = useState(moment(knownAsleepMs).format(CLOCK_FORMAT));
  const [awakeClock, setAwakeClock] = useState(moment(knownAwakeMs).format(CLOCK_FORMAT));
  const [problem, setProblem] = useState<string | undefined>(undefined);
  const [isSaving, setIsSaving] = useState(false);

  const save = () => {
    const asleepAt = findNearestMoment(asleepClock, knownAsleepMs);
    const awakeAt = findNearestMoment(awakeClock, knownAwakeMs);
    if (!asleepAt.isValid() || !awakeAt.isValid() || !awakeAt.isAfter(asleepAt)) {
      setProblem('The wake time has to come after the time you fell asleep.');
      return;
    }
    setIsSaving(true);
    setProblem(undefined);
    postSleepTimes({ source: OWN_RECORD_SOURCE, asleepAt: asleepAt.format(), awakeAt: awakeAt.format() })
      .then((refusal) => {
        if (refusal) setProblem(refusal);
        else onSaved();
      })
      .catch((error) => {
        console.error(error);
        setProblem('That was not saved. Check the Pod is reachable and try again.');
      })
      .finally(() => setIsSaving(false));
  };

  return (
    <Dialog open onClose={ onClose } fullWidth maxWidth="xs">
      <DialogTitle>When you slept</DialogTitle>
      <DialogContent>
        <Box sx={ { display: 'flex', flexDirection: 'column', gap: 2, pt: 1 } }>
          <TextField
            label="Fell asleep"
            type="time"
            size="small"
            value={ asleepClock }
            onChange={ event => setAsleepClock(event.target.value) }
            slotProps={ { inputLabel: { shrink: true } } }
          />
          <TextField
            label="Woke up"
            type="time"
            size="small"
            value={ awakeClock }
            onChange={ event => setAwakeClock(event.target.value) }
            slotProps={ { inputLabel: { shrink: true } } }
          />
          <Typography variant="caption" sx={ { color: 'text.secondary' } }>
            Kept beside what the bed saw, like a tracker&apos;s record. Once 5 nights have one, the bed fits how it
            judges sleep to them. A tracker that reports this night later replaces what you enter here.
          </Typography>
          { problem && <Typography variant="caption" color="error" role="alert">{ problem }</Typography> }
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={ onClose }>Cancel</Button>
        <Button variant="contained" disabled={ isSaving } onClick={ save }>Save</Button>
      </DialogActions>
    </Dialog>
  );
}
