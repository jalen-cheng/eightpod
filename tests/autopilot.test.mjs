// Run with Node 24: node --test tests/autopilot.test.mjs
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  HEART_RATE_WINDOW_SECONDS, PIEZO_SAMPLES_PER_SECOND, countMovementSeconds, estimateHeartRate, measureSwing,
} from '../server/src/autopilot/heartRate.ts';
import { createSleepTracker } from '../server/src/autopilot/sleepTracker.ts';
import {
  MAX_OFFSET_F, NO_LEARNED_OFFSETS, curveOffsetF, learnFromCorrection, nightPartAt, planTemperature, surroundingsOffsetF,
} from '../server/src/autopilot/nightPlan.ts';
import { findScheduledTemperatureF } from '../server/src/autopilot/scheduledBase.ts';

// A made-up piezo signal: a short 7 Hz knock at every heartbeat, over slow breathing and noise
const makeHeartbeatSignal = (beatsPerMinute, seconds = HEART_RATE_WINDOW_SECONDS) => {
  const samples = [];
  const beatSeconds = 60 / beatsPerMinute;
  let seed = 7;
  const random = () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648 - 0.5;
  };
  for (let index = 0; index < seconds * PIEZO_SAMPLES_PER_SECOND; index++) {
    const time = index / PIEZO_SAMPLES_PER_SECOND;
    const sinceBeat = time % beatSeconds;
    const knock = Math.exp(-sinceBeat * 12) * Math.sin(2 * Math.PI * 7 * sinceBeat);
    const breathing = 0.8 * Math.sin(2 * Math.PI * 0.25 * time);
    samples.push(Math.round(-45000 + 400000 * knock + 300000 * breathing + 20000 * random()));
  }
  return samples;
};

test('heart rate is read from a knocking signal, at rest and faster', () => {
  for (const beatsPerMinute of [52, 60, 68, 84]) {
    const estimate = estimateHeartRate(makeHeartbeatSignal(beatsPerMinute));
    assert.ok(estimate, `an estimate for ${beatsPerMinute}`);
    assert.ok(Math.abs(estimate.beatsPerMinute - beatsPerMinute) <= 3, `${beatsPerMinute} read as ${estimate.beatsPerMinute}`);
    assert.ok(estimate.confidence >= 0.45, `confidence ${estimate.confidence}`);
  }
});

test('a flat or too-short signal gives no heart rate', () => {
  assert.equal(estimateHeartRate(new Array(7500).fill(-45000)), undefined);
  assert.equal(estimateHeartRate(makeHeartbeatSignal(60, 2)), undefined);
});

test('seconds with a swing far above the usual count as movement', () => {
  const still = new Array(55).fill(1_500_000);
  assert.equal(countMovementSeconds([...still, 9_000_000, 12_000_000, 2_000_000, 1_400_000, 8_000_000]), 3);
  assert.equal(countMovementSeconds(still), 0);
  assert.equal(measureSwing([-5, 3, 10, -2]), 15);
});

// Feeds a tracker the same minute `count` times and returns the last state
const addMinutes = (tracker, count, minute) => {
  let state;
  for (let index = 0; index < count; index++) state = tracker.addMinute(minute);
  return state;
};

test('a sleeper goes from awake to asleep, and back to awake when restless', () => {
  const tracker = createSleepTracker();
  // Settling: a normal heart rate and some movement
  assert.equal(addMinutes(tracker, 12, { isInBed: true, heartRate: 66, movementSeconds: 6 }).stage, 'awake');
  // Still, and the heart a little slower: asleep after ten such minutes
  assert.equal(addMinutes(tracker, 9, { isInBed: true, heartRate: 62, movementSeconds: 1 }).stage, 'awake');
  assert.equal(addMinutes(tracker, 1, { isInBed: true, heartRate: 62, movementSeconds: 1 }).stage, 'asleep');
  // However slow and steady the heart, the stage stays "asleep": deep sleep is not detected
  const later = addMinutes(tracker, 30, { isInBed: true, heartRate: 56, movementSeconds: 0 });
  assert.equal(later.stage, 'asleep');
  assert.equal(later.settlingHeartRate, 66);
  assert.equal(later.minutesAsleep, 30);
  // One turn in bed does not end sleep; three restless minutes do
  assert.equal(addMinutes(tracker, 1, { isInBed: true, heartRate: 60, movementSeconds: 8 }).stage, 'asleep');
  assert.equal(addMinutes(tracker, 3, { isInBed: true, heartRate: 70, movementSeconds: 20 }).stage, 'awake');
  // Getting out starts over
  assert.deepEqual(tracker.addMinute({ isInBed: false, movementSeconds: 0 }), { stage: 'out', minutesInBed: 0 });
});

test('with no heart rate, long stillness alone counts as asleep', () => {
  const tracker = createSleepTracker();
  assert.equal(addMinutes(tracker, 19, { isInBed: true, movementSeconds: 0 }).stage, 'awake');
  assert.equal(addMinutes(tracker, 1, { isInBed: true, movementSeconds: 0 }).stage, 'asleep');
  assert.equal(addMinutes(tracker, 60, { isInBed: true, movementSeconds: 0 }).stage, 'asleep');
});

