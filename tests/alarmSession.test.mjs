// Run with Node 24: node --test tests/alarmSession.test.mjs
import assert from 'node:assert/strict';
import { beforeEach, mock, test } from 'node:test';
import { createAlarmSession, handleAlarmGesture, planAlarmStretch } from '../server/src/jobs/alarmSession.ts';

const leftAlarm = { side: 'left', vibrationIntensity: 80, duration: 30, vibrationPattern: 'rise' };
const dismissTap = { type: 'alarm', behavior: 'dismiss', snoozeDuration: 120, inactiveAlarmBehavior: 'power' };
// Saved by older versions; treated as dismiss
const snoozeTap = { ...dismissTap, behavior: 'snooze' };

// Lets timer callbacks that end in un-awaited promises finish
const flushPromises = () => new Promise(resolve => setImmediate(resolve));

// Builds a session whose Pod calls are recorded instead of sent to Franken
function createTestSession() {
  const vibrating = { left: false, right: false };
  const startedAlarms = [];
  const session = createAlarmSession({
    startAlarm: async (alarmJob) => {
      startedAlarms.push(alarmJob);
      await session.alarmStarted(alarmJob, alarmJob.duration);
    },
    setAlarmVibrating: async (side, isAlarmVibrating) => {
      vibrating[side] = isAlarmVibrating;
    },
    logDebug: () => {},
  });
  return { session, vibrating, startedAlarms };
}

// Wires handleAlarmGesture to a test session the way frankenMonitor wires it to the Pod
function createGestureDeps({ session, vibrating }, side, isSideOn = true) {
  const powerCalls = [];
  const deps = {
    isAlarmVibrating: vibrating[side],
    isSideOn,
    dismissAlarm: () => session.alarmCleared(side),
    setPower: async (isOn) => {
      powerCalls.push(isOn);
    },
  };
  return { deps, powerCalls };
}

beforeEach(() => {
  mock.timers.reset();
  mock.timers.enable({ apis: ['setTimeout'] });
});

test('the vibrating flag clears when the alarm duration ends', async () => {
  const { session, vibrating } = createTestSession();
  await session.alarmStarted(leftAlarm, 30);
  assert.equal(vibrating.left, true);
  mock.timers.tick(29_999);
  assert.equal(vibrating.left, true);
  mock.timers.tick(1);
  assert.equal(vibrating.left, false);
});

test('a dismiss tap clears the alarm and schedules nothing', async () => {
  const testSession = createTestSession();
  await testSession.session.alarmStarted(leftAlarm, 30);
  const { deps, powerCalls } = createGestureDeps(testSession, 'left');

  assert.equal(await handleAlarmGesture(dismissTap, deps), 'dismissed');
  assert.equal(testSession.vibrating.left, false);
  mock.timers.tick(600_000);
  assert.deepEqual(testSession.startedAlarms, []);
  assert.deepEqual(powerCalls, []);
});

test('a tap saved as snooze dismisses, and the alarm does not come back', async () => {
  const testSession = createTestSession();
  await testSession.session.alarmStarted(leftAlarm, 30);
  assert.equal(await handleAlarmGesture(snoozeTap, createGestureDeps(testSession, 'left').deps), 'dismissed');
  mock.timers.tick(600_000);
  assert.deepEqual(testSession.startedAlarms, []);
  assert.equal(testSession.vibrating.left, false);
});

test('with no alarm vibrating the tap toggles power only when configured', async () => {
  const testSession = createTestSession();
  const whenOn = createGestureDeps(testSession, 'left', true);
  assert.equal(await handleAlarmGesture(dismissTap, whenOn.deps), 'power');
  assert.deepEqual(whenOn.powerCalls, [false]);

  const whenOff = createGestureDeps(testSession, 'left', false);
  assert.equal(await handleAlarmGesture(snoozeTap, whenOff.deps), 'power');
  assert.deepEqual(whenOff.powerCalls, [true]);

  const disabled = createGestureDeps(testSession, 'left', true);
  assert.equal(await handleAlarmGesture({ ...dismissTap, inactiveAlarmBehavior: 'none' }, disabled.deps), 'none');
  assert.deepEqual(disabled.powerCalls, []);
});

