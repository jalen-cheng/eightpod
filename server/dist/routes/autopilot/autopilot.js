
!function(){try{var e="undefined"!=typeof window?window:"undefined"!=typeof global?global:"undefined"!=typeof globalThis?globalThis:"undefined"!=typeof self?self:{},n=(new e.Error).stack;n&&(e._sentryDebugIds=e._sentryDebugIds||{},e._sentryDebugIds[n]="787d0b93-947b-5cc4-8352-40792cb1a050")}catch(e){}}();
import express from 'express';
import { z } from 'zod';
import { applyTrackerSleep, getAutopilotSnapshot, getNightSummaries, getNightsExport, getNightsOn, } from '../../autopilot/autopilotMonitor.js';
import { findSleepPeriods, readHealthExportSleep } from '../../autopilot/sleepTracker.js';
const router = express.Router();
// What the autopilot sees and has done: each side's sleep state, heart rate and current offset,
// the room, and what it has learned from corrections and from a linked sleep tracker
router.get('/autopilot', (_req, res) => {
    res.json(getAutopilotSnapshot());
});
const MAX_NIGHTS_LISTED = 60;
const SideSchema = z.enum(['left', 'right']);
const DayQuerySchema = z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), side: SideSchema });
// The saved stays in bed. With `date` and `side`: that side's stays which ended on that day, in
// full, minute rows included. Otherwise the newest of both sides, without their minute rows.
router.get('/autopilot/nights', (req, res) => {
    if (req.query.date !== undefined) {
        const dayQuery = DayQuerySchema.safeParse(req.query);
        if (!dayQuery.success) {
            res.status(400).json({ error: 'Give date as YYYY-MM-DD and side as left or right' });
            return;
        }
        res.json(getNightsOn(dayQuery.data.date, dayQuery.data.side));
        return;
    }
    const limit = Math.min(MAX_NIGHTS_LISTED, Math.max(1, Number(req.query.limit) || 14));
    res.json(getNightSummaries(limit));
});
// The lengths of time an export can cover, in days
const EXPORT_DAYS = [7, 14, 30, 60, 90];
const DEFAULT_EXPORT_DAYS = 90;
// The saved nights of the last 7, 14, 30, 60 or 90 days with their minute rows, and what has
// been learned, as a file to keep
router.get('/autopilot/nights/export', (req, res) => {
    const requestedDays = Number(req.query.days);
    const days = EXPORT_DAYS.includes(requestedDays) ? requestedDays : DEFAULT_EXPORT_DAYS;
    res.attachment(`eightpod-nights-${days}-days-${new Date().toISOString().slice(0, 10)}.json`);
    res.json(getNightsExport(days));
});
const isDate = (text) => !Number.isNaN(Date.parse(text));
const DateText = z.string().refine(isDate, 'Not a date and time');
// A worn tracker's account of a sleep: either the two times, or the health app's raw samples
const TrackerSleepSchema = z.object({
    side: z.enum(['left', 'right']),
    source: z.string().trim().min(1).max(40).default('Sleep tracker'),
    asleepAt: DateText.optional(),
    awakeAt: DateText.optional(),
    samples: z.array(z.object({ start: DateText, end: DateText, value: z.string().max(40).optional() })).max(2000).optional(),
}).refine(body => body.samples !== undefined || (body.asleepAt !== undefined && body.awakeAt !== undefined), 'Send asleepAt and awakeAt, or samples');
// Takes sleep and wake times from a watch or band (by way of a phone shortcut, an app that
// posts Apple Health data, or a script), files them with the stays in bed they overlap, and
// fits the bed's own sleep rules to them. An app that cannot shape its own request puts the
// side in the address (`?side=left`) and sends what it sends.
router.post('/autopilot/sleepTimes', (req, res) => {
    const exportedSamples = readHealthExportSleep(req.body);
    let side;
    let source;
    let periods;
    if (exportedSamples) {
        const sideResult = SideSchema.safeParse(req.query.side);
        if (!sideResult.success) {
            res.status(400).json({ error: 'Add ?side=left or ?side=right to the address' });
            return;
        }
        side = sideResult.data;
        source = typeof req.query.source === 'string' ? req.query.source.slice(0, 40) : 'Apple Health';
        periods = findSleepPeriods(exportedSamples);
    }
    else {
        const validationResult = TrackerSleepSchema.safeParse({ side: req.query.side, ...req.body });
        if (!validationResult.success) {
            res.status(400).json({ error: 'Invalid request', details: validationResult.error.format() });
            return;
        }
        const { asleepAt, awakeAt, samples } = validationResult.data;
        ({ side, source } = validationResult.data);
        periods = samples
            ? findSleepPeriods(samples.map(sample => ({ startMs: Date.parse(sample.start), endMs: Date.parse(sample.end), value: sample.value })))
            : [{ asleepAtMs: Date.parse(asleepAt ?? ''), awakeAtMs: Date.parse(awakeAt ?? '') }];
    }
    if (periods.length === 0 || periods.some(period => period.awakeAtMs <= period.asleepAtMs)) {
        res.status(400).json({ error: 'No sleep found in what was sent' });
        return;
    }
    const matchedNights = applyTrackerSleep(side, source, periods);
    const snapshot = getAutopilotSnapshot()[side];
    res.json({ sleeps: periods.length, matchedNights, rules: snapshot.rules, tracker: snapshot.tracker });
});
export default router;
//# sourceMappingURL=autopilot.js.map
//# debugId=787d0b93-947b-5cc4-8352-40792cb1a050
