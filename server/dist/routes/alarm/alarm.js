
!function(){try{var e="undefined"!=typeof window?window:"undefined"!=typeof global?global:"undefined"!=typeof globalThis?globalThis:"undefined"!=typeof self?self:{},n=(new e.Error).stack;n&&(e._sentryDebugIds=e._sentryDebugIds||{},e._sentryDebugIds[n]="e5d6c64f-a5c4-59ba-9768-c7313b65afee")}catch(e){}}();
import express from 'express';
import { z } from 'zod';
import { AlarmJobSchema, TimeSchema, } from '../../db/schedulesSchema.js';
import { DAYS_OF_WEEK } from '../../jobs/utils.js';
import logger from '../../logger.js';
import schedulesDB from '../../db/schedules.js';
import { executeAlarm } from '../../jobs/alarmScheduler.js';
const router = express.Router();
router.post('/alarm', async (req, res) => {
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
    const alarmJob = validationResult.data;
    void executeAlarm(alarmJob);
    res.status(200).json(schedulesDB.data);
});
const SIDES = ['left', 'right'];
const AlarmTimeSchema = z.object({
    side: z.enum(['left', 'right', 'both']),
    time: TimeSchema,
    // Defaults to every day
    days: z.array(z.enum(DAYS_OF_WEEK)).optional(),
    // Defaults to switching the alarm on
    enabled: z.boolean().optional(),
}).strict();
// Sets the alarm time for a side on some or all days, leaving the rest of each alarm as it is.
// Made for phone shortcuts, where sending a whole schedule is impractical.
router.post('/alarm/time', async (req, res) => {
    const validationResult = AlarmTimeSchema.safeParse(req.body);
    if (!validationResult.success) {
        logger.error('Invalid alarm time update:', validationResult.error);
        res.status(400).json({ error: 'Invalid request data', details: validationResult.error.errors });
        return;
    }
    const { side, time, days = DAYS_OF_WEEK, enabled = true } = validationResult.data;
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
//# sourceMappingURL=alarm.js.map
//# debugId=e5d6c64f-a5c4-59ba-9768-c7313b65afee
