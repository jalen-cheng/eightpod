// Run with Node 24: node --test tests/automaticOffTime.test.mjs
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { addMinutesToTime, applyAutomaticOffTime, offTimeAfterAlarm } from '../server/src/db/automaticOffTime.ts';

test('minutes are added to a time of day, wrapping past midnight', () => {
  assert.equal(addMinutesToTime('08:45', 30), '09:15');
  assert.equal(addMinutesToTime('23:45', 30), '00:15');
  assert.equal(addMinutesToTime('00:10', -30), '23:40');
});

test('the bed turns off 30 minutes after the wake-up time, alarm or not', () => {
  assert.equal(offTimeAfterAlarm('06:30'), '07:00');
  const withAlarm = { alarm: { enabled: true, time: '08:45' }, power: { off: '10:00' } };
  assert.equal(applyAutomaticOffTime(withAlarm).power.off, '09:15');

  // A night saved without an alarm keeps its off time; its wake-up time is taken from it, once
  const withoutAlarm = { alarm: { enabled: false, time: '08:45' }, power: { off: '10:00' } };
  assert.deepEqual(applyAutomaticOffTime(withoutAlarm), { alarm: { enabled: false, time: '09:30' }, power: { off: '10:00' } });
  assert.deepEqual(applyAutomaticOffTime(withoutAlarm), { alarm: { enabled: false, time: '09:30' }, power: { off: '10:00' } });
});
