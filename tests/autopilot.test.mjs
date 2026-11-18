// Run with Node 24: node --test tests/autopilot.test.mjs
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  HEART_RATE_WINDOW_SECONDS, PIEZO_SAMPLES_PER_SECOND, countMovementSeconds, estimateHeartRate, measureSwing,
} from '../server/src/autopilot/heartRate.ts';
import {
  MAX_OFFSET_F, NO_LEARNED_OFFSETS, curveOffsetF, learnFromCorrection, nightPartAt, planTemperature, surroundingsOffsetF,
} from '../server/src/autopilot/nightPlan.ts';
import {
  findScheduledTemperatureF, findUsualSleep, isNightExpected, kindOfSleep,
} from '../server/src/autopilot/scheduledBase.ts';
import {
  BREATHING_SAMPLES_PER_SECOND, BREATHING_WINDOW_SECONDS, estimateBreathingRate, measureBreathingSpread,
} from '../server/src/autopilot/breathingRate.ts';
import {
  DEFAULT_SLEEP_RULES, calibrateSleepRules, createSleepTracker, detectSleepTimes, findSleepPeriods, measureRules,
  readHealthExportSleep,
} from '../server/src/autopilot/sleepTracker.ts';

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

test('a sleeper is asleep after lying still, whatever the heart does, and awake again when restless', () => {
  const tracker = createSleepTracker();
  // Settling: some movement every minute
  assert.equal(addMinutes(tracker, 12, { isInBed: true, heartRate: 66, movementSeconds: 6 }).stage, 'awake');
  // Fifteen still minutes: asleep, counted from when the stillness began. The heart rate has
  // not dropped at all and it makes no difference.
  assert.equal(addMinutes(tracker, 14, { isInBed: true, heartRate: 66, movementSeconds: 1 }).stage, 'awake');
  const asleep = addMinutes(tracker, 1, { isInBed: true, heartRate: 66, movementSeconds: 1 });
  assert.equal(asleep.stage, 'asleep');
  assert.equal(asleep.minutesAsleep, 15);
  assert.equal(asleep.heartRate, 66);
  // A turn in bed, even two in a row, does not end sleep; three restless minutes in five do
  assert.equal(addMinutes(tracker, 2, { isInBed: true, movementSeconds: 20 }).stage, 'asleep');
  assert.equal(addMinutes(tracker, 10, { isInBed: true, movementSeconds: 0 }).stage, 'asleep');
  assert.equal(addMinutes(tracker, 3, { isInBed: true, movementSeconds: 20 }).stage, 'awake');
  // Getting out starts over
  assert.deepEqual(tracker.addMinute({ isInBed: false, movementSeconds: 0 }), { stage: 'out', minutesInBed: 0 });
});

test('the rules a tracker is given decide how long stillness has to last', () => {
  const quick = createSleepTracker(() => ({ stillMinutesToSleep: 5, restlessSecondsToWake: 30 }));
  assert.equal(addMinutes(quick, 4, { isInBed: true, movementSeconds: 0 }).stage, 'awake');
  assert.equal(addMinutes(quick, 1, { isInBed: true, movementSeconds: 0 }).stage, 'asleep');
  // Twenty moving seconds is under this tracker's bar for a restless minute
  assert.equal(addMinutes(quick, 5, { isInBed: true, movementSeconds: 20 }).stage, 'asleep');
});

// A made-up stay in bed: restless, then asleep, then up. One row a minute.
const makeStay = ({ restlessMinutes, asleepMinutes, awakeMinutes = 10 }) => [
  ...new Array(restlessMinutes).fill({ isInBed: true, movementSeconds: 8 }),
  ...new Array(asleepMinutes).fill({ isInBed: true, movementSeconds: 0 }),
  ...new Array(awakeMinutes).fill({ isInBed: true, movementSeconds: 40 }),
];

