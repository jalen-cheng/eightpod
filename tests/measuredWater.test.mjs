// Run with Node 24: node --test tests/measuredWater.test.mjs
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getMeasuredWaterF, recordWaterReading, reportedWaterToF } from '../server/src/8sleep/measuredWater.ts';

test('the firmware reports hundredths of a degree Celsius', () => {
  assert.equal(reportedWaterToF(2700), 80.6);
  assert.equal(reportedWaterToF(1000), 50);
});

test('a reading is shown to one decimal, per side, and only while it is recent', () => {
  assert.equal(getMeasuredWaterF('left', 0), undefined);
  recordWaterReading('left', 2139, 1_000);
  assert.equal(getMeasuredWaterF('left', 2_000), 70.5);
  assert.equal(getMeasuredWaterF('right', 2_000), undefined);
  assert.equal(getMeasuredWaterF('left', 1_000 + 60_001), undefined);
});
