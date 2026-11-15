import express, { Request, Response } from 'express';
import { z } from 'zod';
import {
  AlarmJob,
  AlarmJobSchema,
  DayOfWeek,
  Side,
  TimeSchema,
} from '../../db/schedulesSchema.js';
import { DAYS_OF_WEEK } from '../../jobs/utils.js';
import logger from '../../logger.js';
import schedulesDB from '../../db/schedules.js';
import settingsDB from '../../db/settings.js';
import { executeAlarm, nextOccurrenceHhMm } from '../../jobs/alarmScheduler.js';

const router = express.Router();

router.post('/alarm', async (req: Request, res: Response) => {
  const body = req.body;
  const validationResult = AlarmJobSchema.safeParse(body);
  if (!validationResult.success) {
    logger.error('Invalid schedules update:', validationResult.error);
    res.status(400).json({
      error: 'Invalid request data',
      details: validationResult?.error?.errors,
    });
    return;
  }
  const alarmJob: AlarmJob = validationResult.data;
  void executeAlarm(alarmJob);
  res.status(200).json(schedulesDB.data);
});


const SIDES: Side[] = ['left', 'right'];
const AlarmTimeSchema = z.object({
  side: z.enum(['left', 'right', 'both']),
  time: TimeSchema,
  // Without days: a one-off alarm at the next time the clock shows `time`.
  // With days: changes the weekly schedule's alarm on those days for good.
  days: z.array(z.enum(DAYS_OF_WEEK as [DayOfWeek, ...DayOfWeek[]])).optional(),
  // Only used with days. Defaults to switching the alarm on.
  enabled: z.boolean().optional(),
}).strict();

// How long after a one-off alarm its override stays in force. Matches the app's own override.
const ONE_OFF_EXPIRY_MINUTES = 2;

// Sets an alarm time with one short request. Made for phone shortcuts, where sending a whole
// schedule is impractical.
// - No `days`: a one-off alarm at the next occurrence of the time (tonight or tomorrow, whichever
//   comes first). It uses the same override the app's "change tonight's alarm" uses, so the
//   weekly schedule is untouched and a scheduled alarm before it is skipped.
// - With `days`: sets the weekly alarm time on those days, leaving the rest of each alarm alone.
router.post('/alarm/time', async (req: Request, res: Response) => {
  const validationResult = AlarmTimeSchema.safeParse(req.body);
  if (!validationResult.success) {
    logger.error('Invalid alarm time update:', validationResult.error);
    res.status(400).json({ error: 'Invalid request data', details: validationResult.error.errors });
    return;
  }
  const { side, time, days, enabled = true } = validationResult.data;
  const alarmSides = side === 'both' ? SIDES : [side];

  if (days) {
    await schedulesDB.read();
    for (const alarmSide of alarmSides) {
      for (const day of days) {
        schedulesDB.data[alarmSide][day].alarm.time = time;
        schedulesDB.data[alarmSide][day].alarm.enabled = enabled;
      }
    }
    // Writing the file makes the job scheduler pick up the new time
    await schedulesDB.write();
    res.status(200).json({ kind: 'weekly', sides: alarmSides, days, time, enabled });
    return;
  }

  await settingsDB.read();
  const firesAt = nextOccurrenceHhMm(settingsDB.data.timeZone, time);
  for (const alarmSide of alarmSides) {
    settingsDB.data[alarmSide].scheduleOverrides.alarm = {
      disabled: false,
      timeOverride: time,
      expiresAt: firesAt.clone().add(ONE_OFF_EXPIRY_MINUTES, 'minutes').format(),
    };
  }
  await settingsDB.write();
  res.status(200).json({ kind: 'oneOff', sides: alarmSides, time, firesAt: firesAt.format() });
});


export default router;
