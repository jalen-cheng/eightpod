import express, { Request, Response } from 'express';
import { getAutopilotSnapshot } from '../../autopilot/autopilotMonitor.js';

const router = express.Router();

// What the autopilot sees and has done: each side's sleep state, heart rate and current offset,
// the room, and what it has learned from corrections
router.get('/autopilot', (_req: Request, res: Response) => {
  res.json(getAutopilotSnapshot());
});

export default router;
