// Run with Node 24: node --test tests/scheduling.test.mjs
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import {
  findChangeProblem, findNewChangeTime, isChangeBeforeWake, isNightLengthValid, isPowerScheduleDurationValid, isTimeDuringNight, minutesBetween,
} from '../app/src/pages/SchedulePage/scheduleValidation.ts';
import {
  DAYS_OF_WEEK, findAlarmReplacedByOneOff, findNightDay, findNextScheduledAlarm, getDayIndexForSchedule, minutesAlarmIsAfterOff, parseClockTime,
  subtractMinutesFromTime,
} from '../server/src/jobs/scheduleTiming.ts';

const requireServer = createRequire(new URL('../server/package.json', import.meta.url));
const { RecurrenceRule } = requireServer('node-schedule');

test('power schedules accept any duration under 24 hours, during the day or overnight', () => {
  const cases = [
    ['22:30', '09:00', true],
    ['21:00', '09:00', true],
    ['21:00', '10:00', true],
    ['21:00', '11:00', true],
    ['23:15', '13:15', true],
    ['23:59', '13:59', true],
    ['06:00', '20:00', true],
    ['00:00', '14:00', true],
    ['23:59', '00:00', true],
    ['06:00', '06:01', true],
    ['21:00', '11:01', true],
    ['23:15', '13:16', true],
    ['06:00', '20:01', true],
    ['06:00', '23:00', true],
    ['21:00', '20:59', true],
    ['00:00', '23:59', true],
    ['21:00', '21:00', false],
    ['', '09:00', false],
    ['21:00', '', false],
    ['24:00', '09:00', false],
    ['21:60', '09:00', false],
  ];

  for (const [powerOn, powerOff, expected] of cases) {
    assert.equal(isPowerScheduleDurationValid(powerOn, powerOff), expected, `${powerOn} → ${powerOff}`);
  }
});

test('changing either endpoint revalidates the duration', () => {
  assert.equal(isPowerScheduleDurationValid('23:00', '13:00'), true);
  assert.equal(isPowerScheduleDurationValid('13:00', '13:00'), false);
  assert.equal(isPowerScheduleDurationValid('13:00', '12:59'), true);
});

test('power-off, adjustments, and alarms follow the start day across the whole week', () => {
  for (const [dayIndex, day] of DAYS_OF_WEEK.entries()) {
    const nextDay = (dayIndex + 1) % 7;
    // A 23:15–13:15 schedule includes late-night and next-afternoon events.
    assert.equal(getDayIndexForSchedule(day, '23:15', '23:15'), dayIndex);
    assert.equal(getDayIndexForSchedule(day, '23:45', '23:15'), dayIndex);
    for (const time of ['00:00', '06:00', '12:59', '13:00', '13:14', '13:15']) {
      assert.equal(getDayIndexForSchedule(day, time, '23:15'), nextDay, `${day} at ${time}`);
    }
    // Existing overnight schedules and daytime schedules still resolve correctly.
    assert.equal(getDayIndexForSchedule(day, '09:00', '21:00'), nextDay);
    assert.equal(getDayIndexForSchedule(day, '08:00', '06:00'), dayIndex);
    assert.equal(getDayIndexForSchedule(day, '20:00', '06:00'), dayIndex);
    assert.equal(getDayIndexForSchedule(day, '00:30', '00:00'), dayIndex);
    assert.equal(getDayIndexForSchedule(day, '14:00', '00:00'), dayIndex);
    assert.equal(getDayIndexForSchedule(day, '20:59', '21:00'), nextDay);
  }
});

test('14-hour schedules recur at the configured local time across DST and week rollover', () => {
  const cases = [
    ['2026-03-08T07:15:00Z', '2026-03-08T20:15:00.000Z'], // Spring forward: 13 elapsed hours.
    ['2026-11-01T06:15:00Z', '2026-11-01T21:15:00.000Z'], // Fall back: 15 elapsed hours.
    ['2026-10-04T06:15:00Z', '2026-10-04T20:15:00.000Z'],
  ];

  for (const [start, expected] of cases) {
    const rule = new RecurrenceRule();
    rule.dayOfWeek = getDayIndexForSchedule('saturday', '13:15', '23:15');
    rule.hour = 13;
    rule.minute = 15;
    rule.tz = 'America/Los_Angeles';
    assert.equal(rule.nextInvocationDate(new Date(start)).toISOString(), expected);
  }
});

test('alarm warm-up times are counted back from the alarm, wrapping past midnight', () => {
  assert.equal(subtractMinutesFromTime('07:00', 30), '06:30');
  assert.equal(subtractMinutesFromTime('07:10', 15), '06:55');
  assert.equal(subtractMinutesFromTime('00:10', 30), '23:40');
  assert.equal(subtractMinutesFromTime('06:45', 0), '06:45');
});

