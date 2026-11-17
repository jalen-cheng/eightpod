// LowDB, stores the schedules in /persistent/free-sleep-data/lowdb/settingsDB.json

!function(){try{var e="undefined"!=typeof window?window:"undefined"!=typeof global?global:"undefined"!=typeof globalThis?globalThis:"undefined"!=typeof self?self:{},n=(new e.Error).stack;n&&(e._sentryDebugIds=e._sentryDebugIds||{},e._sentryDebugIds[n]="d64f39d9-ff3b-5a81-af7b-482cd9f826b1")}catch(e){}}();
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
//# debugId=d64f39d9-ff3b-5a81-af7b-482cd9f826b1
