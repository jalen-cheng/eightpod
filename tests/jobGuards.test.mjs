// Run with Node 24: node --test tests/jobGuards.test.mjs
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isSomeoneInBed, registerInBedCheck } from '../server/src/jobs/inBedCheck.ts';
import { shouldRunJob } from '../server/src/jobs/recentRuns.ts';

const TWO_HOURS_MS = 2 * 60 * 60_000;

test('a job the clock offers twice in two hours runs once', () => {
  const firstRunMs = 1_800_000_000_000;
  assert.equal(shouldRunJob('left-sunday-01:30-alarm', TWO_HOURS_MS, firstRunMs), true);
  // An hour later the clocks have gone back and it is 01:30 again
  assert.equal(shouldRunJob('left-sunday-01:30-alarm', TWO_HOURS_MS, firstRunMs + 60 * 60_000), false);
  // The other side's alarm is its own job
  assert.equal(shouldRunJob('right-sunday-01:30-alarm', TWO_HOURS_MS, firstRunMs + 60 * 60_000), true);
  // A week later it runs again
  assert.equal(shouldRunJob('left-sunday-01:30-alarm', TWO_HOURS_MS, firstRunMs + 7 * 24 * 60 * 60_000), true);
});

test('nobody is taken to be in bed until the sensors say so', () => {
  registerInBedCheck(undefined);
  assert.equal(isSomeoneInBed('left'), false);
  registerInBedCheck(side => side === 'left');
  assert.equal(isSomeoneInBed('left'), true);
  assert.equal(isSomeoneInBed('right'), false);
  registerInBedCheck(undefined);
});
