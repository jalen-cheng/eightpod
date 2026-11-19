// Saves each stay in bed as a small file on the Pod and reads them back. A night is a few
// hundred short rows (about 50 KB), and only the newest are kept, so the folder stays in the
// low megabytes. Kept beside the settings folder, not in it, so writing a night does not make
// the job scheduler rebuild every job.

!function(){try{var e="undefined"!=typeof window?window:"undefined"!=typeof global?global:"undefined"!=typeof globalThis?globalThis:"undefined"!=typeof self?self:{},n=(new e.Error).stack;n&&(e._sentryDebugIds=e._sentryDebugIds||{},e._sentryDebugIds[n]="d25f82d1-31b7-582b-9c30-66d84cd37977")}catch(e){}}();
import { mkdirSync, readFileSync, readdirSync, unlinkSync, writeFileSync } from 'fs';
import config from '../config.js';
import logger from '../logger.js';
const NIGHTS_FOLDER = `${config.dbFolder}autopilot_nights/`;
// Both sides together: about three months of nights for two sleepers, more for one
const MAX_FILES_KEPT = 180;
// Named by start time, so sorting the names sorts the nights
const fileNameOf = (record) => (`${new Date(record.startedAtMs).toISOString().slice(0, 16).replace(/[-:]/g, '')}_${record.side}.json`);
const listFileNames = () => {
    try {
        return readdirSync(NIGHTS_FOLDER).filter(name => name.endsWith('.json')).sort();
    }
    catch {
        // No night saved yet
        return [];
    }
};
export function saveNight(record) {
    try {
        mkdirSync(NIGHTS_FOLDER, { recursive: true });
        writeFileSync(`${NIGHTS_FOLDER}${fileNameOf(record)}`, JSON.stringify(record));
    }
    catch (error) {
        logger.debug(`Autopilot could not save a night: ${String(error)}`);
    }
}
export function deleteNight(record) {
    try {
        unlinkSync(`${NIGHTS_FOLDER}${fileNameOf(record)}`);
    }
    catch {
        // It was never saved
    }
}
// When a file's stay began, read from its name
const startTimeOf = (name) => Date.UTC(Number(name.slice(0, 4)), Number(name.slice(4, 6)) - 1, Number(name.slice(6, 8)), Number(name.slice(9, 11)), Number(name.slice(11, 13)));
// Saved nights, newest first. Each is a file to read and parse, so the filter is applied to
// the file names first and only the files that are wanted are opened.
export function listNights(filter = {}) {
    const { side, limit = MAX_FILES_KEPT, startedFromMs = -Infinity, startedUntilMs = Infinity } = filter;
    const names = listFileNames()
        .filter(name => !side || name.endsWith(`_${side}.json`))
        .filter(name => startTimeOf(name) >= startedFromMs && startTimeOf(name) <= startedUntilMs)
        .reverse()
        .slice(0, limit);
    return names.flatMap((name) => {
        try {
            return [JSON.parse(readFileSync(`${NIGHTS_FOLDER}${name}`, 'utf8'))];
        }
        catch {
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
        }
        catch (error) {
            logger.debug(`Autopilot could not remove an old night: ${String(error)}`);
        }
    }
}
//# sourceMappingURL=nightLog.js.map
//# debugId=d25f82d1-31b7-582b-9c30-66d84cd37977
