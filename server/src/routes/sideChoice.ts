import { z } from 'zod';
import settingsDB from '../db/settings.js';
import { Side } from '../db/schedulesSchema.js';

const SIDES: Side[] = ['left', 'right'];

// Which side a short request (a phone shortcut) is for. Leaving it out means both.
export const SideChoiceSchema = z.enum(['left', 'right', 'both']).default('both');

// The sides a request applies to. With the sides linked in Settings, a request for one side
// applies to both, the same as the app and the bed's buttons.
export async function resolveSides(sideChoice: z.infer<typeof SideChoiceSchema>): Promise<Side[]> {
  await settingsDB.read();
  return sideChoice === 'both' || settingsDB.data.linkSides ? SIDES : [sideChoice];
}
