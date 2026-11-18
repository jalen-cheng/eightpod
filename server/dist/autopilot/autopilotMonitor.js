// The autopilot's running half: takes the bed's sensor readings in, follows each sleeper minute
// by minute, and (when switched on in Settings) moves a side's temperature by a few degrees
// around what the schedule set. The decisions are made by the pure modules beside this file;
// this one holds the state and talks to the Pod. Pod 5 only: it needs the sensor bus.

!function(){try{var e="undefined"!=typeof window?window:"undefined"!=typeof global?global:"undefined"!=typeof globalThis?globalThis:"undefined"!=typeof self?self:{},n=(new e.Error).stack;n&&(e._sentryDebugIds=e._sentryDebugIds||{},e._sentryDebugIds[n]="d50ec72e-d47f-5847-b4c1-3f2763fdbcee")}catch(e){}}();
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
import { HEART_RATE_WINDOW_SECONDS, countMovementSeconds, estimateHeartRate, measureSwing, } from './heartRate.js';
import { registerManualChangeListener } from './manualChanges.js';
import { NO_LEARNED_OFFSETS, learnFromCorrection, nightPartAt, planTemperature, } from './nightPlan.js';
import { findScheduledTemperatureF } from './scheduledBase.js';
import { createSleepTracker } from './sleepTracker.js';
const SIDES = ['left', 'right'];
const MINUTE_MS = 60_000;
// A heart-rate estimate is made this often, from the last HEART_RATE_WINDOW_SECONDS of signal
const ESTIMATE_EVERY_SECONDS = 5;
// An estimate is only kept when the signal repeats this clearly and the sleeper lay still for it
const MIN_CONFIDENCE = 0.45;
const MAX_MOVEMENT_SECONDS_IN_WINDOW = 1;
// The bed is not moved more often than this: the water takes minutes to follow
const MIN_MINUTES_BETWEEN_CHANGES = 10;
// With no schedule to say when the night ends, it is taken to be this long
const DEFAULT_NIGHT_HOURS = 8;
// Sensor readings older than this are not used
const SURROUNDINGS_STALE_MS = 2 * MINUTE_MS;
// What was learned from the sleeper's corrections. Kept beside the settings folder, not in it,
// so writing it does not make the job scheduler rebuild every job.
const STATE_FILE = `${config.dbFolder}autopilot_state.json`;
const newSideState = () => ({
    tracker: createSleepTracker(),
    recentSeconds: [],
    minuteSwings: [],
    minuteHeartRates: [],
    secondsSinceEstimate: 0,
    sleep: { stage: 'out', minutesInBed: 0 },
});
const sides = { left: newSideState(), right: newSideState() };
let learned = { left: { ...NO_LEARNED_OFFSETS }, right: { ...NO_LEARNED_OFFSETS } };
let room;
const surfaces = {};
let lastPiezoAtMs = 0;
const median = (values) => {
    if (values.length === 0)
        return undefined;
    const sorted = [...values].sort((first, second) => first - second);
    return sorted[Math.floor(sorted.length / 2)];
};
// One second of a side's piezo signal, as the sensor bus delivers it
export function recordPiezoSecond(side, samples) {
    lastPiezoAtMs = Date.now();
    const state = sides[side];
    state.recentSeconds.push(samples);
    if (state.recentSeconds.length > HEART_RATE_WINDOW_SECONDS)
        state.recentSeconds.shift();
    state.minuteSwings.push(measureSwing(samples));
    state.secondsSinceEstimate++;
    if (state.secondsSinceEstimate < ESTIMATE_EVERY_SECONDS || state.recentSeconds.length < HEART_RATE_WINDOW_SECONDS)
        return;
    state.secondsSinceEstimate = 0;
    // A heartbeat cannot be read through a turn in bed, so a window with movement is passed over
    if (countMovementSeconds(state.recentSeconds.map(measureSwing)) > MAX_MOVEMENT_SECONDS_IN_WINDOW)
        return;
    const estimate = estimateHeartRate(state.recentSeconds.flat());
    if (estimate && estimate.confidence >= MIN_CONFIDENCE)
        state.minuteHeartRates.push(estimate.beatsPerMinute);
}
// The air at the cover and the mattress surface under each side, in °F
export function recordSurroundings(reading) {
    const atMs = Date.now();
    if (reading.roomF !== undefined)
        room = { temperatureF: reading.roomF, humidityPercent: reading.humidityPercent, atMs };
    for (const side of SIDES) {
        const temperatureF = reading.surfaceF[side];
        if (temperatureF !== undefined)
            surfaces[side] = { temperatureF, atMs };
    }
}
const readSurroundings = (side, nowMs) => ({
    roomF: room && nowMs - room.atMs < SURROUNDINGS_STALE_MS ? room.temperatureF : undefined,
    surfaceF: surfaces[side] && nowMs - surfaces[side].atMs < SURROUNDINGS_STALE_MS ? surfaces[side].temperatureF : undefined,
});
export function getAutopilotSnapshot(nowMs = Date.now()) {
    const describe = (side) => ({
        stage: sides[side].sleep.stage,
        heartRate: sides[side].sleep.heartRate === undefined ? undefined : Math.round(sides[side].sleep.heartRate),
        minutesAsleep: sides[side].sleep.minutesAsleep,
        offsetF: sides[side].night ? sides[side].lastPlan?.offsetF : undefined,
        lastChange: sides[side].lastChangeReason,
        learned: learned[side],
    });
    return {
        available: nowMs - lastPiezoAtMs < SURROUNDINGS_STALE_MS,
        enabled: settingsDB.data.autopilot.enabled,
        room: room && nowMs - room.atMs < SURROUNDINGS_STALE_MS
            ? { temperatureF: Math.round(room.temperatureF), humidityPercent: room.humidityPercent }
            : undefined,
        left: describe('left'),
        right: describe('right'),
    };
}
const describePlan = (plan, stage) => {
    const reasons = [
        plan.parts.curveF !== 0 && 'time of night',
        plan.parts.deepF !== 0 && 'first sleep cycle',
        plan.parts.learnedF !== 0 && 'your past changes',
        plan.parts.correctionF !== 0 && 'your change tonight',
        plan.parts.surroundingsF !== 0 && 'the room',
    ].filter(Boolean);
    const direction = plan.offsetF === 0 ? 'back to the set temperature' : `${Math.abs(plan.offsetF)}°F ${plan.offsetF < 0 ? 'cooler' : 'warmer'}`;
    return `${direction}${reasons.length > 0 ? ` (${reasons.join(', ')})` : ''}${stage === 'awake' ? ', awake' : ''}`;
};
export class AutopilotMonitor {
    minuteTimer;
    start() {
        try {
            const saved = JSON.parse(readFileSync(STATE_FILE, 'utf8'));
            if (saved.learned) {
                learned = { left: { ...NO_LEARNED_OFFSETS, ...saved.learned.left }, right: { ...NO_LEARNED_OFFSETS, ...saved.learned.right } };
            }
        }
        catch {
            // Nothing learned yet
        }
        registerManualChangeListener((side, temperatureF) => this.noteManualChange(side, temperatureF));
        this.minuteTimer = setInterval(() => void this.runMinute(), MINUTE_MS);
    }
    stop() {
        clearInterval(this.minuteTimer);
        registerManualChangeListener(undefined);
    }
    // A person set this side's temperature. While the autopilot has a night under way, that is a
    // correction: kept in full for the rest of this part of the night, and half-remembered for
    // later nights.
    noteManualChange(side, temperatureF) {
        const state = sides[side];
        const { night, lastPlan } = state;
        if (!settingsDB.data.autopilot.enabled || !night || !lastPlan)
            return;
        const correctionF = temperatureF - lastPlan.targetTemperatureF;
        if (correctionF === 0)
            return;
        const part = nightPartAt((Date.now() - night.asleepSinceMs) / (night.wakeAtMs - night.asleepSinceMs));
        night.correctionF += correctionF;
        night.correctionPart = part;
        // The next press is measured from here, so three presses up count as three degrees, not six
        state.lastPlan = { ...lastPlan, targetTemperatureF: temperatureF };
        learned[side] = learnFromCorrection(learned[side], part, correctionF);
        logger.debug(`Autopilot: ${side} side was changed by hand by ${correctionF}°F in the ${part} part of the night`);
        try {
            writeFileSync(STATE_FILE, JSON.stringify({ learned }));
        }
        catch (error) {
            logger.debug(`Autopilot could not save what it learned: ${String(error)}`);
        }
    }
    // Once a minute: sum up the minute for each side, update its sleep state, and act on it
    async runMinute() {
        try {
            const nowMs = Date.now();
            if (nowMs - lastPiezoAtMs > SURROUNDINGS_STALE_MS)
                return;
            await settingsDB.read();
            for (const side of SIDES) {
                const state = sides[side];
                const wasAsleep = state.sleep.stage === 'asleep';
                state.sleep = state.tracker.addMinute({
                    isInBed: isSomeoneInBed(side),
                    heartRate: median(state.minuteHeartRates),
                    movementSeconds: countMovementSeconds(state.minuteSwings),
                });
                state.minuteHeartRates = [];
                state.minuteSwings = [];
                if (state.sleep.stage === 'out') {
                    state.night = undefined;
                    state.lastPlan = undefined;
                    continue;
                }
                if (!settingsDB.data.autopilot.enabled)
                    continue;
                const isAsleep = state.sleep.stage === 'asleep';
                if (isAsleep && !wasAsleep && !state.night)
                    await this.beginNight(side, nowMs);
                if (state.night)
                    await this.steer(side, nowMs);
            }
        }
        catch (error) {
            logger.error(error);
        }
    }
    // Sleep has begun: note when it should end and what the surroundings are now
    async beginNight(side, nowMs) {
        const deviceStatus = await (await connectFranken()).getDeviceStatus();
        if (!deviceStatus[side].isOn)
            return;
        await schedulesDB.read();
        const now = moment.tz(nowMs, settingsDB.data.timeZone);
        const night = schedulesDB.data[side][findNightDay(now, schedulesDB.data[side])];
        let wakeAtMs = nowMs + DEFAULT_NIGHT_HOURS * 60 * MINUTE_MS;
        if (night.power.enabled) {
            const [hour, minute] = night.alarm.time.split(':').map(Number);
            const wakeAt = now.clone().hour(hour).minute(minute).second(0);
            if (!wakeAt.isAfter(now))
                wakeAt.add(1, 'day');
            // A wake time most of a day away is not this night's
            if (wakeAt.diff(now, 'hours') <= 14)
                wakeAtMs = wakeAt.valueOf();
        }
        sides[side].night = {
            asleepSinceMs: nowMs,
            wakeAtMs,
            temperatureAtOnsetF: deviceStatus[side].targetTemperatureF,
            surroundingsAtOnset: readSurroundings(side, nowMs),
            correctionF: 0,
        };
        logger.debug(`Autopilot: ${side} side fell asleep; the night runs until ${moment(wakeAtMs).format()}`);
    }
    // Sets the side to what the plan wants, if that differs from what it is set to and the bed
    // has not just been moved
    async steer(side, nowMs) {
        const state = sides[side];
        const night = state.night;
        if (!night)
            return;
        if (settingsDB.data[side].awayMode || isManualHoldActive(side) || isPreWarmActive(side))
            return;
        const deviceStatus = await (await connectFranken()).getDeviceStatus();
        if (!deviceStatus[side].isOn)
            return;
        await schedulesDB.read();
        const now = moment.tz(nowMs, settingsDB.data.timeZone);
        const scheduledNight = schedulesDB.data[side][findNightDay(now, schedulesDB.data[side])];
        const baseTemperatureF = scheduledNight.power.enabled
            ? findScheduledTemperatureF(scheduledNight, now.format('HH:mm'))
            : night.temperatureAtOnsetF;
        const progress = Math.min(1, (nowMs - night.asleepSinceMs) / (night.wakeAtMs - night.asleepSinceMs));
        // A correction lasts for the part of the night it was made in
        if (night.correctionPart !== undefined && nightPartAt(progress) !== night.correctionPart) {
            night.correctionF = 0;
            night.correctionPart = undefined;
        }
        const plan = planTemperature({
            baseTemperatureF,
            stage: state.sleep.stage,
            progress,
            minutesSinceSleepOnset: (nowMs - night.asleepSinceMs) / MINUTE_MS,
            learned: learned[side],
            correctionTonightF: night.correctionF,
            surroundingsAtSleepOnset: night.surroundingsAtOnset,
            surroundingsNow: readSurroundings(side, nowMs),
        });
        const hasBaseChanged = state.lastBaseF !== undefined && state.lastBaseF !== baseTemperatureF;
        state.lastBaseF = baseTemperatureF;
        state.lastPlan = plan;
        if (plan.targetTemperatureF === deviceStatus[side].targetTemperatureF)
            return;
        const minutesSinceChange = state.lastChangeAtMs === undefined ? Infinity : (nowMs - state.lastChangeAtMs) / MINUTE_MS;
        if (minutesSinceChange < MIN_MINUTES_BETWEEN_CHANGES && !hasBaseChanged)
            return;
        state.lastChangeAtMs = nowMs;
        state.lastChangeReason = `${now.format('h:mm A')}: ${describePlan(plan, state.sleep.stage)}`;
        logger.debug(`Autopilot: ${side} side to ${plan.targetTemperatureF}°F, ${describePlan(plan, state.sleep.stage)}`);
        await updateDeviceStatus({ [side]: { targetTemperatureF: plan.targetTemperatureF } });
    }
}
//# sourceMappingURL=autopilotMonitor.js.map
//# debugId=d50ec72e-d47f-5847-b4c1-3f2763fdbcee
