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
import { executeAlarm } from '../../jobs/alarmScheduler.js';

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
  // Defaults to every day
  days: z.array(z.enum(DAYS_OF_WEEK as [DayOfWeek, ...DayOfWeek[]])).optional(),
  // Defaults to switching the alarm on
  enabled: z.boolean().optional(),
}).strict();

// Sets the alarm time for a side on some or all days, leaving the rest of each alarm as it is.
// Made for phone shortcuts, where sending a whole schedule is impractical.
router.post('/alarm/time', async (req: Request, res: Response) => {
  const validationResult = AlarmTimeSchema.safeParse(req.body);
  if (!validationResult.success) {
    logger.error('Invalid alarm time update:', validationResult.error);
    res.status(400).json({ error: 'Invalid request data', details: validationResult.error.errors });
    return;
  }
  const { side, time, days = DAYS_OF_WEEK as DayOfWeek[], enabled = true } = validationResult.data;
  await schedulesDB.read();
  for (const alarmSide of side === 'both' ? SIDES : [side]) {
    for (const day of days) {
      schedulesDB.data[alarmSide][day].alarm.time = time;
      schedulesDB.data[alarmSide][day].alarm.enabled = enabled;
    }
  }
  // Writing the file makes the job scheduler pick up the new time
  await schedulesDB.write();
  res.status(200).json(schedulesDB.data);
});


export default router;
