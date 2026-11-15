
!function(){try{var e="undefined"!=typeof window?window:"undefined"!=typeof global?global:"undefined"!=typeof globalThis?globalThis:"undefined"!=typeof self?self:{},n=(new e.Error).stack;n&&(e._sentryDebugIds=e._sentryDebugIds||{},e._sentryDebugIds[n]="f1e7592a-fc92-5a0e-ac9a-cbe3ff6166eb")}catch(e){}}();
import logger from '../logger.js';
import { DAYS_OF_WEEK } from './scheduleTiming.js';
export { DAYS_OF_WEEK, getDayOfWeekIndex, getDayIndexForSchedule, subtractMinutesFromTime } from './scheduleTiming.js';
export function logJob(message, side, day, dayIndex, time) {
    const endDay = DAYS_OF_WEEK[dayIndex];
    const endHour = Number(time.split(':')[0]);
    const timeOfDay = endHour < 11 ? 'morning' : 'night';
    logger.debug(`${message} for ${side} side for ${day} -> ${endDay} -- ${endDay} ${timeOfDay} @ ${time}`);
}
//# sourceMappingURL=utils.js.map
//# debugId=f1e7592a-fc92-5a0e-ac9a-cbe3ff6166eb
