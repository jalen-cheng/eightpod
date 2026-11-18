// The autopilot's running half: takes the bed's sensor readings in, follows each sleeper minute
// by minute, saves each stay in bed, and (when switched on in Settings) moves a side's
// temperature by a few degrees around what the schedule set. The decisions are made by the pure
// modules beside this file; this one holds the state and talks to the Pod. Pod 5 only: it needs
// the sensor bus.
//
// The autopilot takes the bed to be one sleeper's: the sides are linked while it is on, each
// side is sensed and saved on its own, and one night is steered for the whole bed.
//
// Who sets the temperature, most to least binding:
//   - a side that is off, in away mode, or under wake-up heat is left alone
//   - a temperature set by hand is held exactly until the schedule's next change or the end of
//     that third of the night, whichever comes first
//   - otherwise the schedule's temperature, plus the autopilot's offset
// When a night ends, or the autopilot is switched off, it takes its offset back out.

!function(){try{var e="undefined"!=typeof window?window:"undefined"!=typeof global?global:"undefined"!=typeof globalThis?globalThis:"undefined"!=typeof self?self:{},n=(new e.Error).stack;n&&(e._sentryDebugIds=e._sentryDebugIds||{},e._sentryDebugIds[n]="b0ca048c-7b18-541e-8b51-d9a53883fc82")}catch(e){}}();
import { readFileSync, writeFileSync } from 'fs';
import moment from 'moment-timezone';
import config from '../config.js';
import logger from '../logger.js';
import schedulesDB from '../db/schedules.js';
import settingsDB from '../db/settings.js';
import { connectFranken } from '../8sleep/frankenServer.js';
import { isSomeoneInBed } from '../jobs/inBedCheck.js';
import { isManualHoldActive } from '../jobs/manualHold.js';
import { isPreWarmActive } from '../jobs/preWarmState.js';
import { findNightDay } from '../jobs/scheduleTiming.js';
import { updateDeviceStatus } from '../routes/deviceStatus/updateDeviceStatus.js';
import { BREATHING_WINDOW_SECONDS, estimateBreathingRate, measureBreathingSpread } from './breathingRate.js';
import { HEART_RATE_WINDOW_SECONDS, countMovementSeconds, estimateHeartRate, measureSwing, } from './heartRate.js';
import { registerManualChangeListener } from './manualChanges.js';
import { deleteNight, listNights, pruneNights, saveNight } from './nightLog.js';
import { NO_LEARNED_OFFSETS, POLICY_VERSION, learnFromCorrection, nightPartAt, planTemperature, stepToward, } from './nightPlan.js';
import { countWakeUps } from './nightRecord.js';
import { NAP_UNDER_MINUTES, findScheduledTemperatureF, findUsualSleep, isNightExpected, isWithinScheduledNight, kindOfSleep, } from './scheduledBase.js';
import { DEFAULT_SLEEP_RULES, calibrateSleepRules, createSleepTracker, mergeSleepPeriods, readTrackerMinutes, } from './sleepTracker.js';
const SIDES = ['left', 'right'];
const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
// A heart-rate estimate is made this often, from the last HEART_RATE_WINDOW_SECONDS of signal
const ESTIMATE_EVERY_SECONDS = 5;
// An estimate is only kept when the signal repeats this clearly and the sleeper lay still for it
const MIN_CONFIDENCE = 0.45;
const MAX_MOVEMENT_SECONDS_IN_WINDOW = 1;
// A breathing estimate is made this often, from the last BREATHING_WINDOW_SECONDS of signal,
// and kept when it repeats this clearly and the window had little movement
const BREATHING_ESTIMATE_EVERY_SECONDS = 10;
const MIN_BREATHING_CONFIDENCE = 0.4;
const MAX_MOVEMENT_SECONDS_IN_BREATHING_WINDOW = 2;
// A minute's movement is only trusted when this many of its seconds arrived and were not flat.
// Without that check a sensor that stopped sending, or sent a dead line, would read as lying still.
const MIN_SECONDS_HEARD_IN_MINUTE = 45;
// A sleeper's usual sleep and wake times come from this many of their newest saved nights
const USUAL_SLEEP_NIGHTS = 14;
// The bed is not moved more often than this: the water takes minutes to follow
const MIN_MINUTES_BETWEEN_CHANGES = 10;
// With no schedule to say when the night ends, it is taken to be this long
const DEFAULT_NIGHT_HOURS = 8;
// Sensor readings older than this are not used
const SURROUNDINGS_STALE_MS = 2 * MINUTE_MS;
// Out of bed for less than this is the same stay and the same night: a trip to the bathroom
// does not start the night over
const OUT_GRACE_MINUTES = 30;
// A stay shorter than this is not saved: sitting on the bed, making it
const MIN_STAY_MINUTES = 20;
// A stay is cut off at this length, so a sensor stuck on "in bed" cannot grow one file for days
const MAX_STAY_MINUTES = 16 * 60;
// An open stay is written out this often, so a restart loses little
const SAVE_EVERY_MINUTES = 10;
// Calibration looks at this many of the newest nights that a sleep tracker reported on, and
// only at stays long enough to say something
const CALIBRATION_NIGHTS = 14;
const MIN_CALIBRATION_MINUTES = 60;
// A tracker's sleep belongs with a saved stay when they share at least this much time
const MIN_TRACKER_OVERLAP_MS = 10 * MINUTE_MS;
// After a restart, a night that was being steered is picked up again if its sleeper is still in
// bed and it is not long past its wake time
const RESUME_UNTIL_AFTER_WAKE_MS = 2 * HOUR_MS;
// What was learned from the sleeper's corrections and from a linked sleep tracker, and any
// night being steered. Kept beside the settings folder, not in it, so writing it does not make
// the job scheduler rebuild every job.
const STATE_FILE = `${config.dbFolder}autopilot_state.json`;
let learned = { ...NO_LEARNED_OFFSETS };
let rules = DEFAULT_SLEEP_RULES;
let trackerLink;
// A night found in the saved state at start, waiting to be picked up again or undone
let nightFromLastRun;
const bed = {};
const newSideState = () => ({
    tracker: createSleepTracker(() => rules),
    recentSeconds: [],
    minuteSwings: [],
    minuteHeartRates: [],
    minuteBreathingRates: [],
    secondsSinceEstimate: 0,
    secondsSinceBreathingEstimate: 0,
    sleep: { stage: 'out', minutesInBed: 0 },
    minutesOut: 0,
    isNightExpected: false,
});
const sides = { left: newSideState(), right: newSideState() };
let room;
let hubRoom;
const surfaces = {};
const pressures = {};
let lastPiezoAtMs = 0;
const median = (values) => {
    if (values.length === 0)
        return undefined;
    const sorted = [...values].sort((first, second) => first - second);
    return sorted[Math.floor(sorted.length / 2)];
};
const roundTo = (value, places) => (value === undefined ? undefined : Math.round(value * 10 ** places) / 10 ** places);
// A reading's value while it is fresh
const fresh = (reading, nowMs) => (reading && nowMs - reading.atMs < SURROUNDINGS_STALE_MS ? reading.value : undefined);
const readRoomF = (nowMs) => (room && nowMs - room.atMs < SURROUNDINGS_STALE_MS ? room.temperatureF : undefined);
const saveState = () => {
    try {
        const state = { learned, rules, trackerLink, night: bed.night };
        writeFileSync(STATE_FILE, JSON.stringify(state));
    }
    catch (error) {
        logger.debug(`Autopilot could not save its state: ${String(error)}`);
    }
};
// Reads a heart rate from the newest seconds of signal, when it is time to and they are clean
const estimateHeartRateNow = (state) => {
    state.secondsSinceEstimate++;
    if (state.secondsSinceEstimate < ESTIMATE_EVERY_SECONDS || state.recentSeconds.length < HEART_RATE_WINDOW_SECONDS)
        return;
    state.secondsSinceEstimate = 0;
    const window = state.recentSeconds.slice(-HEART_RATE_WINDOW_SECONDS);
    // A heartbeat cannot be read through a turn in bed, so a window with movement is passed over
    if (countMovementSeconds(window.map(measureSwing)) > MAX_MOVEMENT_SECONDS_IN_WINDOW)
        return;
    const estimate = estimateHeartRate(window.flat());
    if (estimate && estimate.confidence >= MIN_CONFIDENCE)
        state.minuteHeartRates.push(estimate.beatsPerMinute);
};
// The same for breathing, which needs a longer stretch and forgives a little movement
const estimateBreathingRateNow = (state) => {
    state.secondsSinceBreathingEstimate++;
    if (state.secondsSinceBreathingEstimate < BREATHING_ESTIMATE_EVERY_SECONDS || state.recentSeconds.length < BREATHING_WINDOW_SECONDS)
        return;
    state.secondsSinceBreathingEstimate = 0;
    if (countMovementSeconds(state.recentSeconds.map(measureSwing)) > MAX_MOVEMENT_SECONDS_IN_BREATHING_WINDOW)
        return;
    const estimate = estimateBreathingRate(state.recentSeconds.flat());
    if (estimate && estimate.confidence >= MIN_BREATHING_CONFIDENCE)
        state.minuteBreathingRates.push(estimate.breathsPerMinute);
};
// One second of a side's piezo signal, as the sensor bus delivers it
export function recordPiezoSecond(side, samples) {
    lastPiezoAtMs = Date.now();
    const state = sides[side];
    state.recentSeconds.push(samples);
    if (state.recentSeconds.length > BREATHING_WINDOW_SECONDS)
        state.recentSeconds.shift();
    state.minuteSwings.push(measureSwing(samples));
    estimateHeartRateNow(state);
    estimateBreathingRateNow(state);
}
// How far a side's pressure sensors read above the empty bed, as the presence detector has it
export function recordPressure(side, value) {
    pressures[side] = { value, atMs: Date.now() };
}
// The air at the cover and the mattress surface under each side, in °F
export function recordSurroundings(reading) {
    const atMs = Date.now();
    if (reading.roomF !== undefined)
        room = { temperatureF: reading.roomF, humidityPercent: reading.humidityPercent, atMs };
    for (const side of SIDES) {
        const temperatureF = reading.surfaceF[side];
        if (temperatureF !== undefined)
            surfaces[side] = { value: temperatureF, atMs };
    }
}
// The air at the hub on the floor, in °F. Saved with each night as a second opinion on the
// room, to show whether the reading at the cover follows the room or the sleeper. Not acted on.
export function recordHubRoom(temperatureF) {
    hubRoom = { value: temperatureF, atMs: Date.now() };
}
// A sleep is steered from the start when it began at a time that looks like the night's;
// otherwise only once it has lasted too long to be a nap
const maySteer = (state) => state.isNightExpected || (state.sleep.minutesAsleep ?? 0) >= NAP_UNDER_MINUTES;
// What each side senses, with what the autopilot is doing for the bed repeated on both
export function getAutopilotSnapshot(nowMs = Date.now()) {
    const describe = (side) => ({
        stage: sides[side].sleep.stage,
        sleepKind: sides[side].sleep.stage !== 'asleep' ? undefined : bed.night || maySteer(sides[side]) ? 'night' : 'nap',
        heartRate: roundTo(sides[side].sleep.heartRate, 0),
        breathingRate: roundTo(sides[side].sleep.breathingRate, 0),
        minutesAsleep: sides[side].sleep.minutesAsleep,
        offsetF: bed.night ? bed.lastPlan?.offsetF : undefined,
        holdingF: bed.night?.hold?.targetTemperatureF,
        lastChange: bed.lastChangeReason,
        learned,
        rules,
        tracker: trackerLink,
    });
    const roomF = readRoomF(nowMs);
    return {
        available: nowMs - lastPiezoAtMs < SURROUNDINGS_STALE_MS,
        enabled: settingsDB.data.autopilot.enabled,
        room: roomF === undefined ? undefined : { temperatureF: Math.round(roomF), humidityPercent: room?.humidityPercent },
        left: describe('left'),
        right: describe('right'),
    };
}
const summarise = ({ minutes, ...rest }) => {
    const asleep = minutes.filter(minute => minute.stage === 'asleep');
    const middle = (values) => median(values.flatMap(value => (value === undefined ? [] : [value])));
    return {
        ...rest,
        minutesLogged: minutes.length,
        heartRate: middle(asleep.map(minute => minute.heartRate)),
        breathingRate: middle(asleep.map(minute => minute.breathingRate)),
        wakeUps: countWakeUps(minutes),
    };
};
// Every saved stay with any still under way, newest first
const readAllNights = (side) => {
    const open = SIDES.flatMap(openSide => (sides[openSide].stay && (!side || openSide === side) ? [sides[openSide].stay] : []));
    const isOpen = (night) => open.some(stay => stay.side === night.side && stay.startedAtMs === night.startedAtMs);
    return [...open, ...listNights(side).filter(night => !isOpen(night))].sort((first, second) => second.startedAtMs - first.startedAtMs);
};
// A side's stays that ended on a calendar day (YYYY-MM-DD, in the Pod's time zone), in full,
// longest first. A night belongs to the morning it ended on, so today's date shows last night.
export function getNightsOn(date, side) {
    const endDate = (night) => moment
        .tz(night.startedAtMs + night.minutes.length * MINUTE_MS, settingsDB.data.timeZone)
        .format('YYYY-MM-DD');
    return readAllNights(side)
        .filter(night => endDate(night) === date)
        .sort((first, second) => second.minutes.length - first.minutes.length)
        .map(night => ({ ...summarise(night), minutes: night.minutes }));
}
// What is saved, for keeping a copy off the Pod: the nights of the last `days` days with their
// minute rows, and what has been learned
export function getNightsExport(days, nowMs = Date.now()) {
    return {
        exportedAt: new Date(nowMs).toISOString(),
        days,
        timeZone: settingsDB.data.timeZone,
        learned,
        rules,
        trackerLink,
        nights: readAllNights().filter(night => night.startedAtMs >= nowMs - days * DAY_MS),
    };
}
// Saved stays in bed without their minute rows, newest first, with any stay still under way
export function getNightSummaries(limit) {
    return readAllNights().slice(0, limit).map(summarise);
}
// When the bed's sleeper has been falling asleep and waking, from their saved nights
const readUsualSleep = () => {
    const clockMinutes = (atMs) => {
        const at = moment.tz(atMs, settingsDB.data.timeZone);
        return at.hours() * 60 + at.minutes();
    };
    return findUsualSleep(listNights()
        .filter(night => night.kind === 'night')
        .slice(0, USUAL_SLEEP_NIGHTS)
        .flatMap(night => (night.asleepAtMs === undefined || night.awakeAtMs === undefined
        ? []
        : [{ asleepMinutes: clockMinutes(night.asleepAtMs), awakeMinutes: clockMinutes(night.awakeAtMs) }])));
};
const overlapMs = (night, period) => (Math.min(night.startedAtMs + night.minutes.length * MINUTE_MS, period.awakeAtMs) - Math.max(night.startedAtMs, period.asleepAtMs));
// Fits the sleep rules to the newest nights that a sleep tracker reported on, minute by minute,
// and notes how well the bed agrees with the tracker
const recalibrate = (source, nowMs) => {
    const nights = readAllNights()
        .filter(night => night.tracker && night.kind === 'night' && night.minutes.length >= MIN_CALIBRATION_MINUTES)
        .slice(0, CALIBRATION_NIGHTS)
        .flatMap(night => (night.tracker ? [{
            minutes: night.minutes.map(minute => ({
                isInBed: minute.stage !== 'out', movementSeconds: minute.movementSeconds, breathingSpread: minute.breathingSpread,
            })),
            trackerAsleep: readTrackerMinutes(night.tracker, night.startedAtMs, night.minutes.length),
        }] : []));
    const calibration = calibrateSleepRules(nights);
    rules = calibration.rules;
    trackerLink = {
        source,
        syncedAt: new Date(nowMs).toISOString(),
        nights: calibration.nights,
        agreementPercent: calibration.agreementPercent,
        isTuned: calibration.isTuned,
    };
    saveState();
    logger.debug(`Autopilot: sleep rules after ${calibration.nights} tracker nights: ${JSON.stringify(calibration)}`);
};
// A worn sleep tracker's account of when the bed's sleeper slept. Its sleeps are filed with
// every saved stay in bed they overlap, on either side unless one is named (a night split in
// two by a restart gets both halves), and the sleep rules are then fitted again. Sending the
// same sleeps again changes nothing. Returns how many stays were matched.
export function applyTrackerSleep(source, periods, side, nowMs = Date.now()) {
    let matched = 0;
    for (const night of readAllNights(side)) {
        const overlapping = periods.filter(period => overlapMs(night, period) >= MIN_TRACKER_OVERLAP_MS);
        if (overlapping.length === 0)
            continue;
        night.tracker = { source, receivedAtMs: nowMs, ...mergeSleepPeriods(overlapping) };
        saveNight(night);
        matched++;
    }
    recalibrate(source, nowMs);
    return matched;
}
const describePlan = (plan) => {
    const reasons = [
        plan.parts.learnedF !== 0 && 'your past changes',
        plan.parts.curveF !== 0 && 'time of night',
        plan.parts.deepF !== 0 && 'first sleep cycle',
        plan.parts.roomF !== 0 && 'the room',
    ].filter(Boolean);
    const direction = plan.offsetF === 0 ? 'the set temperature' : `${Math.abs(plan.offsetF)}°F ${plan.offsetF < 0 ? 'cooler' : 'warmer'}`;
    return `heading for ${direction}${reasons.length > 0 ? ` (${reasons.join(', ')})` : ''}${plan.isLimited ? ', at its limit' : ''}`;
};
const formatClock = (timeMs) => moment.tz(timeMs, settingsDB.data.timeZone).format('h:mm A');
const readPodStatus = async () => (await connectFranken()).getDeviceStatus();
export class AutopilotMonitor {
    minuteTimer;
    hasCheckedLastRun = false;
    start() {
        try {
            const saved = JSON.parse(readFileSync(STATE_FILE, 'utf8'));
            const savedLearned = saved.learned && 'left' in saved.learned ? saved.learned.left : saved.learned;
            const savedRules = saved.rules && 'left' in saved.rules ? saved.rules.left : saved.rules;
            learned = { ...NO_LEARNED_OFFSETS, ...savedLearned };
            rules = { ...DEFAULT_SLEEP_RULES, ...savedRules };
            trackerLink = saved.trackerLink;
            nightFromLastRun = saved.night;
        }
        catch {
            // Nothing saved yet
        }
        registerManualChangeListener((_side, temperatureF) => this.noteManualChange(temperatureF));
        this.minuteTimer = setInterval(() => void this.runMinute(), MINUTE_MS);
    }
    stop() {
        clearInterval(this.minuteTimer);
        registerManualChangeListener(undefined);
        for (const side of SIDES) {
            if (sides[side].stay)
                saveNight(sides[side].stay);
        }
        saveState();
    }
    // A person set the temperature (the app, a request to the API, a side button). While the
    // autopilot has a night under way, that temperature is held exactly as set, and how far it
    // was from what the autopilot wanted is learned from when the hold ends. With the sides
    // linked this is called once for each side; the second call finds the hold already made.
    noteManualChange(temperatureF) {
        const night = bed.night;
        if (!settingsDB.data.autopilot.enabled || !night)
            return;
        // The same temperature sent again (a page refreshing, the other side) is not a new decision
        if (night.hold ? night.hold.targetTemperatureF === temperatureF : night.appliedTargetF === temperatureF)
            return;
        const nowMs = Date.now();
        const wantedF = bed.lastPlan?.targetTemperatureF;
        night.hold = {
            targetTemperatureF: temperatureF,
            part: nightPartAt((nowMs - night.asleepSinceMs) / (night.wakeAtMs - night.asleepSinceMs)),
            correctionF: wantedF === undefined ? 0 : temperatureF - wantedF,
        };
        bed.lastChangeReason = `${formatClock(nowMs)}: holding the ${temperatureF}°F you set`;
        logger.debug(`Autopilot: set by hand to ${temperatureF}°F; holding it for the ${night.hold.part} part of the night`);
        saveState();
    }
    // A hold has run its course: what it says about the sleeper's taste is kept for later nights
    endHold(night) {
        const hold = night.hold;
        if (!hold)
            return;
        if (hold.correctionF !== 0)
            learned = learnFromCorrection(learned, hold.part, hold.correctionF);
        night.hold = undefined;
        saveState();
    }
    // Once a minute: sum up the minute for each side and save it, then act for the bed
    async runMinute() {
        try {
            const nowMs = Date.now();
            if (nowMs - lastPiezoAtMs > SURROUNDINGS_STALE_MS)
                return;
            await settingsDB.read();
            if (!this.hasCheckedLastRun) {
                this.hasCheckedLastRun = true;
                await this.pickUpLastRun(nowMs);
            }
            for (const side of SIDES)
                await this.followSide(side, nowMs);
            if (!settingsDB.data.autopilot.enabled) {
                // Switched off with a night under way: the offset comes back out
                if (bed.night)
                    await this.withdraw(this.release(), nowMs);
                return;
            }
            // The night lasts until the whole bed has been empty for longer than a trip out of it
            if (bed.night && !SIDES.some(side => sides[side].stay))
                await this.withdraw(this.release(), nowMs);
            if (!bed.night) {
                const sleeperSide = SIDES.find(side => sides[side].sleep.stage === 'asleep' && maySteer(sides[side]));
                if (sleeperSide)
                    await this.beginNight(sleeperSide, nowMs);
            }
            if (bed.night && SIDES.some(side => sides[side].sleep.stage !== 'out'))
                await this.steer(bed.night, nowMs);
        }
        catch (error) {
            logger.error(error);
        }
    }
    // One side's minute: its sleep state, and its row in the stay being saved
    async followSide(side, nowMs) {
        const state = sides[side];
        const isSignalGood = state.minuteSwings.length >= MIN_SECONDS_HEARD_IN_MINUTE && (median(state.minuteSwings) ?? 0) > 0;
        const minute = {
            isInBed: isSomeoneInBed(side),
            heartRate: median(state.minuteHeartRates),
            movementSeconds: isSignalGood ? countMovementSeconds(state.minuteSwings) : undefined,
            breathingRate: median(state.minuteBreathingRates),
            breathingSpread: measureBreathingSpread(state.minuteBreathingRates),
        };
        state.sleep = state.tracker.addMinute(minute);
        state.minuteHeartRates = [];
        state.minuteBreathingRates = [];
        state.minuteSwings = [];
        if (state.sleep.stage === 'asleep')
            await this.noteAsleep(side, nowMs);
        this.logMinute(side, minute, nowMs);
    }
    // After a restart: a night that was being steered carries on if someone is still in bed, so
    // the curve does not start over at four in the morning. Otherwise its offset is taken out.
    async pickUpLastRun(nowMs) {
        const night = nightFromLastRun;
        nightFromLastRun = undefined;
        if (!night)
            return;
        const isStillTheNight = settingsDB.data.autopilot.enabled && SIDES.some(isSomeoneInBed)
            && nowMs < night.wakeAtMs + RESUME_UNTIL_AFTER_WAKE_MS && nowMs - night.asleepSinceMs < MAX_STAY_MINUTES * MINUTE_MS;
        if (isStillTheNight) {
            bed.night = night;
            logger.debug('Autopilot: carrying on the night after a restart');
        }
        else {
            await this.withdraw(night, nowMs);
        }
        saveState();
    }
    // Marks the stay with when sleep began and how late it has lasted so far. Whether it is a nap
    // is a matter of its length, so that is settled as it goes; whether it looks like the night's
    // sleep, which decides if the autopilot steers it from the start, is judged once at its onset.
    async noteAsleep(side, nowMs) {
        const state = sides[side];
        state.stay ??= { side, startedAtMs: nowMs - state.sleep.minutesInBed * MINUTE_MS, minutes: [], policy: POLICY_VERSION };
        const stay = state.stay;
        if (stay.asleepAtMs === undefined) {
            const asleepAtMs = nowMs - (state.sleep.minutesAsleep ?? 0) * MINUTE_MS;
            await schedulesDB.read();
            const asleepAt = moment.tz(asleepAtMs, settingsDB.data.timeZone);
            const scheduledNight = schedulesDB.data[side][findNightDay(asleepAt, schedulesDB.data[side])];
            stay.asleepAtMs = asleepAtMs;
            // Sleep is only known once the stillness has lasted; this is when the bed could first act on it
            stay.asleepConfirmedAtMs = nowMs;
            state.isNightExpected = isNightExpected(asleepAt.format('HH:mm'), readUsualSleep(), scheduledNight);
            const hint = state.isNightExpected ? '' : ', at an hour that looks like a nap';
            logger.debug(`Autopilot: ${side} side fell asleep at ${asleepAt.format()}${hint}`);
        }
        stay.awakeAtMs = nowMs;
        stay.kind = kindOfSleep((nowMs - stay.asleepAtMs) / MINUTE_MS);
    }
    // Adds the minute to the stay being saved. The stay ends once the side has been empty for
    // longer than a trip out of bed takes.
    logMinute(side, minute, nowMs) {
        const state = sides[side];
        if (minute.isInBed) {
            state.stay ??= { side, startedAtMs: nowMs - MINUTE_MS, minutes: [], policy: POLICY_VERSION };
            state.minutesOut = 0;
        }
        else if (state.stay) {
            state.minutesOut++;
        }
        const stay = state.stay;
        if (!stay)
            return;
        stay.minutes.push({
            movementSeconds: minute.movementSeconds,
            heartRate: roundTo(minute.heartRate, 0),
            breathingRate: roundTo(minute.breathingRate, 1),
            breathingSpread: roundTo(minute.breathingSpread, 1),
            pressure: roundTo(fresh(pressures[side], nowMs), 0),
            stage: state.sleep.stage,
            offsetF: bed.night ? bed.lastPlan?.offsetF : undefined,
            roomF: roundTo(readRoomF(nowMs), 1),
            hubRoomF: roundTo(fresh(hubRoom, nowMs), 1),
            surfaceF: roundTo(fresh(surfaces[side], nowMs), 1),
        });
        if (state.minutesOut >= OUT_GRACE_MINUTES || stay.minutes.length >= MAX_STAY_MINUTES)
            this.endStay(side);
        else if (stay.minutes.length % SAVE_EVERY_MINUTES === 0)
            saveNight(stay);
    }
    endStay(side) {
        const state = sides[side];
        const stay = state.stay;
        if (!stay)
            return;
        // The empty minutes at the end were the wait to see whether they would come back
        stay.minutes = stay.minutes.slice(0, stay.minutes.length - state.minutesOut);
        if (stay.minutes.length >= MIN_STAY_MINUTES)
            saveNight(stay);
        else
            deleteNight(stay);
        pruneNights();
        state.stay = undefined;
        state.minutesOut = 0;
        state.isNightExpected = false;
    }
    // Lets go of the night: nothing more is steered. A hold still running is learned from.
    release() {
        const night = bed.night;
        if (night?.hold?.correctionF)
            learned = learnFromCorrection(learned, night.hold.part, night.hold.correctionF);
        bed.night = undefined;
        bed.lastPlan = undefined;
        bed.lastBaseF = undefined;
        saveState();
        return night;
    }
    // The temperature the schedule wants for a side now, or `fallbackF` at an hour it does not cover
    async findBase(side, nowMs, fallbackF) {
        await schedulesDB.read();
        const now = moment.tz(nowMs, settingsDB.data.timeZone);
        const scheduledNight = schedulesDB.data[side][findNightDay(now, schedulesDB.data[side])];
        const clock = now.format('HH:mm');
        const isCovered = scheduledNight.power.enabled && isWithinScheduledNight(scheduledNight, clock);
        return isCovered ? findScheduledTemperatureF(scheduledNight, clock) : fallbackF;
    }
    // Sets the whole bed, as the linked sides are set from the app. A side that is off stays
    // off: setting a temperature never switches one on.
    async setTemperature(podStatus, temperatureF) {
        const sidesThatAreOn = SIDES.filter(side => podStatus[side].isOn);
        if (sidesThatAreOn.length === 0)
            return;
        await updateDeviceStatus(Object.fromEntries(sidesThatAreOn.map(side => [side, { targetTemperatureF: temperatureF }])));
    }
    // Takes the autopilot's offset back out after a night has ended, so the bed is not left at a
    // temperature nobody chose. It only touches a bed that is on and still set to what the
    // autopilot last set: a temperature someone set since, or one being held, is theirs.
    async withdraw(night, nowMs) {
        if (night?.appliedTargetF === undefined || night.hold)
            return;
        const podStatus = await readPodStatus();
        if (!podStatus[night.side].isOn || podStatus[night.side].targetTemperatureF !== night.appliedTargetF)
            return;
        const baseTemperatureF = Math.round(await this.findBase(night.side, nowMs, night.temperatureAtOnsetF));
        if (baseTemperatureF === night.appliedTargetF)
            return;
        logger.debug(`Autopilot: the night is over; back to ${baseTemperatureF}°F`);
        await this.setTemperature(podStatus, baseTemperatureF);
    }
    // Sleep has begun on a side that is on: note when it should end and what the room is now
    async beginNight(side, nowMs) {
        const podStatus = await readPodStatus();
        if (!podStatus[side].isOn)
            return;
        await schedulesDB.read();
        const now = moment.tz(nowMs, settingsDB.data.timeZone);
        const scheduledNight = schedulesDB.data[side][findNightDay(now, schedulesDB.data[side])];
        let wakeAtMs = nowMs + DEFAULT_NIGHT_HOURS * HOUR_MS;
        if (scheduledNight.power.enabled) {
            const [hour, minute] = scheduledNight.alarm.time.split(':').map(Number);
            const wakeAt = now.clone().hour(hour).minute(minute).second(0);
            if (!wakeAt.isAfter(now))
                wakeAt.add(1, 'day');
            // A wake time most of a day away is not this night's
            if (wakeAt.diff(now, 'hours') <= 14)
                wakeAtMs = wakeAt.valueOf();
        }
        bed.night = {
            side,
            asleepSinceMs: sides[side].stay?.asleepAtMs ?? nowMs,
            wakeAtMs,
            temperatureAtOnsetF: podStatus[side].targetTemperatureF,
            roomAtOnsetF: readRoomF(nowMs),
        };
        saveState();
        logger.debug(`Autopilot: steering the night (asleep on the ${side} side) until ${moment(wakeAtMs).format()}`);
    }
    // Moves the bed one step toward what the plan wants, if it has not just been moved. Once a
    // night is under way this runs by the clock, whether or not the sleeper is stirring.
    async steer(night, nowMs) {
        const { side } = night;
        if (settingsDB.data[side].awayMode || isManualHoldActive(side) || isPreWarmActive(side))
            return;
        const podStatus = await readPodStatus();
        if (!podStatus[side].isOn)
            return;
        const baseTemperatureF = await this.findBase(side, nowMs, night.temperatureAtOnsetF);
        const progress = Math.min(1, (nowMs - night.asleepSinceMs) / (night.wakeAtMs - night.asleepSinceMs));
        const plan = planTemperature({
            baseTemperatureF,
            progress,
            minutesSinceSleepOnset: (nowMs - night.asleepSinceMs) / MINUTE_MS,
            learned,
            roomAtSleepOnsetF: night.roomAtOnsetF,
            roomNowF: readRoomF(nowMs),
        });
        const hasBaseChanged = bed.lastBaseF !== undefined && bed.lastBaseF !== baseTemperatureF;
        bed.lastBaseF = baseTemperatureF;
        bed.lastPlan = plan;
        // A temperature set by hand stands until the schedule moves on or its part of the night ends
        if (night.hold) {
            if (!hasBaseChanged && nightPartAt(progress) === night.hold.part)
                return;
            this.endHold(night);
        }
        const currentTemperatureF = podStatus[side].targetTemperatureF;
        // When the schedule changes the temperature, the offset goes with it at once. Any other
        // move by the autopilot is one step at a time.
        const targetTemperatureF = hasBaseChanged ? plan.targetTemperatureF : stepToward(currentTemperatureF, plan.targetTemperatureF);
        if (targetTemperatureF === currentTemperatureF)
            return;
        const minutesSinceChange = bed.lastChangeAtMs === undefined ? Infinity : (nowMs - bed.lastChangeAtMs) / MINUTE_MS;
        if (minutesSinceChange < MIN_MINUTES_BETWEEN_CHANGES && !hasBaseChanged)
            return;
        bed.lastChangeAtMs = nowMs;
        bed.lastChangeReason = `${formatClock(nowMs)}: ${targetTemperatureF}°F, ${describePlan(plan)}`;
        logger.debug(`Autopilot: bed to ${targetTemperatureF}°F, ${describePlan(plan)}`);
        night.appliedTargetF = targetTemperatureF;
        for (const sensedSide of SIDES) {
            const stay = sides[sensedSide].stay;
            if (stay)
                stay.steered = true;
        }
        saveState();
        await this.setTemperature(podStatus, targetTemperatureF);
    }
}
//# sourceMappingURL=autopilotMonitor.js.map
//# debugId=b0ca048c-7b18-541e-8b51-d9a53883fc82
