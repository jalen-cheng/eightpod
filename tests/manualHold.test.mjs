// Run with Node 24: node --test tests/manualHold.test.mjs
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cancelManualHold, isManualHoldActive, startManualHold } from '../server/src/jobs/manualHold.ts';

test('a hold lasts as long as the side was switched on for, per side, and can be ended early', () => {
  const startedAtMs = 1_000_000;
  assert.equal(isManualHoldActive('left', startedAtMs), false);
  startManualHold('left', 3 * 3600, startedAtMs);
  assert.equal(isManualHoldActive('left', startedAtMs + 3 * 3600 * 1000 - 1), true);
  assert.equal(isManualHoldActive('left', startedAtMs + 3 * 3600 * 1000), false);
  assert.equal(isManualHoldActive('right', startedAtMs + 1), false);

  startManualHold('right', 60, startedAtMs);
  cancelManualHold('right');
  assert.equal(isManualHoldActive('right', startedAtMs + 1), false);
});
