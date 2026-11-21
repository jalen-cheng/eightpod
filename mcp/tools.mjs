// The tools an AI agent gets for a SevenSleep Pod: what each is called, what it takes, and the
// one request to the Pod's API that it turns into. Nothing here talks to anything, and the file
// has no imports, so the tests can load it as it is. server.mjs gives these to the MCP SDK.

const SIDES = ['left', 'right', 'both'];
const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
// The range the Pod's API takes; the bed itself stops at 108
const MIN_TEMPERATURE_F = 50;
const MAX_TEMPERATURE_F = 110;
const CLOCK_PATTERN = '^([01]\\d|2[0-3]):[0-5]\\d$';

const side = { type: 'enum', values: SIDES, description: 'Which side of the bed: left, right or both.' };
const oneSide = { type: 'enum', values: ['left', 'right'], description: 'Which side of the bed.' };
const clock = description => ({ type: 'string', pattern: CLOCK_PATTERN, description: `${description} 24-hour HH:mm, in the Pod's time zone.` });
const temperature = description => ({ type: 'number', min: MIN_TEMPERATURE_F, max: MAX_TEMPERATURE_F, integer: true, description: `${description} In whole °F, ${MIN_TEMPERATURE_F} to ${MAX_TEMPERATURE_F}.` });

// The sides a request names, as the API wants them written
const sidesOf = chosen => (chosen === 'both' ? ['left', 'right'] : [chosen]);
const forSides = (chosen, change) => Object.fromEntries(sidesOf(chosen).map(name => [name, change]));
// Leaves out what was not given, so a request only carries what should change
const withoutUnset = fields => Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== undefined));

// What an agent needs from the Pod's status, without the firmware's own fields
const summariseStatus = (status) => {
  const summarise = sideStatus => withoutUnset({
    isOn: sideStatus.isOn,
    targetTemperatureF: sideStatus.targetTemperatureF,
    bedTemperatureF: sideStatus.measuredTemperatureF ?? sideStatus.currentTemperatureF,
    minutesUntilOff: sideStatus.isOn ? Math.round(sideStatus.secondsRemaining / 60) : undefined,
    isAlarmVibrating: sideStatus.isAlarmVibrating,
  });
  return {
    left: summarise(status.left), right: summarise(status.right),
    pod: status.hubVersion, version: status.sevenSleep?.version, isPriming: status.isPriming, hasWater: status.waterLevel === 'true',
  };
};

