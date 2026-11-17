// Run with Node 24: node --test tests/presence.test.mjs
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createPresenceDetector } from '../server/src/8sleep/presenceDetector.ts';
import { SESSION_GAP_MS, createBedSession, takeDueActions, trackBedSession } from '../server/src/jobs/presenceActions.ts';

// As measured on a Pod 5: an empty side near 3,900 in total, a person adding 1,800 or more
const EMPTY = { out: 1100, cen: 1350, in: 1420 };
const OCCUPIED = { out: 2300, cen: 1750, in: 2000 };
const DELTA = 800;
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
  const drifted = { out: 1150, cen: 1400, in: 1460 };
  const afterDrift = feed(detector, drifted, 30_000, 3600);
  assert.equal(afterDrift.present, false);
  assert.ok(afterDrift.baseline > 4000, `baseline ${afterDrift.baseline} did not follow the drift`);
  // Hours in bed leave the baseline where it was
  const asleep = feed(detector, OCCUPIED, 3_700_000, 3600);
  assert.equal(asleep.present, true);
  assert.ok(Math.abs(asleep.baseline - afterDrift.baseline) < 1);
});

test('someone on the other side does not count as someone on this side', () => {
  const detector = createPresenceDetector();
  feed(detector, EMPTY, 0, 60);
  // Measured: lying on one side raised the other side's total by up to 1,200 for a moment,
  // and by a few hundred while settled
  const neighbour = { out: 1250, cen: 1500, in: 1560 };
  assert.equal(feed(detector, neighbour, 60_000, 600).present, false);
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

test('each action runs once per stay, and only when its conditions hold', () => {
  const settings = {
    sensitivity: 'medium',
    wakeAfterHours: { enabled: true, hours: 9 },
    turnOnWhenInBed: { enabled: true, temperatureF: 81, stayOn: 8 },
  };
  const session = trackBedSession(createBedSession(), true, 0);
  const at = (nowMs, overrides = {}) => ({ nowMs, isPresentNow: true, isOn: false, ...overrides });

  assert.deepEqual(takeDueActions(session, settings, at(10_000)), ['turnOn']);
  assert.deepEqual(takeDueActions(session, settings, at(20_000)), []);
  assert.deepEqual(takeDueActions(session, settings, at(9 * HOUR_MS - 1, { isOn: true })), []);
  assert.deepEqual(takeDueActions(session, settings, at(9 * HOUR_MS, { isOn: true })), ['wake']);
  assert.deepEqual(takeDueActions(session, settings, at(10 * HOUR_MS, { isOn: true })), []);

  // A bed that is already on is left alone
  const alreadyOn = trackBedSession(createBedSession(), true, 0);
  assert.deepEqual(takeDueActions(alreadyOn, settings, at(10_000, { isOn: true })), []);

  // Switched off in settings: nothing
  const off = {
    ...settings,
    wakeAfterHours: { enabled: false, hours: 9 },
    turnOnWhenInBed: { ...settings.turnOnWhenInBed, enabled: false },
  };
  assert.deepEqual(takeDueActions(trackBedSession(createBedSession(), true, 0), off, at(20 * HOUR_MS)), []);
});

test('"until I get out of bed" turns the bed off when the stay ends, and only a bed it turned on', () => {
  const settings = {
    sensitivity: 'medium',
    wakeAfterHours: { enabled: false, hours: 9 },
    turnOnWhenInBed: { enabled: true, temperatureF: 81, stayOn: 'untilOutOfBed' },
  };
  const session = trackBedSession(createBedSession(), true, 0);
  assert.deepEqual(takeDueActions(session, settings, { nowMs: 10_000, isPresentNow: true, isOn: false }), ['turnOn']);
  // Up for five minutes: the stay goes on and the bed stays on
  trackBedSession(session, false, 5 * 60_000);
  assert.deepEqual(takeDueActions(session, settings, { nowMs: 5 * 60_000, isPresentNow: false, isOn: true }), []);
  // Out for good
  trackBedSession(session, false, SESSION_GAP_MS + 1);
  assert.deepEqual(takeDueActions(session, settings, { nowMs: SESSION_GAP_MS + 1, isPresentNow: false, isOn: true }), ['turnOff']);
  assert.deepEqual(takeDueActions(session, settings, { nowMs: SESSION_GAP_MS + 2, isPresentNow: false, isOn: true }), []);

  // A bed that was already on when they got in is not turned off when they leave
  const ownBed = trackBedSession(createBedSession(), true, 0);
  assert.deepEqual(takeDueActions(ownBed, settings, { nowMs: 10_000, isPresentNow: true, isOn: true }), []);
  trackBedSession(ownBed, false, SESSION_GAP_MS + 1);
  assert.deepEqual(takeDueActions(ownBed, settings, { nowMs: SESSION_GAP_MS + 1, isPresentNow: false, isOn: true }), []);
});
