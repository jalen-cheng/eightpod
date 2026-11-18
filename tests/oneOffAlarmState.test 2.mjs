// Run with Node 24: node --test tests/oneOffAlarmState.test.mjs
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { didOneOffAlarmFireWithin, forgetOneOffAlarm, markOneOffAlarmFired } from '../server/src/jobs/oneOffAlarmState.ts';

const THIRTY_MINUTES_MS = 30 * 60_000;

test('the schedule stands back for 30 minutes after a one-time alarm goes off', () => {
  const firedAtMs = 1_000_000_000;
  assert.equal(didOneOffAlarmFireWithin('left', THIRTY_MINUTES_MS, firedAtMs), false);
  markOneOffAlarmFired('left', firedAtMs);
  // The scheduled off time 15 minutes after an alarm moved 15 minutes later
  assert.equal(didOneOffAlarmFireWithin('left', THIRTY_MINUTES_MS, firedAtMs + 15 * 60_000), true);
  assert.equal(didOneOffAlarmFireWithin('left', THIRTY_MINUTES_MS, firedAtMs + 31 * 60_000), false);
  // The other side is not affected
  assert.equal(didOneOffAlarmFireWithin('right', THIRTY_MINUTES_MS, firedAtMs + 60_000), false);
  forgetOneOffAlarm('left');
  assert.equal(didOneOffAlarmFireWithin('left', THIRTY_MINUTES_MS, firedAtMs + 60_000), false);
});
