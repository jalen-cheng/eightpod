// "Left" and "right" in Free Sleep are the firmware's left and right, unless the sides are
// flipped in settings (for a bed whose cover or hub is fitted the other way round, or for
// people who think of the sides from the other end). The flip is applied in one place, where
// Free Sleep meets the firmware: commands going out, and status, buttons and sensors coming in.
// Everything else (schedules, settings, the app) only ever sees the sides as the person names them.
import settingsDB from '../db/settings.js';
import type { Side } from '../db/schedulesSchema.js';

export const areSidesFlipped = (): boolean => settingsDB.data.swapSides;

const otherSide = (side: Side): Side => (side === 'left' ? 'right' : 'left');

// The firmware's side for one of Free Sleep's sides, and the other way round (the same swap)
export const toFirmwareSide = (side: Side): Side => (areSidesFlipped() ? otherSide(side) : side);
