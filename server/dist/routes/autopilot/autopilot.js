
!function(){try{var e="undefined"!=typeof window?window:"undefined"!=typeof global?global:"undefined"!=typeof globalThis?globalThis:"undefined"!=typeof self?self:{},n=(new e.Error).stack;n&&(e._sentryDebugIds=e._sentryDebugIds||{},e._sentryDebugIds[n]="bc6b69b8-fdb8-5b2b-9b4d-033f07248509")}catch(e){}}();
import express from 'express';
import { getAutopilotSnapshot } from '../../autopilot/autopilotMonitor.js';
const router = express.Router();
// What the autopilot sees and has done: each side's sleep state, heart rate and current offset,
// the room, and what it has learned from corrections
router.get('/autopilot', (_req, res) => {
    res.json(getAutopilotSnapshot());
});
export default router;
//# sourceMappingURL=autopilot.js.map
//# debugId=bc6b69b8-fdb8-5b2b-9b4d-033f07248509