test('a saved stay replays to the minute sleep began and ended', () => {
  const stay = makeStay({ restlessMinutes: 25, asleepMinutes: 400 });
  const detected = detectSleepTimes(stay, DEFAULT_SLEEP_RULES);
  assert.equal(detected.asleepAtMinute, 25);
  // Waking is seen once three restless minutes have passed
  assert.ok(Math.abs(detected.awakeAtMinute - 425) <= 3, `woke at ${detected.awakeAtMinute}`);
  // A stay with no long stillness has no sleep in it
  assert.deepEqual(detectSleepTimes(makeStay({ restlessMinutes: 60, asleepMinutes: 5 }), DEFAULT_SLEEP_RULES), {});
});

test('the longest sleep of a stay is the one reported', () => {
  const stay = [
    ...makeStay({ restlessMinutes: 5, asleepMinutes: 20, awakeMinutes: 15 }),
    ...makeStay({ restlessMinutes: 0, asleepMinutes: 300 }),
  ];
  assert.equal(detectSleepTimes(stay, DEFAULT_SLEEP_RULES).asleepAtMinute, 40);
});

test('calibration picks the rules that land nearest a worn tracker, given enough nights', () => {
  // This sleeper rolls over for a minute every half hour, 15 moving seconds each time, and the
  // worn tracker says they slept through it. They also lie still for 9 minutes before sleep.
  const makeNight = () => {
    const minutes = [...new Array(20).fill({ isInBed: true, movementSeconds: 8 })];
    for (let minute = 0; minute < 420; minute++) {
      const isRolling = minute % 30 >= 27;
      minutes.push({ isInBed: true, movementSeconds: isRolling ? 15 : 0 });
    }
    minutes.push(...new Array(10).fill({ isInBed: true, movementSeconds: 45 }));
    return { minutes, trackerAsleepAtMinute: 20, trackerAwakeAtMinute: 440 };
  };
  // The default rules take three such minutes in a row for waking, and split the night
  const withDefault = measureRules([makeNight()], DEFAULT_SLEEP_RULES);
  assert.ok(withDefault.wakeErrorMinutes > 60, `default rules were off by ${withDefault.wakeErrorMinutes}`);
  // Two nights are too few to change anything
  assert.deepEqual(calibrateSleepRules([makeNight(), makeNight()]).rules, DEFAULT_SLEEP_RULES);
  const calibrated = calibrateSleepRules([makeNight(), makeNight(), makeNight()]);
  assert.equal(calibrated.nights, 3);
  assert.ok(calibrated.rules.restlessSecondsToWake > 15, `restless bar ${calibrated.rules.restlessSecondsToWake}`);
  assert.ok(calibrated.onsetErrorMinutes <= 2 && calibrated.wakeErrorMinutes <= 5, JSON.stringify(calibrated));
});

test('when the default rules already fit, calibration leaves them alone', () => {
  const night = { minutes: makeStay({ restlessMinutes: 25, asleepMinutes: 400 }), trackerAsleepAtMinute: 25, trackerAwakeAtMinute: 425 };
  assert.deepEqual(calibrateSleepRules([night, night, night]).rules, DEFAULT_SLEEP_RULES);
});

test('a health app\'s samples are joined into sleeps, leaving out awake and in-bed ones', () => {
  const at = (hour, minute = 0) => Date.UTC(2026, 10, 18, hour, minute);
  const periods = findSleepPeriods([
    { startMs: at(6), endMs: at(14), value: 'In Bed' },
    { startMs: at(6, 20), endMs: at(8), value: 'Core' },
    { startMs: at(8), endMs: at(8, 10), value: 'Awake' },
    { startMs: at(8, 10), endMs: at(13, 40), value: 'REM' },
    // A nap that afternoon, and a blip too short to count
    { startMs: at(21), endMs: at(21, 40), value: 'Asleep' },
    { startMs: at(23, 30), endMs: at(23, 35) },
  ]);
  assert.deepEqual(periods, [
    { asleepAtMs: at(6, 20), awakeAtMs: at(13, 40) },
    { asleepAtMs: at(21), awakeAtMs: at(21, 40) },
  ]);
});