test('a warm-up before an early alarm lands on the morning after power-on', () => {
  // Power on Sunday night, alarm Monday 00:10, warm-up 23:40 is still Sunday night
  const warmUpTime = subtractMinutesFromTime('00:10', 30);
  assert.equal(DAYS_OF_WEEK[getDayIndexForSchedule('sunday', warmUpTime, '22:00')], 'sunday');
  assert.equal(DAYS_OF_WEEK[getDayIndexForSchedule('sunday', '00:10', '22:00')], 'monday');
});

test('the next scheduled alarm is the soonest enabled one, on the morning after its night', () => {
  const requireMoment = createRequire(new URL('../server/package.json', import.meta.url));
  const moment = requireMoment('moment-timezone');
  const night = (alarmTime, isAlarmOn) => ({
    power: { enabled: true, on: '22:00', off: '08:00' },
    alarm: { enabled: isAlarmOn, time: alarmTime },
  });
  const sideSchedule = Object.fromEntries(DAYS_OF_WEEK.map(day => [day, night('07:00', false)]));
  // Wednesday 2026-11-11 23:00 in New York
  const now = moment.tz('2026-11-11T23:00:00', 'America/New_York');
  assert.equal(findNextScheduledAlarm(sideSchedule, now), undefined);

  sideSchedule.wednesday = night('06:30', true);
  sideSchedule.friday = night('09:00', true);
  assert.equal(findNextScheduledAlarm(sideSchedule, now).format(), '2026-11-12T06:30:00-05:00');
  // Once Thursday's alarm has gone off, the next is Saturday morning (Friday's night)
  const afterAlarm = moment.tz('2026-11-12T06:31:00', 'America/New_York');
  assert.equal(findNextScheduledAlarm(sideSchedule, afterAlarm).format(), '2026-11-14T09:00:00-05:00');
});

test('a one-off alarm replaces the scheduled alarm of the same morning only', () => {
  const requireMoment = createRequire(new URL('../server/package.json', import.meta.url));
  const moment = requireMoment('moment-timezone');
  const zone = 'America/New_York';
  const sideSchedule = Object.fromEntries(DAYS_OF_WEEK.map(day => [day, {
    power: { on: '22:00', off: '09:00', enabled: true, onTemperature: 80 },
    alarm: { time: '08:45', enabled: true },
  }]));
  const lateEvening = moment.tz('2026-11-11T23:30:00', zone);
  const replaced = (oneOff, now = lateEvening) => findAlarmReplacedByOneOff(sideSchedule, now, moment.tz(oneOff, zone), 6)?.format();

  // Earlier than the scheduled alarm: the 8:45 must not also go off
  assert.equal(replaced('2026-11-12T06:00:00'), '2026-11-12T08:45:00-05:00');
  // Later than it: still the same morning's alarm
  assert.equal(replaced('2026-11-12T11:30:00'), '2026-11-12T08:45:00-05:00');
  // An afternoon nap alarm leaves tomorrow morning's alarm alone
  const afternoon = moment.tz('2026-11-12T14:00:00', zone);
  assert.equal(replaced('2026-11-12T15:00:00', afternoon), undefined);
  // Set in the evening for the next evening: the morning alarm in between still goes off
  const evening = moment.tz('2026-11-11T21:00:00', zone);
  assert.equal(replaced('2026-11-12T20:00:00', evening), undefined);
});

test('a dotted date is not read as a time of day', () => {
  assert.equal(parseClockTime('16.11.2026, 21:30'), '21:30');
  assert.equal(parseClockTime('16.11.26 06:45'), '06:45');
  assert.equal(parseClockTime('9.05 pm'), '21:05');
  assert.equal(parseClockTime('16.11.2026'), undefined);
});

test('a time of day is read however a phone writes it', () => {
  const cases = [
    ['21:30', '21:30'],
    ['9:05', '09:05'],
    ['09:05:00', '09:05'],
    ['9:30 PM', '21:30'],
    ['9:30\u202fPM', '21:30'],
    ['9:30 a.m.', '09:30'],
    ['12:00 AM', '00:00'],
    ['12:15 PM', '12:15'],
    ['Nov 16, 2026 at 10:00 AM', '10:00'],
    ['2026-11-16T21:30:00-08:00', '21:30'],
    ['9 pm', '21:00'],
    ['ten', undefined],
    ['25:00', undefined],
    ['13:00 PM', undefined],
    ['9:75', undefined],
  ];
  for (const [text, expected] of cases) {
    assert.equal(parseClockTime(text), expected, text);
  }
});

