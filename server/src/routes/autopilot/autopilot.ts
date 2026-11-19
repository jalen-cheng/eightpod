import express, { Request, Response } from 'express';
import { z } from 'zod';
import {
  applyTrackerSleep, getAutopilotSnapshot, getNightSummaries, getNightsExport, getNightsOn, startRehearsal, stopRehearsal,
} from '../../autopilot/autopilotMonitor.js';
import { REHEARSAL_MINUTES } from '../../autopilot/nightPlan.js';
import { SleepPeriod, findSleepPeriods, parseSampleLines } from '../../autopilot/sleepTracker.js';

const router = express.Router();

// What the autopilot sees and has done: each side's sleep state, heart rate and current offset,
// the room, and what it has learned from corrections and from a linked sleep tracker
router.get('/autopilot', (_req: Request, res: Response) => {
  res.json(getAutopilotSnapshot());
});

const MAX_NIGHTS_LISTED = 60;
const SideSchema = z.enum(['left', 'right']);
const HOUR_MS = 60 * 60_000;
const LONGEST_SLEEP_MS = 18 * HOUR_MS;
const OLDEST_SLEEP_MS = 100 * 24 * HOUR_MS;
const CLOCK_SLACK_MS = HOUR_MS;
const DayQuerySchema = z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), side: SideSchema.optional() });

// The saved stays in bed. With `date`: the stays which ended on that day, in full, minute rows
// included: one side's with `side`, or without it the bed's as one sleeper's (where both sides
// saw the same hours, the side with the most sleep). Otherwise the newest of both sides,
// without their minute rows.
router.get('/autopilot/nights', (req: Request, res: Response) => {
  if (req.query.date !== undefined) {
    const dayQuery = DayQuerySchema.safeParse(req.query);
    if (!dayQuery.success) {
      res.status(400).json({ error: 'Give date as YYYY-MM-DD; side, if given, as left or right' });
      return;
    }
    res.json(getNightsOn(dayQuery.data.date, dayQuery.data.side));
    return;
  }
  const limit = Math.min(MAX_NIGHTS_LISTED, Math.max(1, Number(req.query.limit) || 14));
  res.json(getNightSummaries(limit));
});

// Plays a whole night's plan on the bed in a few minutes, from the temperature it is set to now,
// so what the autopilot does can be watched. Refused with the reason when it cannot start.
router.post('/autopilot/rehearsal', async (_req: Request, res: Response) => {
  const refusal = await startRehearsal();
  if (refusal) {
    res.status(409).json({ error: refusal });
    return;
  }
  res.json({ minutes: REHEARSAL_MINUTES });
});

// Ends a rehearsal early; the bed returns to where it began within a minute
router.delete('/autopilot/rehearsal', (_req: Request, res: Response) => {
  res.json({ stopped: stopRehearsal() });
});

// The lengths of time an export can cover, in days
const EXPORT_DAYS = [7, 14, 30, 60, 90];
const DEFAULT_EXPORT_DAYS = 90;

// The saved nights of the last 7, 14, 30, 60 or 90 days with their minute rows, and what has
// been learned, as a file to keep
router.get('/autopilot/nights/export', (req: Request, res: Response) => {
  const requestedDays = Number(req.query.days);
  const days = EXPORT_DAYS.includes(requestedDays) ? requestedDays : DEFAULT_EXPORT_DAYS;
  res.attachment(`sevensleep-nights-${days}-days-${new Date().toISOString().slice(0, 10)}.json`);
  res.json(getNightsExport(days));
});

// A time has to say its zone ("Z", or an offset such as -08:00): without one it would be read
// in the Pod's own clock zone, which is not the sleeper's
const isDate = (text: string) => !Number.isNaN(Date.parse(text)) && /(Z|[+-]\d{2}:?\d{2})$/.test(text.trim());
const DateText = z.string().refine(isDate, 'Not a date and time with its zone, such as 2026-11-18T23:12:00-08:00');

const SampleSchema = z.object({ start: DateText, end: DateText, value: z.string().max(40).optional() });
const MAX_SAMPLES = 2000;
// Samples as they may arrive: a list of objects, text with one sample a line, or a list of such lines
const readSamples = (sent: unknown): unknown => {
  if (typeof sent === 'string') return parseSampleLines(sent);
  if (Array.isArray(sent)) return sent.flatMap((item: unknown) => (typeof item === 'string' ? parseSampleLines(item) : [item]));
  return sent;
};

// A worn tracker's account of a sleep: either the two times, or the health app's raw samples
// (as a list, or as text with one sample a line, which is what a phone shortcut can send).
// `side` narrows it to one side's stays; without it the stays of both sides are looked at.
const TrackerSleepSchema = z.object({
  side: SideSchema.optional(),
  source: z.string().trim().min(1).max(40).default('Sleep tracker'),
  asleepAt: DateText.optional(),
  awakeAt: DateText.optional(),
  samples: z.preprocess(readSamples, z.array(SampleSchema).max(MAX_SAMPLES)).optional(),
}).refine(
  body => body.samples !== undefined || (body.asleepAt !== undefined && body.awakeAt !== undefined),
  'Send asleepAt and awakeAt, or samples',
);

const countOf = (count: number, noun: string) => `${count} ${noun}${count === 1 ? '' : 's'}`;

// Takes sleep and wake times from a watch or band (by way of a phone shortcut or a script),
// files them with the stays in bed they overlap, and fits the bed's own sleep rules to them.
// Every answer carries a `message` in words, for a shortcut to show as it is.
router.post('/autopilot/sleepTimes', (req: Request, res: Response) => {
  const validationResult = TrackerSleepSchema.safeParse(req.body);
  if (!validationResult.success) {
    res.status(400).json({
      error: 'Invalid request',
      message: 'SevenSleep could not read what was sent: each sleep needs a start and an end time that say their zone.',
      details: validationResult.error.format(),
    });
    return;
  }
  const { side, source, asleepAt, awakeAt, samples } = validationResult.data;
  let periods: SleepPeriod[] = samples
    ? findSleepPeriods(samples.map(sample => ({ startMs: Date.parse(sample.start), endMs: Date.parse(sample.end), value: sample.value })))
    : [{ asleepAtMs: Date.parse(asleepAt ?? ''), awakeAtMs: Date.parse(awakeAt ?? ''), awakeIntervals: [] }];
  // Only sleeps that could be real are taken: not in the future, not older than what is kept,
  // not longer than anyone sleeps. The request needs no password, so it is not taken on trust.
  const nowMs = Date.now();
  periods = periods.filter(period => period.awakeAtMs > period.asleepAtMs && period.awakeAtMs - period.asleepAtMs <= LONGEST_SLEEP_MS
    && period.awakeAtMs <= nowMs + CLOCK_SLACK_MS && period.asleepAtMs >= nowMs - OLDEST_SLEEP_MS);
  if (periods.length === 0) {
    res.status(400).json({
      error: 'No sleep found in what was sent',
      message: `No sleep found in what ${source} sent. If your tracker's app is not writing sleep there, there is nothing to send.`,
    });
    return;
  }
  const matchedNights = applyTrackerSleep(source, periods, side);
  const snapshot = getAutopilotSnapshot().left;
  const matched = matchedNights > 0
    ? `Matched ${countOf(matchedNights, 'stay')} in bed.`
    : 'No stay in bed saved on the Pod overlaps it.';
  res.json({
    message: `${countOf(periods.length, 'sleep')} received from ${source}. ${matched}`,
    sleeps: periods.length,
    matchedNights,
    rules: snapshot.rules,
    tracker: snapshot.tracker,
  });
});

export default router;
