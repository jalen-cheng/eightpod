// Tracks, per side, whether the bed is warming up ahead of an alarm.
// While it is, scheduled temperature changes are skipped so they do not undo the warm-up.
// Keep this file free of runtime imports so tests can load it without a Pod environment.
import type { Side } from '../db/schedulesSchema.js';

const MS_PER_MINUTE = 60_000;
const preWarmEndsAtMs: Record<Side, number> = { left: 0, right: 0 };

// Marks a side as warming up for the next `minutes`, i.e. until its alarm time
export function startPreWarm(side: Side, minutes: number, nowMs: number = Date.now()) {
  preWarmEndsAtMs[side] = nowMs + minutes * MS_PER_MINUTE;
}

export function isPreWarmActive(side: Side, nowMs: number = Date.now()): boolean {
  return nowMs < preWarmEndsAtMs[side];
}

// Ends a warm-up early, e.g. when the side is switched off
export function cancelPreWarm(side: Side) {
  preWarmEndsAtMs[side] = 0;
}