test('a sleep under three hours is a nap, whenever it happens', () => {
  assert.equal(kindOfSleep(40), 'nap');
  assert.equal(kindOfSleep(179), 'nap');
  assert.equal(kindOfSleep(180), 'night');
  assert.equal(kindOfSleep(450), 'night');
});

const clock = (hour, minute = 0) => hour * 60 + minute;

test('the usual sleep times come from saved nights, with bedtimes either side of midnight', () => {
  assert.equal(findUsualSleep([{ asleepMinutes: clock(23), awakeMinutes: clock(7) }]), undefined);
  const usual = findUsualSleep([
    { asleepMinutes: clock(23, 30), awakeMinutes: clock(7, 10) },
    { asleepMinutes: clock(0, 20), awakeMinutes: clock(7, 40) },
    { asleepMinutes: clock(23, 50), awakeMinutes: clock(6, 50) },
  ]);
  assert.deepEqual(usual, { asleepMinutes: clock(23, 50), awakeMinutes: clock(7, 10) });
});

test('whether a sleep looks like the night goes by habit first, then the schedule, then the hour', () => {
  // The schedule runs the bed from 21:00 to 09:00, but this sleeper sleeps about 01:00 to 08:00
  const night = { power: { on: '21:00', off: '09:30', enabled: true, onTemperature: 82 }, alarm: { time: '09:00' } };
  const usual = { asleepMinutes: clock(1), awakeMinutes: clock(8) };
  assert.equal(isNightExpected('00:40', usual, night), true);
  assert.equal(isNightExpected('04:00', usual, night), true);
  assert.equal(isNightExpected('22:30', usual, night), true);
  // An evening doze inside the schedule's hours, well before this sleeper's nights begin
  assert.equal(isNightExpected('21:15', usual, night), false);
  assert.equal(isNightExpected('14:00', usual, night), false);
  // With no nights saved yet, the schedule decides
  assert.equal(isNightExpected('21:15', undefined, night), true);
  assert.equal(isNightExpected('14:00', undefined, night), false);
  // With neither, the hour does
  assert.equal(isNightExpected('14:00', undefined, undefined), false);
  assert.equal(isNightExpected('23:00', undefined, undefined), true);
});

// A made-up piezo signal: slow breathing swells, with heartbeats, drift and noise on top
const makeBreathingSignal = (breathsPerMinute) => {
  const samples = [];
  let seed = 11;
  const random = () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648 - 0.5;
  };
  for (let index = 0; index < BREATHING_WINDOW_SECONDS * BREATHING_SAMPLES_PER_SECOND; index++) {
    const time = index / BREATHING_SAMPLES_PER_SECOND;
    const breath = Math.sin(2 * Math.PI * breathsPerMinute / 60 * time);
    const heartbeat = 0.15 * Math.sin(2 * Math.PI * 1.1 * time);
    samples.push(Math.round(-45000 + 300000 * breath + 300000 * heartbeat + 2000 * time + 40000 * random()));
  }
  return samples;
};

test('a breathing rate is read from slow swells under heartbeats, drift and noise', () => {
  for (const breathsPerMinute of [10, 13, 16, 20, 24]) {
    const estimate = estimateBreathingRate(makeBreathingSignal(breathsPerMinute));
    assert.ok(estimate, `an estimate for ${breathsPerMinute}`);
    assert.ok(Math.abs(estimate.breathsPerMinute - breathsPerMinute) <= 1, `${breathsPerMinute} read as ${estimate.breathsPerMinute}`);
    assert.ok(estimate.confidence >= 0.4, `confidence ${estimate.confidence}`);
  }
  assert.equal(estimateBreathingRate(new Array(15000).fill(-45000)), undefined);
  assert.equal(estimateBreathingRate(makeBreathingSignal(14).slice(0, 5000)), undefined);
});

