// "Left" and "right" in Free Sleep are the firmware's left and right, unless the sides are
// flipped in settings (for a bed whose cover or hub is fitted the other way round, or for
// people who think of the sides from the other end). The flip is applied in one place, where
// Free Sleep meets the firmware: commands going out, and status, buttons and sensors coming in.
// Everything else (schedules, settings, the app) only ever sees the sides as the person names them.

!function(){try{var e="undefined"!=typeof window?window:"undefined"!=typeof global?global:"undefined"!=typeof globalThis?globalThis:"undefined"!=typeof self?self:{},n=(new e.Error).stack;n&&(e._sentryDebugIds=e._sentryDebugIds||{},e._sentryDebugIds[n]="b39aab05-be1f-5b96-bc4b-c1008bcf5e04")}catch(e){}}();
import settingsDB from '../db/settings.js';
export const areSidesFlipped = () => settingsDB.data.swapSides;
const otherSide = (side) => (side === 'left' ? 'right' : 'left');
// The firmware's side for one of Free Sleep's sides, and the other way round (the same swap)
export const toFirmwareSide = (side) => (areSidesFlipped() ? otherSide(side) : side);
//# sourceMappingURL=sideMapping.js.map
//# debugId=b39aab05-be1f-5b96-bc4b-c1008bcf5e04
