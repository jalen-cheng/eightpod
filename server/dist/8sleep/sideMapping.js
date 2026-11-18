// "Left" and "right" in EightPod are the firmware's left and right, unless the sides are
// flipped in settings (for a bed whose cover or hub is fitted the other way round, or for
// people who think of the sides from the other end). The flip is applied in one place, where
// EightPod meets the firmware: commands going out, and status, buttons and sensors coming in.
// Everything else (schedules, settings, the app) only ever sees the sides as the person names them.

!function(){try{var e="undefined"!=typeof window?window:"undefined"!=typeof global?global:"undefined"!=typeof globalThis?globalThis:"undefined"!=typeof self?self:{},n=(new e.Error).stack;n&&(e._sentryDebugIds=e._sentryDebugIds||{},e._sentryDebugIds[n]="82c20bd8-f947-570c-b3d6-95b979f02796")}catch(e){}}();
import settingsDB from '../db/settings.js';
export const areSidesFlipped = () => settingsDB.data.swapSides;
const otherSide = (side) => (side === 'left' ? 'right' : 'left');
// The firmware's side for one of EightPod's sides, and the other way round (the same swap)
export const toFirmwareSide = (side) => (areSidesFlipped() ? otherSide(side) : side);
//# sourceMappingURL=sideMapping.js.map
//# debugId=82c20bd8-f947-570c-b3d6-95b979f02796
