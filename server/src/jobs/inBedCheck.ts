// Lets the schedule ask whether someone is in bed without depending on the bed sensor monitor
// (which itself depends on the schedule's alarm code). The monitor registers its answer when it
// starts; on a Pod without bed sensors nothing registers and the answer is always "not known".
// Keep this file free of runtime imports so tests can load it without a Pod environment.
import type { Side } from '../db/schedulesSchema.js';

type InBedCheck = (side: Side) => boolean;

let registeredCheck: InBedCheck | undefined;

export function registerInBedCheck(check: InBedCheck | undefined) {
  registeredCheck = check;
}

// True only when the bed's sensors say someone is on that side right now
export function isSomeoneInBed(side: Side): boolean {
  return registeredCheck?.(side) ?? false;
}
