
!function(){try{var e="undefined"!=typeof window?window:"undefined"!=typeof global?global:"undefined"!=typeof globalThis?globalThis:"undefined"!=typeof self?self:{},n=(new e.Error).stack;n&&(e._sentryDebugIds=e._sentryDebugIds||{},e._sentryDebugIds[n]="4bf6db83-d4a9-55d7-a688-ef18f13fcb91")}catch(e){}}();
import express from 'express';
import { z } from 'zod';
import { connectFranken } from '../../8sleep/frankenServer.js';
import { DeviceStatusSchema } from './deviceStatusSchema.js';
import logger from '../../logger.js';
import { updateDeviceStatus } from './updateDeviceStatus.js';
const router = express.Router();
router.get('/deviceStatus', async (req, res) => {
    const franken = await connectFranken();
    const resp = await franken.getDeviceStatus();
    res.json(resp);
});
// Debugging aid: the firmware's unparsed status text, to see what a Pod reports beyond what Free Sleep reads
router.get('/deviceStatus/raw', async (req, res) => {
    const franken = await connectFranken();
    res.type('text/plain').send(await franken.getRawDeviceStatus());
});
router.post('/deviceStatus', async (req, res) => {
    const { body } = req;
    const validationResult = DeviceStatusSchema.deepPartial().safeParse(body);
    if (!validationResult.success) {
        logger.error('Invalid device status update:', validationResult.error);
        res.status(400).json({
            error: 'Invalid request data',
            details: validationResult?.error?.errors,
        });
        return;
    }
    await updateDeviceStatus(body);
    res.status(204).end();
});
// The stock app's -10..+10 scale: each step is 10 firmware levels, which Free Sleep treats as 2.75°F
const DIAL_CENTER_F = 82.5;
const DIAL_STEP_F = 2.75;
const DialSchema = z.object({
    side: z.enum(['left', 'right', 'both']),
    dial: z.number().min(-10).max(10),
}).strict();
// Turns a side on at a setting from -10 (coldest) to +10 (hottest) with one short request.
// Made for phone shortcuts, so they need no temperature arithmetic.
router.post('/deviceStatus/dial', async (req, res) => {
    const validationResult = DialSchema.safeParse(req.body);
    if (!validationResult.success) {
        res.status(400).json({ error: 'Invalid request data', details: validationResult.error.errors });
        return;
    }
    const { side, dial } = validationResult.data;
    const sideStatus = { isOn: true, targetTemperatureF: DIAL_CENTER_F + dial * DIAL_STEP_F };
    const sides = side === 'both' ? ['left', 'right'] : [side];
    await updateDeviceStatus(Object.fromEntries(sides.map(dialSide => [dialSide, sideStatus])));
    res.status(200).json({ sides, dial, targetTemperatureF: sideStatus.targetTemperatureF });
});
export default router;
//# sourceMappingURL=deviceStatus.js.map
//# debugId=4bf6db83-d4a9-55d7-a688-ef18f13fcb91
