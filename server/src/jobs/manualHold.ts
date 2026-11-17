// Tracks, per side, whether the bed was switched on by hand with "ignore the schedule" set.
// While it is, the schedule leaves that side alone: no power on or off, no temperature changes,
// no warm-up. The hold ends when the side's timer runs out or the side is switched off. Alarms
// still go off. Kept in memory, so a restart of the server ends a hold early.
// Keep this file free of runtime imports so tests can load it without a Pod environment.
import type { Side } from '../db/schedulesSchema.js';

const MS_PER_SECOND = 1_000;
const holdEndsAtMs: Record<Side, number> = { left: 0, right: 0 };

// Marks a side as held by hand for the next `seconds`, the length it was switched on for
export function startManualHold(side: Side, seconds: number, nowMs: number = Date.now()) {
  holdEndsAtMs[side] = nowMs + seconds * MS_PER_SECOND;
}

export function isManualHoldActive(side: Side, nowMs: number = Date.now()): boolean {
  return nowMs < holdEndsAtMs[side];
}

// Ends a hold, e.g. when the side is switched off
export function cancelManualHold(side: Side) {
  holdEndsAtMs[side] = 0;
}
