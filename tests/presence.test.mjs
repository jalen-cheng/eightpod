// Run with Node 24: node --test tests/presence.test.mjs
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createPresenceDetector } from '../server/src/8sleep/presenceDetector.ts';
import {
  SESSION_GAP_MS, createBedSession, isInTurnOnWindow, takeDueActions, trackBedSession,
} from '../server/src/jobs/presenceActions.ts';

const EMPTY = { out: 1100, cen: 1350, in: 1420 };
const OCCUPIED = { out: 1300, cen: 1600, in: 1650 };
const DELTA = 150;
const HOUR_MS = 3_600_000;

// Feeds one reading every half second for a number of seconds; returns the last estimate
function feed(detector, reading, startMs, seconds) {
  let estimate;
  for (let step = 0; step <= seconds * 2; step++) estimate = detector.update(reading, startMs + step * 500, DELTA);
  return estimate;
}

test('someone is in bed after a sustained rise, and out after a sustained drop', () => {
  const detector = createPresenceDetector();
  assert.equal(feed(detector, EMPTY, 0, 60).present, false);
  // A few seconds of pressure (a hand, a bag) is not someone getting in
  assert.equal(feed(detector, OCCUPIED, 60_000, 8).present, false);
  assert.equal(feed(detector, EMPTY, 70_000, 30).present, false);
  assert.equal(feed(detector, OCCUPIED, 100_000, 60).present, true);
  // Turning over (a short dip) does not count as getting out; a minute empty does
  assert.equal(feed(detector, EMPTY, 160_000, 20).present, true);
  assert.equal(feed(detector, OCCUPIED, 180_000, 20).present, true);
  assert.equal(feed(detector, EMPTY, 200_000, 90).present, false);
});

test('the empty level is learned, follows slow drift, and never learns a sleeper as empty', () => {
  const detector = createPresenceDetector();
  feed(detector, EMPTY, 0, 30);
  // The whole bed reads a little higher as it warms: still empty, and the baseline follows
  const drifted = { out: 1120, cen: 1370, in: 1440 };
  const afterDrift = feed(detector, drifted, 30_000, 3600);
  assert.equal(afterDrift.present, false);
  assert.ok(afterDrift.baseline > 3900, `baseline ${afterDrift.baseline} did not follow the drift`);
  // Hours in bed leave the baseline where it was
  const asleep = feed(detector, OCCUPIED, 3_700_000, 3600);
  assert.equal(asleep.present, true);
  assert.ok(Math.abs(asleep.baseline - afterDrift.baseline) < 1);
});

test('a detector started with someone in bed corrects itself when they get out', () => {
  const detector = createPresenceDetector();
  assert.equal(feed(detector, OCCUPIED, 0, 60).present, false);
  feed(detector, EMPTY, 60_000, 30);
  assert.equal(feed(detector, OCCUPIED, 90_000, 60).present, true);
});

test('a stay in bed bridges short gaps and ends after a long one', () => {
  const session = createBedSession();
  trackBedSession(session, true, 0);
  trackBedSession(session, false, 5 * 60_000);
  assert.equal(session.inBedSinceMs, 0);
  trackBedSession(session, true, 10 * 60_000);
  trackBedSession(session, false, 10 * 60_000 + SESSION_GAP_MS);
  assert.equal(session.inBedSinceMs, undefined);
});

test('the evening window runs from the chosen time to six the next morning', () => {
  assert.equal(isInTurnOnWindow('21:30', '21:00'), true);
  assert.equal(isInTurnOnWindow('02:00', '21:00'), true);
  assert.equal(isInTurnOnWindow('14:00', '21:00'), false);
  assert.equal(isInTurnOnWindow('06:00', '21:00'), false);
  assert.equal(isInTurnOnWindow('01:30', '01:00'), true);
  assert.equal(isInTurnOnWindow('23:00', '01:00'), false);
});

test('each action runs once per stay, and only when its conditions hold', () => {
  const settings = {
    sensitivity: 'medium',
    wakeAfterHours: { enabled: true, hours: 9 },
    turnOnWhenInBed: { enabled: true, after: '21:00', hours: 8 },
  };
  const session = trackBedSession(createBedSession(), true, 0);
  const at = (nowMs, overrides = {}) => ({ nowMs, clockTime: '22:00', isPresentNow: true, isOn: false, ...overrides });

  assert.deepEqual(takeDueActions(session, settings, at(10_000)), ['turnOn']);
  assert.deepEqual(takeDueActions(session, settings, at(20_000)), []);
  assert.deepEqual(takeDueActions(session, settings, at(9 * HOUR_MS - 1, { isOn: true })), []);
  assert.deepEqual(takeDueActions(session, settings, at(9 * HOUR_MS, { isOn: true })), ['wake']);
  assert.deepEqual(takeDueActions(session, settings, at(10 * HOUR_MS, { isOn: true })), []);

  // An afternoon nap does not turn the bed on; a bed that is already on is left alone
  const nap = trackBedSession(createBedSession(), true, 0);
  assert.deepEqual(takeDueActions(nap, settings, at(10_000, { clockTime: '15:00' })), []);
  const alreadyOn = trackBedSession(createBedSession(), true, 0);
  assert.deepEqual(takeDueActions(alreadyOn, settings, at(10_000, { isOn: true })), []);

  // Switched off in settings: nothing
  const off = { ...settings, wakeAfterHours: { enabled: false, hours: 9 }, turnOnWhenInBed: { enabled: false, after: '21:00', hours: 8 } };
  assert.deepEqual(takeDueActions(trackBedSession(createBedSession(), true, 0), off, at(20 * HOUR_MS)), []);
});
