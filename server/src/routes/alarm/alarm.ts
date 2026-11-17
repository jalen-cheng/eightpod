import express, { Request, Response } from 'express';
import { z } from 'zod';
import moment from 'moment-timezone';
import {
  AlarmJob, AlarmJobSchema, DayOfWeek, LATE_ALARM_WINDOW_HOURS, Side,
} from '../../db/schedulesSchema.js';
import { DAYS_OF_WEEK } from '../../jobs/utils.js';
import { SideChoiceSchema, resolveSides } from '../sideChoice.js';
import { findAlarmReplacedByOneOff, findNextScheduledAlarm, parseClockTime } from '../../jobs/scheduleTiming.js';
import logger from '../../logger.js';
import { applyAutomaticOffTime } from '../../db/automaticOffTime.js';
import schedulesDB from '../../db/schedules.js';
import settingsDB from '../../db/settings.js';
import { executeAlarm, getPendingOneOffAlarm, nextOccurrenceHhMm } from '../../jobs/alarmScheduler.js';

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


const HOURS_TO_MINUTES = 60;
// A one-off alarm is stored as a time of day, so it can only be up to a day ahead
const ONE_OFF_WINDOW_HOURS = 24;
const MAX_SHIFT_MINUTES = 12 * HOURS_TO_MINUTES;
// How long after a one-off alarm its override stays in force. Matches the app's own override.
const ONE_OFF_EXPIRY_MINUTES = 2;
const NO_ONE_OFF = { disabled: false, timeOverride: '', expiresAt: '' };

// A time of day as a phone sends it: 24-hour, or 12-hour with AM/PM, alone or inside a date
const ClockTimeSchema = z.string().transform((text, context) => {
  const time = parseClockTime(text);
  if (time === undefined) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: `No time of day found in "${text}"` });
    return z.NEVER;
  }
  return time;
});

const AlarmTimeSchema = z.object({
  side: SideChoiceSchema,
  // Exactly one of these two:
  // - time: the alarm goes off at this time of day
  // - shiftMinutes: the next alarm moves this many minutes later (negative: earlier)
  time: ClockTimeSchema.optional(),
  shiftMinutes: z.number().int().min(-MAX_SHIFT_MINUTES).max(MAX_SHIFT_MINUTES).optional(),
  // Only with time. Without days: a one-off alarm at the next time the clock shows `time`.
  // With days: changes the weekly schedule's alarm on those days for good.
  days: z.array(z.enum(DAYS_OF_WEEK as [DayOfWeek, ...DayOfWeek[]])).optional(),
  // Only used with days. Defaults to switching the alarm on.
  enabled: z.boolean().optional(),
}).strict()
  .refine(body => (body.time === undefined) !== (body.shiftMinutes === undefined), { message: 'Send either time or shiftMinutes' })
  .refine(body => !body.days || body.time !== undefined, { message: 'days needs time, not shiftMinutes' });

// Stores a one-off alarm for a side. Scheduled alarms are held back until `holdBackUntil`, so
// the one this replaces stays quiet even when the one-off goes off before it.
const setOneOff = (side: Side, firesAt: moment.Moment, holdBackUntil: moment.Moment) => {
  settingsDB.data[side].scheduleOverrides.alarm = {
    disabled: false,
    timeOverride: firesAt.format('HH:mm'),
    expiresAt: moment.max(firesAt, holdBackUntil).clone().add(ONE_OFF_EXPIRY_MINUTES, 'minutes').format(),
  };
  return { side, time: firesAt.format('HH:mm'), firesAt: firesAt.format() };
};