export const TOOLS = [
  {
    name: 'get_bed_status',
    title: 'Bed status',
    description: 'Whether each side of the bed is on, the temperature it is set to and the temperature it is at, and whether an alarm is going off.',
    changesTheBed: false,
    input: {},
    request: () => ({ method: 'GET', path: '/api/deviceStatus' }),
    present: summariseStatus,
  },
  {
    name: 'get_schedule',
    title: 'Schedule',
    description: 'The weekly schedule for one side: for each night, when the bed turns on and at what temperature, later temperature changes, and the wake-up time and alarm. A night is named after the day it begins on.',
    changesTheBed: false,
    input: { side: oneSide, day: { type: 'enum', values: DAYS, optional: true, description: 'One night only. Leave out for the whole week.' } },
    request: () => ({ method: 'GET', path: '/api/schedules' }),
    present: (schedules, { side: chosen, day }) => (day ? { [day]: schedules[chosen][day] } : schedules[chosen]),
  },
  {
    name: 'get_recent_sleep',
    title: 'Recent sleep',
    description: 'The stays in bed the Pod has saved, newest first: when each began, when the bed judged the sleeper asleep and awake, wake-ups, and whether it was a night or a nap. Pod 5 only. The bed judges sleep by stillness, so treat the times as estimates.',
    changesTheBed: false,
    input: { limit: { type: 'number', min: 1, max: 30, integer: true, optional: true, description: 'How many stays, 1 to 30. 7 if left out.' } },
    request: ({ limit }) => ({ method: 'GET', path: `/api/autopilot/nights?limit=${limit ?? 7}` }),
  },
  {
    name: 'get_autopilot',
    title: 'Autopilot',
    description: 'Whether the autopilot is on, whether each side is out of bed, awake or asleep right now, the last temperature change it made and why, and what it has learned. Pod 5 only.',
    changesTheBed: false,
    input: {},
    request: () => ({ method: 'GET', path: '/api/autopilot' }),
  },
  {
    name: 'set_temperature',
    followsLinkedSides: true,
    title: 'Set the temperature',
    description: 'Sets the temperature a side is aiming for. It does not turn the side on. During a night the autopilot is steering, it holds a temperature set this way for a while and learns from it, so only set one the person asked for.',
    changesTheBed: true,
    input: { side, temperatureF: temperature('The temperature to aim for.') },
    request: ({ side: chosen, temperatureF }) => ({ method: 'POST', path: '/api/deviceStatus', body: forSides(chosen, { targetTemperatureF: temperatureF }) }),
    confirm: ({ side: chosen, temperatureF }) => `Set ${chosen} to ${temperatureF}°F.`,
  },
  {
    name: 'set_power',
    followsLinkedSides: true,
    title: 'Turn a side on or off',
    description: 'Turns a side of the bed on or off. A side turned on this way turns itself off after the hours chosen in Settings.',
    changesTheBed: true,
    input: { side, on: { type: 'boolean', description: 'true to turn on, false to turn off.' } },
    request: ({ side: chosen, on }) => ({ method: 'POST', path: '/api/deviceStatus', body: forSides(chosen, { isOn: on }) }),
    confirm: ({ side: chosen, on }) => `Turned ${chosen} ${on ? 'on' : 'off'}.`,
  },
  {
    name: 'set_one_time_alarm',
    title: 'Set a one-time alarm',
    description: 'Sets a vibrating alarm for the next time the clock shows this time. The weekly schedule is not changed; that morning\'s scheduled alarm is skipped if it is close to this one.',
    changesTheBed: true,
    input: { side, time: clock('When the alarm should go off.') },
    request: ({ side: chosen, time }) => ({ method: 'POST', path: '/api/alarm/time', body: withoutUnset({ side: chosen === 'both' ? undefined : chosen, time }) }),
  },
  {
    name: 'cancel_one_time_alarm',
    title: 'Cancel a one-time alarm',
    description: 'Drops a waiting one-time alarm, so the weekly schedule applies again.',
    changesTheBed: true,
    input: { side },
    request: ({ side: chosen }) => ({ method: 'POST', path: '/api/alarm/time/cancel', body: withoutUnset({ side: chosen === 'both' ? undefined : chosen }) }),
  },
  {
    name: 'dismiss_alarm',
    title: 'Stop an alarm',
    description: 'Stops an alarm that is vibrating now.',
    changesTheBed: true,
    input: { side },
    request: ({ side: chosen }) => ({ method: 'POST', path: '/api/deviceStatus', body: forSides(chosen, { isAlarmVibrating: false }) }),
    confirm: ({ side: chosen }) => `Stopped the alarm on ${chosen}.`,
  },
  {
    name: 'set_night_schedule',
    followsLinkedSides: true,
    title: 'Change a night in the schedule',
    description: 'Changes one night of the weekly schedule for a side: the time the bed turns on, the temperature it starts at, the wake-up time, and whether the alarm vibrates. Only what is given changes. The bed turns off 30 minutes after the wake-up time. The wake-up time must be 1 to 23 hours after the bed-on time.',
    changesTheBed: true,
    input: {
      side,
      day: { type: 'enum', values: DAYS, description: 'The night, named after the day it begins on.' },
      bedOnTime: { ...clock('When the bed turns on.'), optional: true },
      bedOnTemperatureF: { ...temperature('The temperature it starts at.'), optional: true },
      wakeTime: { ...clock('The wake-up time.'), optional: true },
      alarmOn: { type: 'boolean', optional: true, description: 'Whether the alarm vibrates at the wake-up time.' },
      nightOn: { type: 'boolean', optional: true, description: 'false switches this night\'s schedule off altogether.' },
    },
    request: ({ side: chosen, day, bedOnTime, bedOnTemperatureF, wakeTime, alarmOn, nightOn }) => {
      const power = withoutUnset({ on: bedOnTime, onTemperature: bedOnTemperatureF, enabled: nightOn });
      const alarm = withoutUnset({ time: wakeTime, enabled: alarmOn });
      const night = withoutUnset({ power: Object.keys(power).length ? power : undefined, alarm: Object.keys(alarm).length ? alarm : undefined });
      if (Object.keys(night).length === 0) throw new Error('Give at least one thing to change.');
      return { method: 'POST', path: '/api/schedules', body: forSides(chosen, { [day]: night }) };
    },
    present: (schedules, { side: chosen, day }) => Object.fromEntries(sidesOf(chosen).map(name => [name, { [day]: schedules[name][day] }])),
  },
  {
    name: 'set_autopilot',
    title: 'Switch the autopilot',
    description: 'Switches the autopilot on or off, and optionally gives it a base temperature to work from. Switching it on links the two sides of the bed. Pod 5 only.',
    changesTheBed: true,
    input: {
      on: { type: 'boolean', description: 'true to switch on, false to switch off.' },
      baseTemperatureF: { ...temperature('The temperature its changes are counted from. Leave out to keep what is set.'), optional: true },
    },
    request: ({ on, baseTemperatureF }) => ({ method: 'POST', path: '/api/settings', body: { autopilot: withoutUnset({ enabled: on, baseTemperatureF }) } }),
    present: settings => ({ autopilot: settings.autopilot, sidesLinked: settings.linkSides }),
  },
  {
    name: 'set_away_mode',
    title: 'Away mode',
    description: 'Switches away mode for a side. While it is on, that side\'s schedule and alarms do not run.',
    changesTheBed: true,
    input: { side, on: { type: 'boolean', description: 'true when nobody will be sleeping there.' } },
    request: ({ side: chosen, on }) => ({ method: 'POST', path: '/api/settings', body: forSides(chosen, { awayMode: on }) }),
    present: settings => ({ leftAway: settings.left.awayMode, rightAway: settings.right.awayMode }),
  },
];

// The Pod applies linked sides itself for alarms, but not for power, temperature or the schedule:
// there the app sends both sides. A tool marked followsLinkedSides does the same, so with the
// sides linked a change asked for one side goes to the whole bed, as it would from the app.
export function applyLinkedSides(tool, args, settings) {
  if (!tool.followsLinkedSides || !settings?.linkSides || args.side === 'both') return args;
  return { ...args, side: 'both' };
}

// What a tool call comes back with as text: the Pod's answer, trimmed where a tool says how;
// for a change that answers with nothing, a line saying what was done
export function describeResult(tool, args, answer) {
  if (answer === undefined || answer === null || answer === '') return tool.confirm ? tool.confirm(args) : 'Done.';
  const shown = tool.present ? tool.present(answer, args) : answer;
  return JSON.stringify(shown, null, 2);
}
