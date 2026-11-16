
!function(){try{var e="undefined"!=typeof window?window:"undefined"!=typeof global?global:"undefined"!=typeof globalThis?globalThis:"undefined"!=typeof self?self:{},n=(new e.Error).stack;n&&(e._sentryDebugIds=e._sentryDebugIds||{},e._sentryDebugIds[n]="ce9af37d-7127-5fd7-afb3-fd6345f54568")}catch(e){}}();
import { z } from 'zod';
import settingsDB from '../db/settings.js';
const SIDES = ['left', 'right'];
// Which side a short request (a phone shortcut) is for. Leaving it out means both.
export const SideChoiceSchema = z.enum(['left', 'right', 'both']).default('both');
// The sides a request applies to. With the sides linked in Settings, a request for one side
// applies to both, the same as the app and the bed's buttons.
export async function resolveSides(sideChoice) {
    await settingsDB.read();
    return sideChoice === 'both' || settingsDB.data.linkSides ? SIDES : [sideChoice];
}
//# sourceMappingURL=sideChoice.js.map
//# debugId=ce9af37d-7127-5fd7-afb3-fd6345f54568