test('a minute\'s breathing spread needs three readings', () => {
  assert.equal(measureBreathingSpread([14, 15]), undefined);
  assert.equal(measureBreathingSpread([14, 15.5, 13.5, 14]), 2);
});

test('steady breathing is only asked for when the rules say so', () => {
  const stillButUneven = { isInBed: true, movementSeconds: 0, breathingRate: 16, breathingSpread: 6 };
  // By default stillness is enough
  assert.equal(addMinutes(createSleepTracker(), 15, stillButUneven).stage, 'asleep');
  // With the rule on, uneven breathing holds sleep off until it steadies
  const strict = createSleepTracker(() => ({ ...DEFAULT_SLEEP_RULES, maxBreathingSpread: 2 }));
  assert.equal(addMinutes(strict, 20, stillButUneven).stage, 'awake');
  const steady = addMinutes(strict, 15, { isInBed: true, movementSeconds: 0, breathingRate: 14, breathingSpread: 1 });
  assert.equal(steady.stage, 'asleep');
  assert.equal(steady.breathingRate, 14);
  // And with no breathing readings to judge by, stillness decides again
  const blind = createSleepTracker(() => ({ ...DEFAULT_SLEEP_RULES, maxBreathingSpread: 2 }));
  assert.equal(addMinutes(blind, 15, { isInBed: true, movementSeconds: 0 }).stage, 'asleep');
});

test('calibration turns the breathing rule on when it brings sleep onset closer to the tracker', () => {
  // Lies awake and still for 40 minutes, breathing unevenly, then sleeps
  const night = {
    minutes: [
      ...new Array(40).fill({ isInBed: true, movementSeconds: 0, breathingSpread: 6 }),
      ...new Array(400).fill({ isInBed: true, movementSeconds: 0, breathingSpread: 1 }),
      ...new Array(10).fill({ isInBed: true, movementSeconds: 45 }),
    ],
    trackerAsleepAtMinute: 40,
    trackerAwakeAtMinute: 440,
  };
  assert.equal(measureRules([night], DEFAULT_SLEEP_RULES).onsetErrorMinutes, 40);
  const calibrated = calibrateSleepRules([night, night, night]);
  assert.ok(calibrated.rules.maxBreathingSpread !== undefined, JSON.stringify(calibrated));
  assert.ok(calibrated.onsetErrorMinutes <= 10, JSON.stringify(calibrated));
});

test('an Apple Health export app\'s body is read, one row a night or sample by sample', () => {
  const nightly = readHealthExportSleep({ data: { metrics: [
    { name: 'heart_rate', data: [{ date: '2026-11-18 00:00:00 -0800', qty: 60 }] },
    { name: 'sleep_analysis', data: [{ sleepStart: '2026-11-17 23:00:00 -0800', sleepEnd: '2026-11-18 06:30:00 -0800', source: 'Whoop' }] },
  ] } });
  assert.deepEqual(nightly, [{ startMs: Date.UTC(2026, 10, 18, 7), endMs: Date.UTC(2026, 10, 18, 14, 30), value: undefined }]);
  const samples = readHealthExportSleep({ data: { metrics: [{ name: 'sleep_analysis', data: [
    { start: '2026-11-17 23:00:00 -0800', end: '2026-11-17 23:30:00 -0800', value: 'Core' },
    { startDate: '2026-11-17 23:30:00 -0800', endDate: '2026-11-17 23:40:00 -0800', value: 'Awake' },
    { start: 'nonsense', end: '2026-11-17 23:30:00 -0800', value: 'Core' },
  ] }] } });
  assert.equal(samples.length, 2);
  assert.equal(findSleepPeriods(samples).length, 1);
  // Anything else is not such a body
  assert.equal(readHealthExportSleep({ side: 'left', asleepAt: '2026-11-17T23:00:00-08:00' }), undefined);
  assert.equal(readHealthExportSleep(undefined), undefined);
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
