// Remembers, per side, when a one-time alarm last went off. When it does, the bed's own timer is
// set to switch the side off 30 minutes later, so the schedule's power-off job must leave the
// side alone until then: otherwise an alarm moved a few minutes later would have its bed
// switched off at the old off time, while it is still vibrating.
// Kept in memory. Keep this file free of runtime imports so tests can load it without a Pod.
import type { Side } from '../db/schedulesSchema.js';

const firedAtMs: Record<Side, number> = { left: 0, right: 0 };

export function markOneOffAlarmFired(side: Side, nowMs: number = Date.now()) {
  firedAtMs[side] = nowMs;
}

// True when the side's one-time alarm went off no longer than `withinMs` ago
export function didOneOffAlarmFireWithin(side: Side, withinMs: number, nowMs: number = Date.now()): boolean {
  return firedAtMs[side] > 0 && nowMs - firedAtMs[side] <= withinMs;
}

// For tests and for a side that was switched off by hand
export function forgetOneOffAlarm(side: Side) {
  firedAtMs[side] = 0;
}
