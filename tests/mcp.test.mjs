// The MCP tools: each one's request to the Pod, and what is given back to the agent
import assert from 'node:assert/strict';
import test from 'node:test';
import { TOOLS, applyLinkedSides, describeResult } from '../mcp/tools.mjs';

const toolNamed = name => TOOLS.find(tool => tool.name === name);

test('every tool has a name, a description, and says whether it changes the bed', () => {
  assert.equal(new Set(TOOLS.map(tool => tool.name)).size, TOOLS.length);
  for (const tool of TOOLS) {
    assert.match(tool.name, /^[a-z_]+$/);
    assert.ok(tool.description.length > 30, tool.name);
    assert.equal(typeof tool.changesTheBed, 'boolean', tool.name);
    // Reading never sends a body, and nothing that reads is marked as changing the bed
    const isRead = tool.name.startsWith('get_');
    assert.equal(tool.changesTheBed, !isRead, tool.name);
  }
});

test('a temperature for both sides is one request naming each side', () => {
  const request = toolNamed('set_temperature').request({ side: 'both', temperatureF: 72 });
  assert.deepEqual(request, { method: 'POST', path: '/api/deviceStatus', body: { left: { targetTemperatureF: 72 }, right: { targetTemperatureF: 72 } } });
  assert.deepEqual(toolNamed('set_power').request({ side: 'left', on: false }).body, { left: { isOn: false } });
  assert.deepEqual(toolNamed('dismiss_alarm').request({ side: 'right' }).body, { right: { isAlarmVibrating: false } });
});

test('temperatures are whole degrees within what the Pod takes', () => {
  const { temperatureF } = toolNamed('set_temperature').input;
  assert.deepEqual([temperatureF.min, temperatureF.max, temperatureF.integer], [50, 110, true]);
  assert.equal(toolNamed('set_night_schedule').input.bedOnTemperatureF.integer, true);
});

test('with the sides linked, a change to power, temperature or the schedule for one side goes to both', () => {
  const linked = { linkSides: true };
  for (const name of ['set_temperature', 'set_power', 'set_night_schedule']) {
    assert.equal(applyLinkedSides(toolNamed(name), { side: 'left' }, linked).side, 'both', name);
    assert.equal(applyLinkedSides(toolNamed(name), { side: 'left' }, { linkSides: false }).side, 'left', name);
  }
  // The Pod links alarms itself, and away mode is one side's own
  assert.equal(applyLinkedSides(toolNamed('set_one_time_alarm'), { side: 'left' }, linked).side, 'left');
  assert.equal(applyLinkedSides(toolNamed('set_away_mode'), { side: 'left' }, linked).side, 'left');
});

test('a one-time alarm names a side only when one was picked', () => {
  const alarm = toolNamed('set_one_time_alarm');
  assert.deepEqual(alarm.request({ side: 'left', time: '06:30' }).body, { side: 'left', time: '06:30' });
  assert.deepEqual(alarm.request({ side: 'both', time: '06:30' }).body, { time: '06:30' });
  assert.deepEqual(toolNamed('cancel_one_time_alarm').request({ side: 'both' }).body, {});
  assert.ok(new RegExp(alarm.input.time.pattern).test('23:59'));
  assert.ok(!new RegExp(alarm.input.time.pattern).test('6:30 AM'));
});

test('a night\'s schedule carries only what was given, and never the off time', () => {
  const night = toolNamed('set_night_schedule');
  assert.deepEqual(
    night.request({ side: 'left', day: 'monday', wakeTime: '06:45', alarmOn: true }).body,
    { left: { monday: { alarm: { time: '06:45', enabled: true } } } },
  );
  assert.deepEqual(
    night.request({ side: 'both', day: 'friday', bedOnTime: '22:30', bedOnTemperatureF: 70 }).body,
    { left: { friday: { power: { on: '22:30', onTemperature: 70 } } }, right: { friday: { power: { on: '22:30', onTemperature: 70 } } } },
  );
  assert.throws(() => night.request({ side: 'left', day: 'monday' }), /at least one/);
});

test('the autopilot and away mode go through settings', () => {
  assert.deepEqual(toolNamed('set_autopilot').request({ on: true }).body, { autopilot: { enabled: true } });
  assert.deepEqual(toolNamed('set_autopilot').request({ on: true, baseTemperatureF: 74 }).body, { autopilot: { enabled: true, baseTemperatureF: 74 } });
  assert.deepEqual(toolNamed('set_away_mode').request({ side: 'right', on: true }).body, { right: { awayMode: true } });
});

test('what comes back is the Pod\'s answer trimmed, or a line saying what was done', () => {
  const status = {
    left: { isOn: true, targetTemperatureF: 75, currentTemperatureF: 78, measuredTemperatureF: 78.3, secondsRemaining: 21600, isAlarmVibrating: false },
    right: { isOn: false, targetTemperatureF: 81, currentTemperatureF: 81, secondsRemaining: 0, isAlarmVibrating: false },
    hubVersion: 'Pod 5', sevenSleep: { version: '3.24.3' }, waterLevel: 'true', isPriming: false, settings: { gainLeft: 400 },
  };
  const shown = JSON.parse(describeResult(toolNamed('get_bed_status'), {}, status));
  assert.deepEqual(shown.left, { isOn: true, targetTemperatureF: 75, bedTemperatureF: 78.3, minutesUntilOff: 360, isAlarmVibrating: false });
  assert.deepEqual(shown.right, { isOn: false, targetTemperatureF: 81, bedTemperatureF: 81, isAlarmVibrating: false });
  assert.equal(shown.settings, undefined);
  assert.equal(describeResult(toolNamed('set_temperature'), { side: 'left', temperatureF: 70 }, undefined), 'Set left to 70°F.');
  const schedules = { left: { monday: { alarm: { time: '06:45' } }, tuesday: {} }, right: {} };
  assert.deepEqual(JSON.parse(describeResult(toolNamed('get_schedule'), { side: 'left', day: 'monday' }, schedules)), { monday: { alarm: { time: '06:45' } } });
});