test('clearing reports the alarm only when one was actually vibrating', async () => {
  const session = createAlarmSession({ startAlarm: async () => {}, setAlarmVibrating: async () => {}, logDebug: () => {} });
  assert.equal(await session.alarmCleared('left'), undefined);
  const alarmJob = { side: 'left', vibrationIntensity: 50, vibrationPattern: 'rise', duration: 30, turnOffAfterDismiss: true };
  await session.alarmStarted(alarmJob, 30);
  assert.deepEqual(await session.alarmCleared('left'), alarmJob);
  // Already cleared: a second clear is not a second dismissal
  assert.equal(await session.alarmCleared('left'), undefined);
});

test('a long alarm carries on in stretches until it is dismissed', async () => {
  mock.timers.reset();
  mock.timers.enable({ apis: ['setTimeout'] });
  const started = [];
  const flags = [];
  let session;
  session = createAlarmSession({
    // Stands in for the scheduler: every stretch reports back, the last one has no continuation
    startAlarm: async (alarmJob, options) => {
      started.push([alarmJob.duration, options?.isContinuation]);
      await session.alarmStarted(alarmJob, 180, { isContinuation: true });
    },
    setAlarmVibrating: async (side, isAlarmVibrating) => { flags.push(isAlarmVibrating); },
    logDebug: () => {},
  });
  const alarmJob = { side: 'left', vibrationIntensity: 100, vibrationPattern: 'rise', duration: 600 };
  const continuation = { ...alarmJob, duration: 420, vibrationPattern: 'double' };

  await session.alarmStarted(alarmJob, 180, { continuation });
  mock.timers.tick(180_000);
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(started, [[420, true]]);
  // Still vibrating across the hand-over, and the alarm on record is the original one
  assert.equal(flags.includes(false), false);
  assert.deepEqual(await session.alarmCleared('left'), alarmJob);

  // Dismissed: the chain stops
  mock.timers.tick(600_000);
  assert.equal(started.length, 1);
  mock.timers.reset();
});

test('an alarm stopped by the other side\'s dismissal starts again, and a finished one does not', async () => {
  const testSession = createTestSession();
  const rightAlarm = { ...leftAlarm, side: 'right' };
  await testSession.session.alarmStarted(leftAlarm, 30);
  await testSession.session.alarmStarted(rightAlarm, 30);

  // Left dismisses; the firmware stops both, so right is started again
  await testSession.session.alarmCleared('left');
  assert.equal(await testSession.session.restartIfVibrating('right'), true);
  assert.deepEqual(testSession.startedAlarms, [rightAlarm]);
  assert.equal(testSession.vibrating.right, true);
  assert.equal(testSession.vibrating.left, false);

  // Nothing going off on the left any more: nothing to restart
  assert.equal(await testSession.session.restartIfVibrating('left'), false);
  mock.timers.tick(30_000);
  await flushPromises();
  assert.equal(await testSession.session.restartIfVibrating('right'), false);
  assert.equal(testSession.startedAlarms.length, 1);
});

test('a ramp-up alarm climbs in short steps, then runs at full strength in long stretches', () => {
  const alarmJob = { side: 'left', vibrationIntensity: 100, vibrationPattern: 'rise', duration: 600 };
  const stretches = [];
  let nextJob = alarmJob;
  while (nextJob) {
    const { strength, seconds, continuation } = planAlarmStretch(nextJob, 180);
    stretches.push([strength, seconds]);
    nextJob = continuation;
  }
  assert.deepEqual(stretches, [[20, 10], [40, 10], [60, 10], [80, 10], [100, 180], [100, 180], [100, 180], [100, 20]]);
  assert.equal(stretches.reduce((total, [, seconds]) => total + seconds, 0), 600);
});

test('pulses do not ramp, a weaker alarm ramps to its own strength, and a short one still runs', () => {
  const pulses = planAlarmStretch({ side: 'left', vibrationIntensity: 80, vibrationPattern: 'double', duration: 200 }, 180);
  assert.deepEqual([pulses.strength, pulses.seconds, pulses.continuation.duration], [80, 180, 20]);

  const gentle = planAlarmStretch({ side: 'left', vibrationIntensity: 50, vibrationPattern: 'rise', duration: 300 }, 180);
  assert.deepEqual([gentle.strength, gentle.seconds, gentle.continuation.rampStep], [10, 10, 1]);

  const short = planAlarmStretch({ side: 'left', vibrationIntensity: 100, vibrationPattern: 'rise', duration: 5 }, 180);
  assert.deepEqual([short.strength, short.seconds, short.continuation], [100, 10, undefined]);
});