test('an alarm is measured against the off time within its own night', () => {
  const night = { on: '23:59', off: '11:00' };
  assert.equal(minutesAlarmIsAfterOff('10:30', night), -30);
  assert.equal(minutesAlarmIsAfterOff('11:00', night), 0);
  assert.equal(minutesAlarmIsAfterOff('11:55', night), 55);
  // Bedtime before midnight, off after it
  assert.equal(minutesAlarmIsAfterOff('07:30', { on: '22:00', off: '07:00' }), 30);
  assert.equal(minutesAlarmIsAfterOff('23:30', { on: '22:00', off: '07:00' }), -450);
});

test('a night is valid when wake is 1 to 23 hours after bed on', () => {
  assert.equal(minutesBetween('21:30', '07:00'), 570);
  assert.equal(isNightLengthValid('21:30', '07:00'), true);
  assert.equal(isNightLengthValid('01:00', '09:00'), true);
  // Equal, 15 minutes apart, and wake just before bedtime (a 23.5 hour night) are all mistakes
  assert.equal(isNightLengthValid('21:15', '21:15'), false);
  assert.equal(isNightLengthValid('21:15', '21:30'), false);
  assert.equal(isNightLengthValid('21:15', '20:45'), false);
  assert.equal(isNightLengthValid('21:15', '20:15'), true);
  assert.equal(isNightLengthValid('21:15', ''), false);
});

test('a temperature change must fall between bed on and bed off', () => {
  assert.equal(isTimeDuringNight('23:00', '21:30', '07:30'), true);
  assert.equal(isTimeDuringNight('07:30', '21:30', '07:30'), true);
  assert.equal(isTimeDuringNight('08:00', '21:30', '07:30'), false);
  assert.equal(isTimeDuringNight('20:00', '21:30', '07:30'), false);
  assert.equal(isTimeDuringNight('6:00', '21:30', '07:30'), false);
});

test('a new change goes an hour after the last, or halfway to wake, or nowhere', () => {
  assert.equal(findNewChangeTime('21:30', '21:30', '07:00', []), '22:30');
  assert.equal(findNewChangeTime('23:30', '21:30', '07:00', []), '00:30');
  // An hour later would be past wake: halfway instead
  assert.equal(findNewChangeTime('06:30', '21:30', '07:00', []), '06:45');
  // An hour later is taken: halfway
  assert.equal(findNewChangeTime('22:00', '21:30', '07:00', ['23:00']), '02:30');
  // No room left before wake
  assert.equal(findNewChangeTime('06:58', '21:30', '07:00', []), undefined);
});

test('a temperature change must come after bed on and before wake', () => {
  assert.equal(isChangeBeforeWake('06:00', '21:15', '06:30'), true);
  // At the wake time, or between wake and the off time 30 minutes later: on top of the alarm
  assert.equal(isChangeBeforeWake('06:30', '21:15', '06:30'), false);
  assert.equal(isChangeBeforeWake('07:00', '21:15', '06:30'), false);
  // At the bed-on time itself there is nothing to change from
  assert.equal(isChangeBeforeWake('21:15', '21:15', '06:30'), false);
  assert.equal(isChangeBeforeWake('20:00', '21:15', '06:30'), false);
});

test('a morning alarm belongs to the night that began the day before', () => {
  const requireMoment = createRequire(new URL('../server/package.json', import.meta.url));
  const moment = requireMoment('moment-timezone');
  const zone = 'America/Los_Angeles';
  // Tuesday 17 Nov 2026, 7 AM: the end of Monday night
  assert.equal(findNightDay(moment.tz('2026-11-17T07:00:00', zone)), 'monday');
  assert.equal(findNightDay(moment.tz('2026-11-17T11:59:00', zone)), 'monday');
  assert.equal(findNightDay(moment.tz('2026-11-17T22:00:00', zone)), 'tuesday');
  assert.equal(findNightDay(moment.tz('2026-11-16T00:30:00', zone)), 'sunday');
});

test('a misplaced temperature change is blamed on the end of the night it is nearer', () => {
  assert.equal(findChangeProblem('02:00', '21:15', '06:30'), undefined);
  // On or just past the wake time: the alarm is in the way
  assert.equal(findChangeProblem('06:30', '21:15', '06:30'), 'notBeforeWake');
  assert.equal(findChangeProblem('07:00', '21:15', '06:30'), 'notBeforeWake');
  // On or just short of the bed-on time
  assert.equal(findChangeProblem('21:15', '21:15', '06:30'), 'notAfterBedOn');
  assert.equal(findChangeProblem('20:00', '21:15', '06:30'), 'notAfterBedOn');
  assert.equal(findChangeProblem('', '21:15', '06:30'), 'notBeforeWake');
});
