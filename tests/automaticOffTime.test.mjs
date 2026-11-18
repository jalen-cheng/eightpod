// Run with Node 24: node --test tests/automaticOffTime.test.mjs
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { addMinutesToTime, adoptSavedOffTime, applyAutomaticOffTime, isNightLengthValid, offTimeAfterAlarm } from '../server/src/db/automaticOffTime.ts';

test('minutes are added to a time of day, wrapping past midnight', () => {
  assert.equal(addMinutesToTime('08:45', 30), '09:15');
  assert.equal(addMinutesToTime('23:45', 30), '00:15');
  assert.equal(addMinutesToTime('00:10', -30), '23:40');
});

test('on every write the bed turns off 30 minutes after the wake-up time, alarm or not', () => {
  assert.equal(offTimeAfterAlarm('06:30'), '07:00');
  const withAlarm = { alarm: { enabled: true, time: '08:45' }, power: { off: '10:00' } };
  assert.equal(applyAutomaticOffTime(withAlarm).power.off, '09:15');
  // A wake-up time set while the alarm is off is kept, and moves the off time
  const withoutAlarm = { alarm: { enabled: false, time: '07:00' }, power: { off: '10:00' } };
  assert.deepEqual(applyAutomaticOffTime(withoutAlarm), { alarm: { enabled: false, time: '07:00' }, power: { off: '07:30' } });
});

test('a night saved without an alarm keeps its off time when first loaded, once', () => {
  const saved = { alarm: { enabled: false, time: '08:45' }, power: { off: '10:00' } };
  assert.deepEqual(adoptSavedOffTime(saved), { alarm: { enabled: false, time: '09:30' }, power: { off: '10:00' } });
  assert.deepEqual(adoptSavedOffTime(saved), { alarm: { enabled: false, time: '09:30' }, power: { off: '10:00' } });
  const withAlarm = { alarm: { enabled: true, time: '08:45' }, power: { off: '10:00' } };
  assert.equal(adoptSavedOffTime(withAlarm).power.off, '09:15');
});

test('the server and the app refuse the same nights', () => {
  assert.equal(isNightLengthValid('22:00', '07:00'), true);
  assert.equal(isNightLengthValid('22:00', '23:00'), true);
  assert.equal(isNightLengthValid('22:00', '21:00'), true);
  // Under an hour, and over 23 hours: the off time would land before the next bed-on time
  assert.equal(isNightLengthValid('22:00', '22:30'), false);
  assert.equal(isNightLengthValid('22:00', '21:50'), false);
  assert.equal(isNightLengthValid('22:00', '7am'), false);
});