// Moves a side's next alarm (its waiting one-off, else its next scheduled alarm) by some minutes,
// as a one-off. Returns undefined when there is no alarm in the next day to move, or it would
// land in the past.
const shiftNextAlarm = (side: Side, shiftMinutes: number, now: moment.Moment) => {
  const nextAlarm = getPendingOneOffAlarm(settingsDB.data, side, now) ?? findNextScheduledAlarm(schedulesDB.data[side], now);
  const windowEnd = now.clone().add(ONE_OFF_WINDOW_HOURS, 'hours');
  if (!nextAlarm) return undefined;
  if (!nextAlarm.isBefore(windowEnd)) return undefined;
  const firesAt = nextAlarm.clone().add(shiftMinutes, 'minutes');
  if (!firesAt.isAfter(now) || !firesAt.isBefore(windowEnd)) return undefined;
  // Keeps holding back whatever an earlier one-off was already holding back
  const previousExpiry = settingsDB.data[side].scheduleOverrides.alarm.expiresAt;
  const holdBackUntil = previousExpiry ? moment.max(nextAlarm, moment(previousExpiry)) : nextAlarm;
  return setOneOff(side, firesAt, holdBackUntil);
};

// Sets an alarm with one short request. Made for phone shortcuts and the app's one-time alarm,
// where sending a whole schedule is impractical.
// - `time`, no `days`: a one-off alarm at the next occurrence of the time (tonight or tomorrow,
//   whichever comes first). The weekly schedule is untouched; the scheduled alarm of that same
//   morning is skipped, whether it is earlier or up to LATE_ALARM_WINDOW_HOURS later.
// - `time` with `days`: sets the weekly alarm time on those days, leaving the rest of each alarm alone.
// - `shiftMinutes`: moves the next alarm later or earlier, as a one-off.
router.post('/alarm/time', async (req: Request, res: Response) => {
  const validationResult = AlarmTimeSchema.safeParse(req.body);
  if (!validationResult.success) {
    logger.error('Invalid alarm time update:', validationResult.error);
    res.status(400).json({ error: 'Invalid request data', details: validationResult.error.errors });
    return;
  }
  const { side, time, shiftMinutes, days, enabled = true } = validationResult.data;
  const alarmSides = await resolveSides(side);

  if (days && time) {
    await schedulesDB.read();
    for (const alarmSide of alarmSides) {
      for (const day of days) {
        schedulesDB.data[alarmSide][day].alarm.time = time;
        schedulesDB.data[alarmSide][day].alarm.enabled = enabled;
        applyAutomaticOffTime(schedulesDB.data[alarmSide][day]);
      }
    }
    // Writing the file makes the job scheduler pick up the new time
    await schedulesDB.write();
    res.status(200).json({ kind: 'weekly', sides: alarmSides, days, time, enabled });
    return;
  }

  await settingsDB.read();
  await schedulesDB.read();
  const now = moment.tz(settingsDB.data.timeZone);
  const alarms = alarmSides
    .map(alarmSide => {
      if (shiftMinutes !== undefined) return shiftNextAlarm(alarmSide, shiftMinutes, now);
      // (time is set here: the schema requires it whenever shiftMinutes is missing)
      const firesAt = nextOccurrenceHhMm(settingsDB.data.timeZone, time as string);
      // Without this, a one-off earlier than the scheduled alarm would leave both to go off
      const replacedAlarm = findAlarmReplacedByOneOff(schedulesDB.data[alarmSide], now, firesAt, LATE_ALARM_WINDOW_HOURS);
      return setOneOff(alarmSide, firesAt, replacedAlarm ?? firesAt);
    })
    .filter(alarm => alarm !== undefined);
  if (alarms.length === 0) {
    res.status(409).json({ error: 'No alarm in the next 24 hours that can be moved that far' });
    return;
  }
  await settingsDB.write();
  res.status(200).json({ kind: 'oneOff', alarms });
});

// Drops a side's waiting one-off alarm, so the weekly schedule applies again
router.post('/alarm/time/cancel', async (req: Request, res: Response) => {
  const validationResult = z.object({ side: SideChoiceSchema }).strict().safeParse(req.body);
  if (!validationResult.success) {
    res.status(400).json({ error: 'Invalid request data', details: validationResult.error.errors });
    return;
  }
  const alarmSides = await resolveSides(validationResult.data.side);
  for (const alarmSide of alarmSides) {
    settingsDB.data[alarmSide].scheduleOverrides.alarm = { ...NO_ONE_OFF };
  }
  await settingsDB.write();
  res.status(200).json({ kind: 'cancelled', sides: alarmSides });
});


export default router;
