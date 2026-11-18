import express, { Request, Response } from 'express';
import { z } from 'zod';
import { applyTrackerSleep, getAutopilotSnapshot, getNightSummaries } from '../../autopilot/autopilotMonitor.js';
import { SleepPeriod, findSleepPeriods } from '../../autopilot/sleepTracker.js';

const router = express.Router();

// What the autopilot sees and has done: each side's sleep state, heart rate and current offset,
// the room, and what it has learned from corrections and from a linked sleep tracker
router.get('/autopilot', (_req: Request, res: Response) => {
  res.json(getAutopilotSnapshot());
});

const MAX_NIGHTS_LISTED = 60;

// The saved stays in bed, newest first, without their minute rows
router.get('/autopilot/nights', (req: Request, res: Response) => {
  const limit = Math.min(MAX_NIGHTS_LISTED, Math.max(1, Number(req.query.limit) || 14));
  res.json(getNightSummaries(limit));
});

const isDate = (text: string) => !Number.isNaN(Date.parse(text));
const DateText = z.string().refine(isDate, 'Not a date and time');

// A worn tracker's account of a sleep: either the two times, or the health app's raw samples
const TrackerSleepSchema = z.object({
  side: z.enum(['left', 'right']),
  source: z.string().trim().min(1).max(40).default('Sleep tracker'),
  asleepAt: DateText.optional(),
  awakeAt: DateText.optional(),
  samples: z.array(z.object({ start: DateText, end: DateText, value: z.string().max(40).optional() })).max(2000).optional(),
}).refine(
  body => body.samples !== undefined || (body.asleepAt !== undefined && body.awakeAt !== undefined),
  'Send asleepAt and awakeAt, or samples',
);

// Takes sleep and wake times from a watch or band (by way of a phone shortcut or a script),
// files them with the stays in bed they overlap, and fits the bed's own sleep rules to them
router.post('/autopilot/sleepTimes', (req: Request, res: Response) => {
  const validationResult = TrackerSleepSchema.safeParse(req.body);
  if (!validationResult.success) {
    res.status(400).json({ error: 'Invalid request', details: validationResult.error.format() });
    return;
  }
  const { side, source, asleepAt, awakeAt, samples } = validationResult.data;
  const periods: SleepPeriod[] = samples
    ? findSleepPeriods(samples.map(sample => ({ startMs: Date.parse(sample.start), endMs: Date.parse(sample.end), value: sample.value })))
    : [{ asleepAtMs: Date.parse(asleepAt ?? ''), awakeAtMs: Date.parse(awakeAt ?? '') }];
  if (periods.length === 0 || periods.some(period => period.awakeAtMs <= period.asleepAtMs)) {
    res.status(400).json({ error: 'No sleep found in what was sent' });
    return;
  }
  const matchedNights = applyTrackerSleep(side, source, periods);
  const snapshot = getAutopilotSnapshot()[side];
  res.json({ sleeps: periods.length, matchedNights, rules: snapshot.rules, tracker: snapshot.tracker });
});

export default router;
