// LowDB, stores the schedules in /persistent/free-sleep-data/lowdb/schedulesDB.json

!function(){try{var e="undefined"!=typeof window?window:"undefined"!=typeof global?global:"undefined"!=typeof globalThis?globalThis:"undefined"!=typeof self?self:{},n=(new e.Error).stack;n&&(e._sentryDebugIds=e._sentryDebugIds||{},e._sentryDebugIds[n]="973bc623-8c25-5d3a-b592-fdc34c235534")}catch(e){}}();
import _ from 'lodash';
import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import config from '../config.js';
import { migrateTemperatureScaleOnce } from './migrateTemperatureScale.js';
const defaultDailySchedule = {
    temperatures: {},
    power: {
        on: '21:00',
        off: '09:00',
        enabled: false,
        onTemperature: 82,
    },
    alarm: {
        time: '09:00',
        vibrationIntensity: 100,
        vibrationPattern: 'rise',
        duration: 10,
        enabled: false,
        alarmTemperature: 82,
    }
};
const defaultSideSchedule = {
    sunday: defaultDailySchedule,
    monday: defaultDailySchedule,
    tuesday: defaultDailySchedule,
    wednesday: defaultDailySchedule,
    thursday: defaultDailySchedule,
    friday: defaultDailySchedule,
    saturday: defaultDailySchedule,
};
const defaultData = {
    left: _.cloneDeep(defaultSideSchedule),
    right: _.cloneDeep(defaultSideSchedule),
};
const schedulesFile = `${config.lowDbFolder}schedulesDB.json`;
const file = new JSONFile(schedulesFile);
const schedulesDB = new Low(file, defaultData);
await schedulesDB.read();
// Allows us to add default values to the schedules if users have existing schedulesDB.json data
schedulesDB.data = _.merge({}, defaultData, schedulesDB.data);
// Temperatures saved before the level-to-temperature curve was measured are converted once
schedulesDB.data = migrateTemperatureScaleOnce(schedulesDB.data, { schedulesFile, dataFolder: config.dbFolder });
await schedulesDB.write();
export default schedulesDB;
//# sourceMappingURL=schedules.js.map
//# debugId=973bc623-8c25-5d3a-b592-fdc34c235534
