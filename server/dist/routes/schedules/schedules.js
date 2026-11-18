
!function(){try{var e="undefined"!=typeof window?window:"undefined"!=typeof global?global:"undefined"!=typeof globalThis?globalThis:"undefined"!=typeof self?self:{},n=(new e.Error).stack;n&&(e._sentryDebugIds=e._sentryDebugIds||{},e._sentryDebugIds[n]="88bd0a44-a3ea-5f9f-be77-13e2ba631513")}catch(e){}}();
import _ from 'lodash';
import { applyAutomaticOffTime } from '../../db/automaticOffTime.js';
import express from 'express';
import logger from '../../logger.js';
import schedulesDB from '../../db/schedules.js';
import { SchedulesSchema, } from '../../db/schedulesSchema.js';
const router = express.Router();
router.get('/schedules', async (req, res) => {
    await schedulesDB.read();
    res.json(schedulesDB.data);
});
router.post('/schedules', async (req, res) => {
    const body = req.body;
    const validationResult = SchedulesSchema.deepPartial().safeParse(body);
    if (!validationResult.success) {
        logger.error('Invalid schedules update:', validationResult.error);
        res.status(400).json({
            error: 'Invalid request data',
            details: validationResult?.error?.errors,
        });
        return;
    }
    const schedules = validationResult.data;
    await schedulesDB.read();
    Object.entries(schedules).forEach(([side, sideSchedule]) => {
        Object.entries(sideSchedule).forEach(([day, schedule]) => {
            if (schedule.power) {
                _.merge(schedulesDB.data[side][day].power, schedule.power);
            }
            if (schedule.temperatures)
                schedulesDB.data[side][day].temperatures = schedule.temperatures;
            // Merged, like power: a request with only some alarm fields must keep the others
            if (schedule.alarm)
                _.merge(schedulesDB.data[side][day].alarm, schedule.alarm);
            // Whatever off time was sent, a night turns off by rule: 30 minutes after its wake-up time
            applyAutomaticOffTime(schedulesDB.data[side][day]);
        });
    });
    await schedulesDB.write();
    res.status(200).json(schedulesDB.data);
});
export default router;
//# sourceMappingURL=schedules.js.map
//# debugId=88bd0a44-a3ea-5f9f-be77-13e2ba631513
