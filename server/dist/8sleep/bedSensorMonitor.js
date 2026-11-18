// Listens to what the bed's own sensors report:
// - the capacitive sensors, to know whether someone is in bed, and to run what the settings say
//   that should set off (see jobs/presenceActions.ts);
// - the measured water temperature of each side (see measuredWater.ts).
//
// A Pod 5's firmware publishes both on its local message bus (NATS). A Pod without that bus, or
// without those subjects, simply never produces a reading: presence stays "not available", no
// measured temperature is shown, and nothing else is affected.

!function(){try{var e="undefined"!=typeof window?window:"undefined"!=typeof global?global:"undefined"!=typeof globalThis?globalThis:"undefined"!=typeof self?self:{},n=(new e.Error).stack;n&&(e._sentryDebugIds=e._sentryDebugIds||{},e._sentryDebugIds[n]="a330650c-62b3-5818-a8c5-e2b3a6e36a10")}catch(e){}}();
import { recordPiezoSecond, recordPressure, recordSurroundings } from '../autopilot/autopilotMonitor.js';
import { readFileSync, writeFileSync } from 'fs';
import { registerInBedCheck } from '../jobs/inBedCheck.js';
import cbor from 'cbor';
import moment from 'moment-timezone';
import { connect } from 'nats';
import logger from '../logger.js';
import config from '../config.js';
import settingsDB from '../db/settings.js';
import { connectFranken } from './frankenServer.js';
import { PRESENCE_DELTAS, createPresenceDetector, isNeighbourSpillOver, } from './presenceDetector.js';
import { UNTIL_OUT_OF_BED, createBedSession, takeDueActions, trackBedSession, } from '../jobs/presenceActions.js';
import { executeAlarm, getOneOffAlarmSettings } from '../jobs/alarmScheduler.js';
import { updateDeviceStatus } from '../routes/deviceStatus/updateDeviceStatus.js';
import { recordWaterReading } from './measuredWater.js';
import { toFirmwareSide } from './sideMapping.js';
const NATS_SERVER = process.env.NATS_SERVER || '127.0.0.1:4222';
const CAPACITIVE_SUBJECT = 'rawmem.sens.capsense';
const WATER_SUBJECT = 'rawmem.frz.temp';
const SIDES = ['left', 'right'];
const RECONNECT_WAIT_MS = 60_000;
// How often the stays in bed are checked against the settings
const ACTION_CHECK_INTERVAL_MS = 10_000;
// A reading older than this means the sensors have gone quiet
const STALE_READING_MS = 30_000;
const SECONDS_PER_HOUR = 3_600;
// The longest the firmware keeps a side on
const MAX_ON_HOURS = 12;
// Kept beside the databases, not in the watched settings folder, so saving never rebuilds the jobs
const STATE_FILE = `${config.dbFolder}presence_state.json`;
// The piezo sensor that feels heartbeats and movement, 500 samples a second, a channel per side
const PIEZO_SUBJECT = 'rawmem.sens.piezo';
// The air at the cover (`amb`), humidity (`hu`) and the mattress surface per side, all read as
// hundredths of a unit (2143 is 21.43 °C). That reading fits a room and a bed; it was not
// checked against a thermometer.
const BED_TEMPERATURE_SUBJECT = 'rawmem.sens.bedtemp';
const hundredthsCelsiusToF = (hundredths) => hundredths / 100 * 9 / 5 + 32;
// Older than this and the bed may have changed hands; start afresh
const STATE_MAX_AGE_MS = 30 * 60_000;
const STATE_SAVE_INTERVAL_MS = 60_000;
// Reads the saved state if there is one and it is recent enough to trust
function loadSavedState(nowMs) {
    try {
        const savedState = JSON.parse(readFileSync(STATE_FILE, 'utf8'));
        // A file from the future means the clock was wrong when one of the two was read: not trusted
        const ageMs = nowMs - savedState.savedAtMs;
        return ageMs >= 0 && ageMs <= STATE_MAX_AGE_MS ? savedState : undefined;
    }
    catch {
        return undefined;
    }
}
const latest = {};
let lastReadingAtMs = 0;
// Set by the running monitor, for requests that act on it
let markRunningBedEmpty;
// Tells the detectors the bed is empty right now. Returns false when the sensors are not running.
export function markBedEmpty() {
    if (!markRunningBedEmpty)
        return false;
    markRunningBedEmpty();
    return true;
}
// What the sensors say right now, for the API and the app
export function getPresenceSnapshot(nowMs = Date.now()) {
    // Spill-over from the other side is reported as empty, as the actions treat it
    const withoutSpillOver = (side) => {
        const estimate = latest[side];
        if (!estimate)
            return undefined;
        return isNeighbourSpillOver(estimate, latest[side === 'left' ? 'right' : 'left']) ? { ...estimate, present: false } : estimate;
    };
    return { available: nowMs - lastReadingAtMs < STALE_READING_MS, left: withoutSpillOver('left'), right: withoutSpillOver('right') };
}
export class BedSensorMonitor {
    connection;
    reconnectTimer;
    actionTimer;
    isStopped = false;
    hasWarned = false;
    saveTimer;
    detectors;
    // One stay per side, or one for the whole bed ("both") while the sides are linked
    sessions;
    constructor() {
        const savedState = loadSavedState(Date.now());
        if (savedState)
            logger.info('Bed sensor monitor is carrying on from its saved state');
        this.detectors = {
            left: createPresenceDetector(savedState?.sides.left),
            right: createPresenceDetector(savedState?.sides.right),
        };
        this.sessions = savedState?.sessions ?? { left: createBedSession(), right: createBedSession(), both: createBedSession() };
        Object.assign(latest, savedState?.sides);
    }
    // Starts every side afresh from an empty bed: baselines are learned again and no stay is open
    markBedEmpty() {
        for (const side of ['left', 'right']) {
            this.detectors[side].reset();
            delete latest[side];
        }
        Object.assign(this.sessions, { left: createBedSession(), right: createBedSession(), both: createBedSession() });
        logger.info('Bed sensor monitor was told the bed is empty; learning the empty bed again');
    }
    start() {
        markRunningBedEmpty = () => this.markBedEmpty();
        registerInBedCheck(side => this.isSomeoneOn(side));
        void this.listen();
        this.actionTimer = setInterval(() => void this.runActions(), ACTION_CHECK_INTERVAL_MS);
        this.saveTimer = setInterval(() => this.saveState(), STATE_SAVE_INTERVAL_MS);
    }
    async stop() {
        this.isStopped = true;
        clearTimeout(this.reconnectTimer);
        clearInterval(this.actionTimer);
        clearInterval(this.saveTimer);
        this.saveState();
        await this.connection?.close().catch(() => undefined);
    }
    // Writes what has been learned to disk. Skipped until the sensors have reported, so an empty
    // start never overwrites a good file.
    saveState() {
        if (lastReadingAtMs === 0)
            return;
        try {
            const savedState = { savedAtMs: Date.now(), sides: latest, sessions: this.sessions };
            writeFileSync(STATE_FILE, JSON.stringify(savedState));
        }
        catch (error) {
            logger.debug(`Bed sensor monitor could not save its state: ${String(error)}`);
        }
    }
    // Connects to the firmware's message bus and handles readings until the connection ends,
    // then tries again later. A Pod without the bus is retried quietly.
    async listen() {
        try {
            this.connection = await connect({ servers: NATS_SERVER, maxReconnectAttempts: -1, name: 'free-sleep-bed-sensors' });
            this.subscribe(CAPACITIVE_SUBJECT, message => this.handleReading(message));
            this.subscribe(WATER_SUBJECT, (message) => {
                for (const side of SIDES) {
                    const reportedValue = message[toFirmwareSide(side)];
                    if (typeof reportedValue === 'number')
                        recordWaterReading(side, reportedValue);
                }
            });
            this.subscribe(PIEZO_SUBJECT, (message) => {
                for (const side of SIDES) {
                    const bytes = message[`${toFirmwareSide(side)}1`];
                    if (!Buffer.isBuffer(bytes))
                        continue;
                    // 32-bit samples, low byte first
                    const samples = [];
                    for (let offset = 0; offset + 4 <= bytes.length; offset += 4)
                        samples.push(bytes.readInt32LE(offset));
                    recordPiezoSecond(side, samples);
                }
            });
            this.subscribe(BED_TEMPERATURE_SUBJECT, (message) => {
                recordSurroundings({
                    roomF: typeof message.amb === 'number' ? hundredthsCelsiusToF(message.amb) : undefined,
                    humidityPercent: typeof message.hu === 'number' ? Math.round(message.hu / 100) : undefined,
                    surfaceF: Object.fromEntries(SIDES.flatMap((side) => {
                        const centre = message[toFirmwareSide(side)]?.cen;
                        return typeof centre === 'number' ? [[side, hundredthsCelsiusToF(centre)]] : [];
                    })),
                });
            });
            logger.info('Bed sensor monitor is listening');
            // Resolves when the connection ends for good
            await this.connection.closed();
        }
        catch (error) {
            if (!this.hasWarned) {
                const reason = error instanceof Error ? error.message : String(error);
                logger.warn(`Bed sensor monitor cannot reach the bed sensors (${reason}); it will keep trying`);
                this.hasWarned = true;
            }
        }
        if (!this.isStopped)
            this.reconnectTimer = setTimeout(() => void this.listen(), RECONNECT_WAIT_MS);
    }
    // Decodes every message on a subject and hands it on; one bad message is logged and skipped
    subscribe(subject, handle) {
        this.connection?.subscribe(subject, {
            callback: (error, natsMessage) => {
                if (error)
                    return;
                try {
                    handle(cbor.decodeFirstSync(Buffer.from(natsMessage.data)));
                }
                catch (decodeError) {
                    logger.debug(`Bed sensor monitor could not read a message on ${subject}: ${String(decodeError)}`);
                }
            },
        });
    }
    handleReading(message) {
        const nowMs = Date.now();
        const presenceDelta = PRESENCE_DELTAS[settingsDB.data.presence.sensitivity];
        for (const side of SIDES) {
            const reading = message[toFirmwareSide(side)];
            if (!reading)
                continue;
            const estimate = this.detectors[side].update(reading, nowMs, presenceDelta);
            recordPressure(side, estimate.signal - estimate.baseline);
            const previous = latest[side];
            if (previous?.present === estimate.present) {
                latest[side] = { ...estimate, changedAt: previous.changedAt };
                continue;
            }
            if (previous)
                logger.debug(`Presence: ${side} side is now ${estimate.present ? 'in bed' : 'empty'}`);
            latest[side] = { ...estimate, changedAt: new Date(nowMs).toISOString() };
        }
        lastReadingAtMs = nowMs;
    }
    // Whether someone is on a side, after discounting spill-over from a person on the other side
    isSomeoneOn(side) {
        const estimate = latest[side];
        if (!estimate?.present)
            return false;
        return !isNeighbourSpillOver(estimate, latest[side === 'left' ? 'right' : 'left']);
    }
    // Checks each stay in bed against the settings and runs what has come due
    async runActions() {
        try {
            const nowMs = Date.now();
            if (!getPresenceSnapshot(nowMs).available)
                return;
            await settingsDB.read();
            const settings = settingsDB.data;
            const { wakeAfterHours, turnOnWhenInBed } = settings.presence;
            const units = settings.linkSides
                ? [{ key: 'both', sides: SIDES }]
                : SIDES.map(side => ({ key: side, sides: [side] }));
            for (const unit of units) {
                // A side in away mode has nobody to act for
                const activeSides = unit.sides.filter(side => !settings[side].awayMode);
                const isPresentNow = activeSides.some(side => this.isSomeoneOn(side));
                const session = trackBedSession(this.sessions[unit.key], isPresentNow, nowMs);
                if (activeSides.length === 0)
                    continue;
                const isInBed = session.inBedSinceMs !== undefined;
                if (!session.isTurnOffDue && (!isInBed || (!wakeAfterHours.enabled && !turnOnWhenInBed.enabled)))
                    continue;
                // The firmware is only asked whether the bed is on when turning it on or off is possible
                const mayChangePower = session.isTurnOffDue || (turnOnWhenInBed.enabled && !session.hasTurnedOn && isPresentNow);
                const isOn = mayChangePower ? await this.isAnySideOn(activeSides) : true;
                const dueActions = takeDueActions(session, settings.presence, { nowMs, isPresentNow, isOn });
                for (const action of dueActions)
                    await this.runAction(action, activeSides);
            }
        }
        catch (error) {
            logger.error(error);
        }
    }
    async isAnySideOn(sides) {
        const deviceStatus = await (await connectFranken()).getDeviceStatus();
        return sides.some(side => deviceStatus[side].isOn);
    }
    async runAction(action, sides) {
        const settings = settingsDB.data;
        const now = moment.tz(settings.timeZone);
        logger.info(`Presence: running "${action}" for ${sides.join(' and ')}`);
        if (action === 'wake') {
            // Vibrates as that day's alarm is set up to, whether or not the side is on
            for (const side of sides) {
                const { vibrationIntensity, duration, vibrationPattern, turnOffAfterDismiss } = getOneOffAlarmSettings(settings, side, now);
                await executeAlarm({ side, vibrationIntensity, duration, vibrationPattern, turnOffAfterDismiss, force: true });
            }
            return;
        }
        if (action === 'turnOff') {
            await updateDeviceStatus(Object.fromEntries(sides.map(side => [side, { isOn: false }])), { isManual: true });
            return;
        }
        // Turn on at the chosen temperature. "Until I get out of bed" uses the firmware's longest
        // timer; the stay ending is what turns the bed off (the 'turnOff' action above).
        const { temperatureF, stayOn } = settings.presence.turnOnWhenInBed;
        // The length is passed as the on-time itself, so "ignore the schedule" holds for the stay
        // and not for the length set for turning on by hand
        const onSeconds = (stayOn === UNTIL_OUT_OF_BED ? MAX_ON_HOURS : stayOn) * SECONDS_PER_HOUR;
        const update = Object.fromEntries(sides.map(side => [side, { isOn: true, targetTemperatureF: temperatureF }]));
        await updateDeviceStatus(update, { isManual: true, onSeconds });
    }
}
//# sourceMappingURL=bedSensorMonitor.js.map
//# debugId=a330650c-62b3-5818-a8c5-e2b3a6e36a10
