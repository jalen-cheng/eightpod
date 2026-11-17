
!function(){try{var e="undefined"!=typeof window?window:"undefined"!=typeof global?global:"undefined"!=typeof globalThis?globalThis:"undefined"!=typeof self?self:{},n=(new e.Error).stack;n&&(e._sentryDebugIds=e._sentryDebugIds||{},e._sentryDebugIds[n]="cbf69a05-8a02-5943-9be2-ba4988440b37")}catch(e){}}();
import _ from 'lodash';
import { connectFranken } from './frankenServer.js';
import logger from '../logger.js';
import { areSidesFlipped } from './sideMapping.js';
export const frankenCommands = {
    HELLO: '0',
    SET_TEMP: '1',
    SET_ALARM: '2',
    // RESET: '3',
    // FORCE_RESET: '4',
    ALARM_LEFT: '5',
    ALARM_RIGHT: '6',
    // FORMAT: '7',
    SET_SETTINGS: '8',
    LEFT_TEMP_DURATION: '9',
    RIGHT_TEMP_DURATION: '10',
    TEMP_LEVEL_LEFT: '11',
    TEMP_LEVEL_RIGHT: '12',
    PRIME: '13',
    DEVICE_STATUS: '14',
    ALARM_CLEAR: '16',
    // ALARM_SOLO: "17",
    // STOP_PRIME: "18",
};
export const invertedFrankenCommands = _.invert(frankenCommands);
// Commands that name a side, each with its opposite, for when the sides are flipped in settings
const OPPOSITE_SIDE_COMMANDS = {
    ALARM_LEFT: 'ALARM_RIGHT',
    ALARM_RIGHT: 'ALARM_LEFT',
    LEFT_TEMP_DURATION: 'RIGHT_TEMP_DURATION',
    RIGHT_TEMP_DURATION: 'LEFT_TEMP_DURATION',
    TEMP_LEVEL_LEFT: 'TEMP_LEVEL_RIGHT',
    TEMP_LEVEL_RIGHT: 'TEMP_LEVEL_LEFT',
};
export async function executeFunction(requestedCommand, arg = 'empty') {
    const command = areSidesFlipped() ? OPPOSITE_SIDE_COMMANDS[requestedCommand] ?? requestedCommand : requestedCommand;
    logger.debug(`Executing command | command: ${command} | arg: ${arg}`);
    const franken = await connectFranken();
    // const frankenCommand = funcNameToFrankenCommand[name];
    // if franken disconnects right before a function call this will throw
    // the error will bubble up to the main loop of the device-api-client (protocol handling)
    // and the client will crash disconnecting from device-api - this is safe, it's correctly cleaned-up,
    // deviceApiLoop will take care of reconnecting to device-api
    const response = await franken.callFunction(command, arg);
    logger.debug(response);
    return response;
}
//# sourceMappingURL=deviceApi.js.map
//# debugId=cbf69a05-8a02-5943-9be2-ba4988440b37
