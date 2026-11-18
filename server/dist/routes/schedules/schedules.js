
!function(){try{var e="undefined"!=typeof window?window:"undefined"!=typeof global?global:"undefined"!=typeof globalThis?globalThis:"undefined"!=typeof self?self:{},n=(new e.Error).stack;n&&(e._sentryDebugIds=e._sentryDebugIds||{},e._sentryDebugIds[n]="c21c019e-5d4e-521c-b8cc-346c77fa0daf")}catch(e){}}();
import _ from 'lodash';
import { applyAutomaticOffTime, isNightLengthValid } from '../../db/automaticOffTime.js';
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
    // A night that is on must have its wake-up time 1 to 23 hours after its bed-on time, as the
    // app requires. Checked for every night in the request before anything is changed.
    const badNights = [];
    Object.entries(schedules).forEach(([side, sideSchedule]) => {
        Object.entries(sideSchedule).forEach(([day, schedule]) => {
            const saved = schedulesDB.data[side][day];
            const isOn = schedule.power?.enabled ?? saved.power.enabled;
            const bedtime = schedule.power?.on ?? saved.power.on;
            const wakeTime = schedule.alarm?.time ?? saved.alarm.time;
            if (isOn && !isNightLengthValid(bedtime, wakeTime))
                badNights.push(`${side} ${day}`);
        });
    });
    if (badNights.length > 0) {
        res.status(400).json({
            error: 'Invalid request data',
            details: `The wake-up time must be 1 to 23 hours after the bed-on time (${badNights.join(', ')})`,
        });
        return;
    }
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
//# debugId=c21c019e-5d4e-521c-b8cc-346c77fa0daf
