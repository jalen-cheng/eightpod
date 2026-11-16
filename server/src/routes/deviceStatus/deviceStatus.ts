import express, { Request, Response } from 'express';
import { z } from 'zod';
import { SideChoiceSchema, resolveSides } from '../sideChoice.js';
import { levelToTemperatureF, temperatureFToLevel } from '../../db/temperatureCurve.js';
import { connectFranken } from '../../8sleep/frankenServer.js';
import { DeviceStatus, DeviceStatusSchema } from './deviceStatusSchema.js';
import logger from '../../logger.js';
import { updateDeviceStatus } from './updateDeviceStatus.js';
import { DeepPartial } from 'ts-essentials';

const router = express.Router();

router.get('/deviceStatus', async (req: Request, res: Response) => {
  const franken = await connectFranken();
  const resp = await franken.getDeviceStatus();
  res.json(resp);
});

// Debugging aid: the firmware's unparsed status text, to see what a Pod reports beyond what Free Sleep reads
router.get('/deviceStatus/raw', async (req: Request, res: Response) => {
  const franken = await connectFranken();
  res.type('text/plain').send(await franken.getRawDeviceStatus());
});


router.post('/deviceStatus', async (req: Request, res: Response) => {
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

  await updateDeviceStatus(body as DeepPartial<DeviceStatus>);
  res.status(204).end();
});

// The stock app's -10..+10 scale: each step is 10 firmware levels
const DialSchema = z.object({
  side: SideChoiceSchema,
  dial: z.number().min(-10).max(10),
}).strict();

const FIRMWARE_LEVELS_PER_DIAL_STEP = 10;
const formatDial = (dial: number) => `${dial > 0 ? '+' : ''}${dial}`;

// What each side is set to and has reached, on the -10..+10 scale, with a sentence a phone
// shortcut can show or speak as it is.
router.get('/deviceStatus/dial', async (req: Request, res: Response) => {
  const franken = await connectFranken();
  const deviceStatus = await franken.getDeviceStatus();
  const describeSide = (side: 'left' | 'right') => {
    const { isOn, targetTemperatureF, currentTemperatureLevel } = deviceStatus[side];
    const targetDial = Math.round(temperatureFToLevel(targetTemperatureF) / FIRMWARE_LEVELS_PER_DIAL_STEP * 2) / 2;
    const currentDial = Math.round(currentTemperatureLevel / FIRMWARE_LEVELS_PER_DIAL_STEP * 2) / 2;
    const summary = isOn ? `set to ${formatDial(targetDial)}, now at ${formatDial(currentDial)}` : 'off';
    return { isOn, targetDial, currentDial, summary };
  };
  const left = describeSide('left');
  const right = describeSide('right');
  const summary = left.summary === right.summary
    ? `Both sides ${left.summary}.`
    : `Left ${left.summary}. Right ${right.summary}.`;
  res.json({ summary, left, right });
});

// Turns a side on at a setting from -10 (coldest) to +10 (hottest) with one short request.
// Made for phone shortcuts, so they need no temperature arithmetic.
router.post('/deviceStatus/dial', async (req: Request, res: Response) => {
  const validationResult = DialSchema.safeParse(req.body);
  if (!validationResult.success) {
    res.status(400).json({ error: 'Invalid request data', details: validationResult.error.errors });
    return;
  }
  const { side, dial } = validationResult.data;
  const sideStatus = { isOn: true, targetTemperatureF: levelToTemperatureF(dial * FIRMWARE_LEVELS_PER_DIAL_STEP) };
  const sides = await resolveSides(side);
  await updateDeviceStatus(Object.fromEntries(sides.map(dialSide => [dialSide, sideStatus])));
  res.status(200).json({ sides, dial, targetTemperatureF: sideStatus.targetTemperatureF });
});


export default router;
