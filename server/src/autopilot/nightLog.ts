// Saves each stay in bed as a small file on the Pod and reads them back. A night is a few
// hundred short rows (about 30 KB), and only the newest are kept, so the folder stays in the
// low megabytes. Kept beside the settings folder, not in it, so writing a night does not make
// the job scheduler rebuild every job.
import { mkdirSync, readFileSync, readdirSync, unlinkSync, writeFileSync } from 'fs';
import config from '../config.js';
import logger from '../logger.js';
import type { Side } from '../db/schedulesSchema.js';
import type { NightRecord } from './nightRecord.js';

const NIGHTS_FOLDER = `${config.dbFolder}autopilot_nights/`;
// Both sides together: about three months of nights for two sleepers, more for one
const MAX_FILES_KEPT = 180;

// Named by start time, so sorting the names sorts the nights
const fileNameOf = (record: Pick<NightRecord, 'side' | 'startedAtMs'>) => (
  `${new Date(record.startedAtMs).toISOString().slice(0, 16).replace(/[-:]/g, '')}_${record.side}.json`
);

const listFileNames = (): string[] => {
  try {
    return readdirSync(NIGHTS_FOLDER).filter(name => name.endsWith('.json')).sort();
  } catch {
    // No night saved yet
    return [];
  }
};

export function saveNight(record: NightRecord) {
  try {
    mkdirSync(NIGHTS_FOLDER, { recursive: true });
    writeFileSync(`${NIGHTS_FOLDER}${fileNameOf(record)}`, JSON.stringify(record));
  } catch (error: unknown) {
    logger.debug(`Autopilot could not save a night: ${String(error)}`);
  }
}

export function deleteNight(record: Pick<NightRecord, 'side' | 'startedAtMs'>) {
  try {
    unlinkSync(`${NIGHTS_FOLDER}${fileNameOf(record)}`);
  } catch {
    // It was never saved
  }
}

// Saved nights, newest first, for one side or both
export function listNights(side?: Side, limit: number = MAX_FILES_KEPT): NightRecord[] {
  const names = listFileNames().filter(name => !side || name.endsWith(`_${side}.json`)).reverse().slice(0, limit);
  return names.flatMap((name) => {
    try {
      return [JSON.parse(readFileSync(`${NIGHTS_FOLDER}${name}`, 'utf8')) as NightRecord];
    } catch {
      return [];
    }
  });
}

// Drops the oldest files once there are more than are kept
export function pruneNights() {
  const names = listFileNames();
  for (const name of names.slice(0, Math.max(0, names.length - MAX_FILES_KEPT))) {
    try {
      unlinkSync(`${NIGHTS_FOLDER}${name}`);
    } catch (error: unknown) {
      logger.debug(`Autopilot could not remove an old night: ${String(error)}`);
    }
  }
}
