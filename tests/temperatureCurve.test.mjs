// Run with Node 24: node --test tests/temperatureCurve.test.mjs
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  MAX_TEMPERATURE_F, MIN_TEMPERATURE_F, convertFromEvenSpreadF, levelToTemperatureF, stepDialLevels, stepFToDialLevels,
  stepTemperatureF, temperatureFToLevel,
} from '../server/src/db/temperatureCurve.ts';

const closeTo = (actual, expected) => assert.ok(Math.abs(actual - expected) < 0.01, `${actual} is not ${expected}`);

test('levels give the temperatures the firmware reported aiming for', () => {
  // [level, °C] from docs/pod5_temperature_calibration.json
  const measured = [
    [-100, 10], [-99, 15.12], [-98, 15.24], [-95, 15.6], [-91, 16.08], [-90, 16.2], [-80, 17.4], [-50, 21], [-10, 25.8], [0, 27],
    [10, 28.8], [25, 31.5], [40, 34.2], [50, 36], [60, 37.2], [70, 38.4], [90, 40.8], [100, 42],
  ];
  for (const [level, temperatureC] of measured) {
    closeTo(levelToTemperatureF(level), temperatureC * 9 / 5 + 32);
  }
  assert.equal(MIN_TEMPERATURE_F, 50);
  assert.equal(MAX_TEMPERATURE_F, 108);
});

test('a temperature converts to the nearest level, and out-of-range ones to the ends', () => {
  assert.equal(temperatureFToLevel(80.6), 0);
  assert.equal(temperatureFToLevel(96.8), 50);
  assert.equal(temperatureFToLevel(50), -100);
  assert.equal(temperatureFToLevel(40), -100);
  assert.equal(temperatureFToLevel(110), 100);
});

test('every dial setting survives being stored as a whole degree', () => {
  for (let dial = -10; dial <= 10; dial++) {
    const storedF = Math.round(levelToTemperatureF(dial * 10));
    assert.equal(Math.round(temperatureFToLevel(storedF) / 10), dial, `dial ${dial} stored as ${storedF}`);
  }
});

test('temperatures saved under the old even spread keep their level', () => {
  // Old 96°F was level 49, old 55°F was -100, old 110°F was 100, old 83°F was level 2
  assert.equal(convertFromEvenSpreadF(96), 96);
  assert.equal(convertFromEvenSpreadF(55), 50);
  assert.equal(convertFromEvenSpreadF(110), 108);
  assert.equal(convertFromEvenSpreadF(83), 81);
  assert.equal(convertFromEvenSpreadF(58), 61);
  assert.equal(convertFromEvenSpreadF(56), 60);
  for (let oldF = 55; oldF <= 110; oldF++) {
    const oldLevel = Math.round((oldF - 82.5) / 0.275);
    const newLevel = temperatureFToLevel(convertFromEvenSpreadF(oldF));
    // Whole degrees are coarser than levels, so the level can move slightly but never by a dial step
    assert.ok(Math.abs(newLevel - oldLevel) <= 3, `${oldF}°F: level ${oldLevel} became ${newLevel}`);
  }
});

test('a one-degree step always moves the level, even across the gap above the coldest level', () => {
  // Ordinary steps are plain arithmetic
  assert.equal(stepTemperatureF(80, 1, 50, 108), 81);
  assert.equal(stepTemperatureF(80, -3, 50, 108), 77);
  // The coldest level is 50°F and the next is 59°F: 51°F would still be the coldest level
  assert.equal(temperatureFToLevel(stepTemperatureF(50, 1, 50, 108)), -99);
  assert.equal(temperatureFToLevel(stepTemperatureF(59, -1, 50, 108)), -100);
  // At the ends it stays put, and the range is respected
  assert.equal(stepTemperatureF(50, -1, 50, 108), 50);
  assert.equal(stepTemperatureF(108, 1, 50, 108), 108);
  assert.equal(stepTemperatureF(60, -10, 55, 110), 55);
});

test('from every whole degree, one step up or down changes what the bed is told', () => {
  for (let temperatureF = 50; temperatureF <= 108; temperatureF++) {
    const level = temperatureFToLevel(temperatureF);
    if (level < 100) {
      const warmer = stepTemperatureF(temperatureF, 1, 50, 108);
      assert.ok(temperatureFToLevel(warmer) > level, `${temperatureF}°F up gave ${warmer}°F, still level ${level}`);
    }
    if (level > -100) {
      const cooler = stepTemperatureF(temperatureF, -1, 50, 108);
      assert.ok(temperatureFToLevel(cooler) < level, `${temperatureF}°F down gave ${cooler}°F, still level ${level}`);
    }
  }
});

// The whole °F a dial level (-10 to +10) stands for
const dialLevelF = (dialLevel) => Math.round(levelToTemperatureF(dialLevel * 10));

test('with the app set to levels, a press moves whole dial levels', () => {
  // A step saved as 1°F is one level, 6°F is two, 8°F is three
  assert.deepEqual([1, 3, 6, 8, 10].map(stepFToDialLevels), [1, 1, 2, 3, 4]);
  for (let dialLevel = -9; dialLevel <= 9; dialLevel++) {
    const temperatureF = dialLevelF(dialLevel);
    assert.equal(stepDialLevels(temperatureF, 1, 50, 110), dialLevelF(dialLevel + 1), `up from ${dialLevel}`);
    assert.equal(stepDialLevels(temperatureF, -1, 50, 110), dialLevelF(dialLevel - 1), `down from ${dialLevel}`);
  }
  assert.equal(stepDialLevels(dialLevelF(0), 2, 50, 110), dialLevelF(2));
  assert.equal(stepDialLevels(dialLevelF(0), -3, 50, 110), dialLevelF(-3));
  // Every level has its own whole degree
  assert.equal(new Set(Array.from({ length: 21 }, (_unused, index) => dialLevelF(index - 10))).size, 21);
  // The ends of the dial hold
  assert.equal(stepDialLevels(dialLevelF(10), 1, 50, 110), dialLevelF(10));
  assert.equal(stepDialLevels(dialLevelF(-10), -1, 50, 110), dialLevelF(-10));
});

test('a temperature between two levels steps to the next level, not past it', () => {
  const betweenF = Math.round((dialLevelF(2) + dialLevelF(3)) / 2);
  if (betweenF !== dialLevelF(2) && betweenF !== dialLevelF(3)) {
    assert.equal(stepDialLevels(betweenF, 1, 50, 110), dialLevelF(3));
    assert.equal(stepDialLevels(betweenF, -1, 50, 110), dialLevelF(2));
  }
});
