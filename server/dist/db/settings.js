// LowDB, stores the schedules in /persistent/free-sleep-data/lowdb/settingsDB.json

!function(){try{var e="undefined"!=typeof window?window:"undefined"!=typeof global?global:"undefined"!=typeof globalThis?globalThis:"undefined"!=typeof self?self:{},n=(new e.Error).stack;n&&(e._sentryDebugIds=e._sentryDebugIds||{},e._sentryDebugIds[n]="b16e21a3-6128-54d4-8bd3-e5f00d05e77c")}catch(e){}}();
import _ from 'lodash';
import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import config from '../config.js';
const defaultSideSettings = {
    name: 'Side',
    awayMode: false,
    scheduleOverrides: {
        temperatureSchedules: {
            disabled: false,
            expiresAt: ''
        },
        alarm: {
            disabled: false,
            timeOverride: '',
            expiresAt: '',
        }
    },
    taps: {
        doubleTap: {
            type: 'temperature',
            change: 'decrement',
            amount: 1,
        },
        tripleTap: {
            type: 'temperature',
            change: 'increment',
            amount: 1,
        },
        quadTap: {
            type: 'alarm',
            behavior: 'dismiss',
            snoozeDuration: 60,
            inactiveAlarmBehavior: 'power',
        },
    }
};
const defaultData = {
    id: crypto.randomUUID(),
    timeZone: 'UTC',
    temperatureFormat: 'fahrenheit',
    rebootDaily: true,
    linkSides: false,
    left: {
        ..._.cloneDeep(defaultSideSettings),
        name: 'Left',
    },
    right: {
        ..._.cloneDeep(defaultSideSettings),
        name: 'Right',
    },
    // The firmware's own length for a side switched on, and the schedule carries on as usual
    manualOn: { hours: 12, overridesSchedule: false },
    // Detection always runs where the sensors exist; both actions are off until switched on
    presence: {
        sensitivity: 'medium',
        wakeAfterHours: { enabled: false, hours: 9 },
        turnOnWhenInBed: { enabled: false, after: '21:00', hours: 8 },
    },
    primePodDaily: {
        enabled: true,
        time: '14:00',
    },
};
const file = new JSONFile(`${config.lowDbFolder}settingsDB.json`);
const settingsDB = new Low(file, defaultData);
await settingsDB.read();
// Allows us to add default values to the settings if users have existing settingsDB.json data
settingsDB.data = _.merge({}, defaultData, settingsDB.data);
await settingsDB.write();
export default settingsDB;
//# sourceMappingURL=settings.js.map
//# debugId=b16e21a3-6128-54d4-8bd3-e5f00d05e77c