test('the night curve cools early, returns by late night and ends a degree warm', () => {
  assert.equal(curveOffsetF(0), 0);
  assert.equal(curveOffsetF(0.05), -1);
  assert.equal(curveOffsetF(0.3), -2);
  assert.equal(curveOffsetF(0.85), 0);
  assert.equal(curveOffsetF(1), 1);
  assert.equal(curveOffsetF(1.4), 1);
  assert.equal(curveOffsetF(-1), 0);
});

test('a correction is half-remembered for its part of the night, within a limit', () => {
  assert.equal(nightPartAt(0.2), 'early');
  assert.equal(nightPartAt(0.5), 'middle');
  assert.equal(nightPartAt(0.9), 'late');
  let learned = learnFromCorrection(NO_LEARNED_OFFSETS, 'early', 2);
  assert.deepEqual(learned, { early: 1, middle: 0, late: 0 });
  for (let night = 0; night < 10; night++) learned = learnFromCorrection(learned, 'early', 2);
  assert.equal(learned.early, 3);
  assert.equal(learnFromCorrection(learned, 'late', -1).late, -0.5);
});

test('a warmer room cools the bed, and a clear drift of the mattress adds a degree', () => {
  assert.equal(surroundingsOffsetF({ roomF: 68 }, { roomF: 70 }), -1);
  assert.equal(surroundingsOffsetF({ roomF: 68 }, { roomF: 66 }), 1);
  assert.equal(surroundingsOffsetF({ roomF: 68, surfaceF: 84 }, { roomF: 68, surfaceF: 87 }), -1);
  assert.equal(surroundingsOffsetF({ roomF: 68, surfaceF: 84 }, { roomF: 68, surfaceF: 85 }), 0);
  // Never more than two degrees, and nothing without a reading to compare
  assert.equal(surroundingsOffsetF({ roomF: 60 }, { roomF: 80 }), -2);
  assert.equal(surroundingsOffsetF({}, { roomF: 80 }), 0);
});

test('the plan adds the parts up, only for someone asleep, and stays within its limit', () => {
  const base = {
    baseTemperatureF: 80, learned: NO_LEARNED_OFFSETS, correctionTonightF: 0,
    surroundingsAtSleepOnset: { roomF: 68 }, surroundingsNow: { roomF: 68 },
  };
  // Awake: the base, whatever the hour
  assert.equal(planTemperature({ ...base, stage: 'awake', progress: 0.3 }).targetTemperatureF, 80);
  // Asleep in the first half: the curve's two degrees
  assert.equal(planTemperature({ ...base, stage: 'asleep', progress: 0.3 }).targetTemperatureF, 78);
  // From 20 to 90 minutes after falling asleep, where deep sleep usually falls: one more
  const deep = planTemperature({ ...base, stage: 'asleep', progress: 0.3, minutesSinceSleepOnset: 45 });
  assert.equal(deep.targetTemperatureF, 77);
  assert.deepEqual(deep.parts, { curveF: -2, deepF: -1, learnedF: 0, correctionF: 0, surroundingsF: 0 });
  for (const [minutes, expected] of [[19, 78], [20, 77], [89, 77], [90, 78]]) {
    assert.equal(planTemperature({ ...base, stage: 'asleep', progress: 0.3, minutesSinceSleepOnset: minutes }).targetTemperatureF, expected);
  }
  // Awake in that stretch: still the base
  assert.equal(planTemperature({ ...base, stage: 'awake', progress: 0.3, minutesSinceSleepOnset: 45 }).targetTemperatureF, 80);
  // A correction by hand tonight is kept in full
  assert.equal(planTemperature({ ...base, stage: 'asleep', progress: 0.3, correctionTonightF: 3 }).targetTemperatureF, 81);
  // Everything pulling one way stops at the limit
  const cold = planTemperature({
    ...base, stage: 'asleep', progress: 0.3, minutesSinceSleepOnset: 45, learned: { early: -3, middle: 0, late: 0 },
    surroundingsNow: { roomF: 74 },
  });
  assert.equal(cold.offsetF, -MAX_OFFSET_F);
  assert.equal(cold.targetTemperatureF, 76);
  // The bed's own range holds too
  assert.equal(planTemperature({ ...base, baseTemperatureF: 56, stage: 'asleep', progress: 0.3, minutesSinceSleepOnset: 45 }).targetTemperatureF, 55);
});

test('the base is the bed-on temperature until a scheduled change comes up, across midnight', () => {
  const night = { power: { on: '22:00', off: '07:30', enabled: true, onTemperature: 82 }, temperatures: { '01:00': 70, '05:30': 76 } };
  assert.equal(findScheduledTemperatureF(night, '23:30'), 82);
  assert.equal(findScheduledTemperatureF(night, '01:00'), 70);
  assert.equal(findScheduledTemperatureF(night, '04:00'), 70);
  assert.equal(findScheduledTemperatureF(night, '06:45'), 76);
});
