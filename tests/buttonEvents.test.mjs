// Run with Node 24: node --test tests/buttonEvents.test.mjs
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  POWER_HOLD_MS,
  countPressesAsGestures,
  createButtonLineParser,
  isPowerHold,
} from '../server/src/8sleep/buttonEvents.ts';

// Lines copied from a real Pod 5's firmware log (journalctl -u frank -o cat)
const topPressLines = [
  'DBG:00349740 McuLogRelay.cpp:19 relayMcuDebug|[sensor] -> FW: 336474 [buttons] top button clicked',
  'DBG:00349949 McuLogRelay.cpp:19 relayMcuDebug|[sensor] -> FW: 336682 [buttons] top button released',
  'DBG:00349949 McuLogRelay.cpp:19 relayMcuDebug|[sensor] -> FW: 336682 [buttons] top button held for 208ms (abort)',
  'DBG:00349949 Sensor.cpp:1671 handleButtonEvent|[TTC] processing [button] side right { button: top, type: short, count: 1 }',
  'DBG:00349949 Sensor.cpp:1716 handleButtonEvent|[TTC] ignoring 1 short top click(s)',
  'DBG:00349949 Logger.cpp:204 appendButtonEvent|[logger] appending button event',
  'DBG:00349951 McuLogRelay.cpp:19 relayMcuDebug|[sensor] -> FW: 336683 [buttons] sent button event s0x01 i0x00 c0x01',
];
const bottomPressLine = 'DBG:00352141 Sensor.cpp:1671 handleButtonEvent|[TTC] processing [button] side right { button: bottom, type: short, count: 1 }';
// A three second hold, then the button brushed again before the firmware reported the run
const middleHoldLines = [
  'DBG:00353260 McuLogRelay.cpp:19 relayMcuDebug|[sensor] -> FW: 339994 [buttons] middle button clicked',
  'DBG:00356205 McuLogRelay.cpp:19 relayMcuDebug|[sensor] -> FW: 342938 [buttons] middle button released',
  'DBG:00356205 McuLogRelay.cpp:19 relayMcuDebug|[sensor] -> FW: 342939 [buttons] middle button held for 2944ms',
  'DBG:00356254 McuLogRelay.cpp:19 relayMcuDebug|[sensor] -> FW: 342986 [buttons] middle button clicked',
  'DBG:00356301 McuLogRelay.cpp:19 relayMcuDebug|[sensor] -> FW: 343034 [buttons] middle button released',
  'DBG:00356302 McuLogRelay.cpp:19 relayMcuDebug|[sensor] -> FW: 343035 [buttons] middle button held for 48ms',
  'DBG:00356801 Sensor.cpp:1671 handleButtonEvent|[TTC] processing [button] side right { button: middle, type: short, count: 2 }',
  'DBG:00356802 Sensor.cpp:1461 handleGesture|[TTC] adj base gesture',
];
const middlePressLine = 'DBG:1 Sensor.cpp:1671 handleButtonEvent|[TTC] processing [button] side left { button: middle, type: short, count: 1 }';
const heldLine = durationMs => `DBG:1 McuLogRelay.cpp:19 relayMcuDebug|[sensor] -> FW: 1 [buttons] middle button held for ${durationMs}ms`;

// A clock the test moves by hand
function createClock() {
  let nowMs = 1_000_000;
  return { getNowMs: () => nowMs, advance: (milliseconds) => { nowMs += milliseconds; } };
}

// Feeds lines through a parser and returns only the presses it produced
const parseAll = (parseLine, lines) => lines.map(parseLine).filter(Boolean);

test('one real top press produces exactly one press', () => {
  const presses = parseAll(createButtonLineParser(), topPressLines);
  assert.deepEqual(presses, [{ side: 'right', button: 'top', count: 1 }]);
});

test('a bottom press is read with its side', () => {
  assert.deepEqual(createButtonLineParser()(bottomPressLine), { side: 'right', button: 'bottom', count: 1 });
});

test('the count of quick presses is kept', () => {
  const line = topPressLines[3].replace('count: 1', 'count: 3');
  assert.deepEqual(createButtonLineParser()(line), { side: 'right', button: 'top', count: 3 });
});

test('a line without a count is one press', () => {
  const line = 'DBG:4411 [TTC] processing [button] side left { button: top, type: short }';
  assert.deepEqual(createButtonLineParser()(line), { side: 'left', button: 'top', count: 1 });
});

test('unrelated log lines are ignored', () => {
  const parseLine = createButtonLineParser();
  assert.equal(parseLine('alarm[right] start: power 100, pattern 0, dur 120000 ms'), null);
  assert.equal(parseLine(''), null);
});

test('a real long hold followed by a brush is still a power hold', () => {
  const presses = parseAll(createButtonLineParser(), middleHoldLines);
  assert.deepEqual(presses, [{ side: 'right', button: 'middle', count: 2, heldMs: 2944 }]);
  assert.equal(isPowerHold(presses[0]), true);
});

test('a hold duration is used once and never for a later press', () => {
  const parseLine = createButtonLineParser(createClock().getNowMs);
  parseLine(heldLine(2140));
  parseLine(middlePressLine);
  assert.deepEqual(parseLine(middlePressLine), { side: 'left', button: 'middle', count: 1 });
});

test('a stale hold duration is not attached, nor mixed into a later run', () => {
  const clock = createClock();
  const parseLine = createButtonLineParser(clock.getNowMs);
  parseLine(heldLine(2140));
  clock.advance(10_000);
  assert.deepEqual(parseLine(middlePressLine), { side: 'left', button: 'middle', count: 1 });
  parseLine(heldLine(3000));
  clock.advance(10_000);
  parseLine(heldLine(90));
  assert.deepEqual(parseLine(middlePressLine), { side: 'left', button: 'middle', count: 1, heldMs: 90 });
});

test('only a long middle hold counts as a power hold', () => {
  assert.equal(isPowerHold({ side: 'left', button: 'middle', count: 1, heldMs: POWER_HOLD_MS }), true);
  assert.equal(isPowerHold({ side: 'left', button: 'middle', count: 1, heldMs: POWER_HOLD_MS - 1 }), false);
  assert.equal(isPowerHold({ side: 'left', button: 'middle', count: 1 }), false);
  assert.equal(isPowerHold({ side: 'left', button: 'top', count: 1, heldMs: 5_000 }), false);
});

test('presses are counted as the matching tap gestures', () => {
  const presses = [
    { side: 'left', button: 'top', count: 2 },
    { side: 'left', button: 'bottom', count: 1 },
    { side: 'left', button: 'middle', count: 1, heldMs: 120 },
    { side: 'left', button: 'middle', count: 1, heldMs: POWER_HOLD_MS + 500 },
  ];
  assert.deepEqual(countPressesAsGestures(presses), { tripleTap: 2, doubleTap: 1, quadTap: 1 });
});
