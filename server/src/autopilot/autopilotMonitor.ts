// The autopilot's running half: takes the bed's sensor readings in, follows each sleeper minute
// by minute, saves each stay in bed, and (when switched on in Settings) moves a side's
// temperature by a few degrees around what the schedule set. The decisions are made by the pure
// modules beside this file; this one holds the state and talks to the Pod. Pod 5 only: it needs
// the sensor bus.
import { readFileSync, writeFileSync } from 'fs';
import moment from 'moment-timezone';
import config from '../config.js';
import logger from '../logger.js';
import schedulesDB from '../db/schedules.js';
import settingsDB from '../db/settings.js';
import { Side } from '../db/schedulesSchema.js';
import { connectFranken } from '../8sleep/frankenServer.js';
import { isSomeoneInBed } from '../jobs/inBedCheck.js';
import { isManualHoldActive } from '../jobs/manualHold.js';
import { isPreWarmActive } from '../jobs/preWarmState.js';
import { findNightDay } from '../jobs/scheduleTiming.js';
import { updateDeviceStatus } from '../routes/deviceStatus/updateDeviceStatus.js';
import type { AutopilotSideSnapshot, AutopilotSnapshot, TrackerLink } from './autopilotSnapshot.js';
import { BREATHING_WINDOW_SECONDS, estimateBreathingRate, measureBreathingSpread } from './breathingRate.js';
import {
  HEART_RATE_WINDOW_SECONDS, countMovementSeconds, estimateHeartRate, measureSwing,
} from './heartRate.js';
import { registerManualChangeListener } from './manualChanges.js';
import { deleteNight, listNights, pruneNights, saveNight } from './nightLog.js';
import {
  LearnedOffsets, NO_LEARNED_OFFSETS, NightPart, Plan, Surroundings, learnFromCorrection, nightPartAt, planTemperature,
} from './nightPlan.js';
import type { NightRecord, NightSummary } from './nightRecord.js';
import {
  NAP_UNDER_MINUTES, UsualSleep, findScheduledTemperatureF, findUsualSleep, isNightExpected, kindOfSleep,
} from './scheduledBase.js';
import {
  CalibrationNight, DEFAULT_SLEEP_RULES, MinuteSummary, SleepPeriod, SleepRules, SleepState, calibrateSleepRules, createSleepTracker,
} from './sleepTracker.js';

const SIDES: Side[] = ['left', 'right'];
const MINUTE_MS = 60_000;
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
// Calibration looks at this many of the newest nights that a sleep tracker reported on
const CALIBRATION_NIGHTS = 14;
// What was learned from the sleeper's corrections and from a linked sleep tracker. Kept beside
// the settings folder, not in it, so writing it does not make the job scheduler rebuild every job.
const STATE_FILE = `${config.dbFolder}autopilot_state.json`;

// The sleep the autopilot is steering on one side, from falling asleep until getting up
type Night = {
  asleepSinceMs: number;
  wakeAtMs: number;
  // The temperature the side was set to when sleep began, used when no schedule covers the night
  temperatureAtOnsetF: number;
  surroundingsAtOnset: Surroundings;
  // A correction made by hand, kept in full until the part of the night it was made in ends
  correctionF: number;
  correctionPart?: NightPart;
};

type SideState = {
  tracker: ReturnType<typeof createSleepTracker>;
  // The last seconds of piezo signal, newest last, and each one's swing
  recentSeconds: number[][];
  minuteSwings: number[];
  minuteHeartRates: number[];
  minuteBreathingRates: number[];
  secondsSinceEstimate: number;
  secondsSinceBreathingEstimate: number;
  sleep: SleepState;
  // The stay in bed being saved, and how many minutes in a row the side has been empty during it
  stay?: NightRecord;
  minutesOut: number;
  // Whether this stay's sleep began at a time that looks like the night's
  isNightExpected: boolean;
  night?: Night;
  lastPlan?: Plan;
  lastBaseF?: number;
  lastChangeAtMs?: number;
  lastChangeReason?: string;
};

type SavedState = {
  learned?: Record<Side, LearnedOffsets>;
  rules?: Record<Side, SleepRules>;
  trackerLinks?: Partial<Record<Side, TrackerLink>>;
};

let learned: Record<Side, LearnedOffsets> = { left: { ...NO_LEARNED_OFFSETS }, right: { ...NO_LEARNED_OFFSETS } };
let rules: Record<Side, SleepRules> = { left: DEFAULT_SLEEP_RULES, right: DEFAULT_SLEEP_RULES };
let trackerLinks: Partial<Record<Side, TrackerLink>> = {};

const newSideState = (side: Side): SideState => ({
  tracker: createSleepTracker(() => rules[side]),
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

const sides: Record<Side, SideState> = { left: newSideState('left'), right: newSideState('right') };
let room: { temperatureF: number; humidityPercent?: number; atMs: number } | undefined;
const surfaces: Partial<Record<Side, { temperatureF: number; atMs: number }>> = {};
let lastPiezoAtMs = 0;

const median = (values: number[]): number | undefined => {
  if (values.length === 0) return undefined;
  const sorted = [...values].sort((first, second) => first - second);
  return sorted[Math.floor(sorted.length / 2)];
};

const saveState = () => {
  try {
    const state: SavedState = { learned, rules, trackerLinks };
    writeFileSync(STATE_FILE, JSON.stringify(state));
  } catch (error: unknown) {
    logger.debug(`Autopilot could not save its state: ${String(error)}`);
  }
};

// Reads a heart rate from the newest seconds of signal, when it is time to and they are clean
const estimateHeartRateNow = (state: SideState) => {
  state.secondsSinceEstimate++;
  if (state.secondsSinceEstimate < ESTIMATE_EVERY_SECONDS || state.recentSeconds.length < HEART_RATE_WINDOW_SECONDS) return;
  state.secondsSinceEstimate = 0;
  const window = state.recentSeconds.slice(-HEART_RATE_WINDOW_SECONDS);
  // A heartbeat cannot be read through a turn in bed, so a window with movement is passed over
  if (countMovementSeconds(window.map(measureSwing)) > MAX_MOVEMENT_SECONDS_IN_WINDOW) return;
  const estimate = estimateHeartRate(window.flat());
  if (estimate && estimate.confidence >= MIN_CONFIDENCE) state.minuteHeartRates.push(estimate.beatsPerMinute);
};

// The same for breathing, which needs a longer stretch and forgives a little movement
const estimateBreathingRateNow = (state: SideState) => {
  state.secondsSinceBreathingEstimate++;
  if (state.secondsSinceBreathingEstimate < BREATHING_ESTIMATE_EVERY_SECONDS || state.recentSeconds.length < BREATHING_WINDOW_SECONDS) return;
  state.secondsSinceBreathingEstimate = 0;
  if (countMovementSeconds(state.recentSeconds.map(measureSwing)) > MAX_MOVEMENT_SECONDS_IN_BREATHING_WINDOW) return;
  const estimate = estimateBreathingRate(state.recentSeconds.flat());
  if (estimate && estimate.confidence >= MIN_BREATHING_CONFIDENCE) state.minuteBreathingRates.push(estimate.breathsPerMinute);
};

// One second of a side's piezo signal, as the sensor bus delivers it
export function recordPiezoSecond(side: Side, samples: number[]) {
  lastPiezoAtMs = Date.now();
  const state = sides[side];
  state.recentSeconds.push(samples);
  if (state.recentSeconds.length > BREATHING_WINDOW_SECONDS) state.recentSeconds.shift();
  state.minuteSwings.push(measureSwing(samples));
  estimateHeartRateNow(state);
  estimateBreathingRateNow(state);
}

// The air at the cover and the mattress surface under each side, in °F
export function recordSurroundings(reading: { roomF?: number; humidityPercent?: number; surfaceF: Partial<Record<Side, number>> }) {
  const atMs = Date.now();
  if (reading.roomF !== undefined) room = { temperatureF: reading.roomF, humidityPercent: reading.humidityPercent, atMs };
  for (const side of SIDES) {
    const temperatureF = reading.surfaceF[side];
    if (temperatureF !== undefined) surfaces[side] = { temperatureF, atMs };
  }
}

const readSurroundings = (side: Side, nowMs: number): Surroundings => ({
  roomF: room && nowMs - room.atMs < SURROUNDINGS_STALE_MS ? room.temperatureF : undefined,
  surfaceF: surfaces[side] && nowMs - surfaces[side].atMs < SURROUNDINGS_STALE_MS ? surfaces[side].temperatureF : undefined,
});

// A sleep is steered from the start when it began at a time that looks like the night's;
// otherwise only once it has lasted too long to be a nap
const maySteer = (state: SideState): boolean => state.isNightExpected || (state.sleep.minutesAsleep ?? 0) >= NAP_UNDER_MINUTES;

export function getAutopilotSnapshot(nowMs: number = Date.now()): AutopilotSnapshot {
  const describe = (side: Side): AutopilotSideSnapshot => ({
    stage: sides[side].sleep.stage,
    sleepKind: sides[side].sleep.stage !== 'asleep' ? undefined : maySteer(sides[side]) ? 'night' : 'nap',
    heartRate: sides[side].sleep.heartRate === undefined ? undefined : Math.round(sides[side].sleep.heartRate),
    breathingRate: sides[side].sleep.breathingRate === undefined ? undefined : Math.round(sides[side].sleep.breathingRate),
    minutesAsleep: sides[side].sleep.minutesAsleep,
    offsetF: sides[side].night ? sides[side].lastPlan?.offsetF : undefined,
    lastChange: sides[side].lastChangeReason,
    learned: learned[side],
    rules: rules[side],
    tracker: trackerLinks[side],
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

const summarise = ({ minutes, ...rest }: NightRecord): NightSummary => {
  const asleep = minutes.filter(minute => minute.stage === 'asleep');
  const middle = (values: (number | undefined)[]) => median(values.flatMap(value => (value === undefined ? [] : [value])));
  return {
    ...rest,
    minutesLogged: minutes.length,
    heartRate: middle(asleep.map(minute => minute.heartRate)),
    breathingRate: middle(asleep.map(minute => minute.breathingRate)),
  };
};

// Everything saved, for keeping a copy off the Pod: every night with its minute rows, and what
// has been learned
export function getNightsExport() {
  const open = SIDES.flatMap(side => (sides[side].stay ? [sides[side].stay] : []));
  const isOpen = (night: NightRecord) => open.some(stay => stay.side === night.side && stay.startedAtMs === night.startedAtMs);
  return {
    exportedAt: new Date().toISOString(),
    timeZone: settingsDB.data.timeZone,
    learned,
    rules,
    trackerLinks,
    nights: [...open, ...listNights().filter(night => !isOpen(night))],
  };
}

// When this side's sleeper has been falling asleep and waking, from their saved nights
const readUsualSleep = (side: Side): UsualSleep | undefined => {
  const clockMinutes = (atMs: number) => {
    const at = moment.tz(atMs, settingsDB.data.timeZone);
    return at.hours() * 60 + at.minutes();
  };
  return findUsualSleep(listNights(side)
    .filter(night => night.kind === 'night')
    .slice(0, USUAL_SLEEP_NIGHTS)
    .flatMap(night => (night.asleepAtMs === undefined || night.awakeAtMs === undefined
      ? []
      : [{ asleepMinutes: clockMinutes(night.asleepAtMs), awakeMinutes: clockMinutes(night.awakeAtMs) }])));
};

// Saved stays in bed without their minute rows, newest first, with any stay still under way
export function getNightSummaries(limit: number): NightSummary[] {
  const open = SIDES.flatMap(side => (sides[side].stay ? [sides[side].stay] : []));
  const isOpen = (night: NightRecord) => open.some(stay => stay.side === night.side && stay.startedAtMs === night.startedAtMs);
  const saved = listNights(undefined, limit).filter(night => !isOpen(night));
  return [...open, ...saved].sort((first, second) => second.startedAtMs - first.startedAtMs).slice(0, limit).map(summarise);
}

const overlapMs = (night: NightRecord, period: SleepPeriod) => (
  Math.min(night.startedAtMs + night.minutes.length * MINUTE_MS, period.awakeAtMs) - Math.max(night.startedAtMs, period.asleepAtMs)
);

// Sets a side's sleep rules to whatever fits its newest tracker-reported nights best
const recalibrate = (side: Side, source: string, nowMs: number) => {
  const nights: CalibrationNight[] = listNights(side)
    .filter(night => night.tracker && night.kind === 'night')
    .slice(0, CALIBRATION_NIGHTS)
    .flatMap(night => (night.tracker ? [{
      minutes: night.minutes.map(minute => ({
        isInBed: minute.stage !== 'out', movementSeconds: minute.movementSeconds, breathingSpread: minute.breathingSpread,
      })),
      trackerAsleepAtMinute: (night.tracker.asleepAtMs - night.startedAtMs) / MINUTE_MS,
      trackerAwakeAtMinute: (night.tracker.awakeAtMs - night.startedAtMs) / MINUTE_MS,
    }] : []));
  const calibration = calibrateSleepRules(nights);
  rules[side] = calibration.rules;
  trackerLinks[side] = {
    source,
    syncedAt: new Date(nowMs).toISOString(),
    nights: calibration.nights,
    onsetErrorMinutes: calibration.onsetErrorMinutes,
    wakeErrorMinutes: calibration.wakeErrorMinutes,
  };
  saveState();
  logger.debug(`Autopilot: ${side} side's sleep rules after ${calibration.nights} tracker nights: ${JSON.stringify(calibration)}`);
};

// A worn sleep tracker's account of when someone on this side slept. Each sleep is filed with
// the saved stay in bed it overlaps, and the side's sleep rules are then fitted again. Returns
// how many of the sleeps matched a stay.
export function applyTrackerSleep(side: Side, source: string, periods: SleepPeriod[], nowMs: number = Date.now()): number {
  const openStay = sides[side].stay;
  const nights = [...(openStay ? [openStay] : []), ...listNights(side).filter(night => night.startedAtMs !== openStay?.startedAtMs)];
  let matched = 0;
  for (const period of periods) {
    const night = nights.filter(candidate => overlapMs(candidate, period) > 0)
      .sort((first, second) => overlapMs(second, period) - overlapMs(first, period))[0];
    if (!night) continue;
    night.tracker = { source, asleepAtMs: period.asleepAtMs, awakeAtMs: period.awakeAtMs, receivedAtMs: nowMs };
    saveNight(night);
    matched++;
  }
  recalibrate(side, source, nowMs);
  return matched;
}

const describePlan = (plan: Plan, stage: SleepState['stage']): string => {
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
  private minuteTimer?: ReturnType<typeof setInterval>;

  start() {
    try {
      const saved = JSON.parse(readFileSync(STATE_FILE, 'utf8')) as SavedState;
      if (saved.learned) {
        learned = { left: { ...NO_LEARNED_OFFSETS, ...saved.learned.left }, right: { ...NO_LEARNED_OFFSETS, ...saved.learned.right } };
      }
      if (saved.rules) {
        rules = { left: { ...DEFAULT_SLEEP_RULES, ...saved.rules.left }, right: { ...DEFAULT_SLEEP_RULES, ...saved.rules.right } };
      }
      trackerLinks = saved.trackerLinks ?? {};
    } catch {
      // Nothing saved yet
    }
    registerManualChangeListener((side, temperatureF) => this.noteManualChange(side, temperatureF));
    this.minuteTimer = setInterval(() => void this.runMinute(), MINUTE_MS);
  }

  stop() {
    clearInterval(this.minuteTimer);
    registerManualChangeListener(undefined);
    for (const side of SIDES) {
      if (sides[side].stay) saveNight(sides[side].stay);
    }
  }

  // A person set this side's temperature. While the autopilot has a night under way, that is a
  // correction: kept in full for the rest of this part of the night, and half-remembered for
  // later nights.
  private noteManualChange(side: Side, temperatureF: number) {
    const state = sides[side];
    const { night, lastPlan } = state;
    if (!settingsDB.data.autopilot.enabled || !night || !lastPlan) return;
    const correctionF = temperatureF - lastPlan.targetTemperatureF;
    if (correctionF === 0) return;
    const part = nightPartAt((Date.now() - night.asleepSinceMs) / (night.wakeAtMs - night.asleepSinceMs));
    night.correctionF += correctionF;
    night.correctionPart = part;
    // The next press is measured from here, so three presses up count as three degrees, not six
    state.lastPlan = { ...lastPlan, targetTemperatureF: temperatureF };
    learned[side] = learnFromCorrection(learned[side], part, correctionF);
    logger.debug(`Autopilot: ${side} side was changed by hand by ${correctionF}°F in the ${part} part of the night`);
    saveState();
  }

  // Once a minute: sum up the minute for each side, update its sleep state, save it, act on it
  private async runMinute() {
    try {
      const nowMs = Date.now();
      if (nowMs - lastPiezoAtMs > SURROUNDINGS_STALE_MS) return;
      await settingsDB.read();
      for (const side of SIDES) {
        const state = sides[side];
        const minute: MinuteSummary = {
          isInBed: isSomeoneInBed(side),
          heartRate: median(state.minuteHeartRates),
          movementSeconds: countMovementSeconds(state.minuteSwings),
          breathingRate: median(state.minuteBreathingRates),
          breathingSpread: measureBreathingSpread(state.minuteBreathingRates),
        };
        state.sleep = state.tracker.addMinute(minute);
        state.minuteHeartRates = [];
        state.minuteBreathingRates = [];
        state.minuteSwings = [];
        if (state.sleep.stage === 'asleep') await this.noteAsleep(side, nowMs);
        this.logMinute(side, minute, nowMs);
        if (state.sleep.stage === 'out' || !settingsDB.data.autopilot.enabled) continue;
        if (state.sleep.stage === 'asleep' && !state.night && maySteer(state)) await this.beginNight(side, nowMs);
        if (state.night) await this.steer(side, nowMs);
      }
    } catch (error: unknown) {
      logger.error(error);
    }
  }

  // Marks the stay with when sleep began and how late it has lasted so far. Whether it is a nap
  // is a matter of its length, so that is settled as it goes; whether it looks like the night's
  // sleep, which decides if the autopilot steers it from the start, is judged once at its onset.
  private async noteAsleep(side: Side, nowMs: number) {
    const state = sides[side];
    state.stay ??= { side, startedAtMs: nowMs - state.sleep.minutesInBed * MINUTE_MS, minutes: [] };
    const stay = state.stay;
    if (stay.asleepAtMs === undefined) {
      const asleepAtMs = nowMs - (state.sleep.minutesAsleep ?? 0) * MINUTE_MS;
      await schedulesDB.read();
      const asleepAt = moment.tz(asleepAtMs, settingsDB.data.timeZone);
      const scheduledNight = schedulesDB.data[side][findNightDay(asleepAt, schedulesDB.data[side])];
      stay.asleepAtMs = asleepAtMs;
      state.isNightExpected = isNightExpected(asleepAt.format('HH:mm'), readUsualSleep(side), scheduledNight);
      const hint = state.isNightExpected ? '' : ', at an hour that looks like a nap';
      logger.debug(`Autopilot: ${side} side fell asleep at ${asleepAt.format()}${hint}`);
    }
    stay.awakeAtMs = nowMs;
    stay.kind = kindOfSleep((nowMs - stay.asleepAtMs) / MINUTE_MS);
  }

  // Adds the minute to the stay being saved. The stay ends, and the night with it, once the
  // side has been empty for longer than a trip out of bed takes.
  private logMinute(side: Side, minute: MinuteSummary, nowMs: number) {
    const state = sides[side];
    if (minute.isInBed) {
      state.stay ??= { side, startedAtMs: nowMs - MINUTE_MS, minutes: [] };
      state.minutesOut = 0;
    } else if (state.stay) {
      state.minutesOut++;
    }
    const stay = state.stay;
    if (!stay) return;
    stay.minutes.push({
      movementSeconds: minute.movementSeconds,
      heartRate: minute.heartRate === undefined ? undefined : Math.round(minute.heartRate),
      breathingRate: minute.breathingRate === undefined ? undefined : Math.round(minute.breathingRate * 10) / 10,
      breathingSpread: minute.breathingSpread === undefined ? undefined : Math.round(minute.breathingSpread * 10) / 10,
      stage: state.sleep.stage,
      offsetF: state.night ? state.lastPlan?.offsetF : undefined,
      roomF: room && nowMs - room.atMs < SURROUNDINGS_STALE_MS ? Math.round(room.temperatureF * 10) / 10 : undefined,
    });
    if (state.minutesOut >= OUT_GRACE_MINUTES || stay.minutes.length >= MAX_STAY_MINUTES) {
      this.endStay(side);
    } else if (stay.minutes.length % SAVE_EVERY_MINUTES === 0) {
      saveNight(stay);
    }
  }

  private endStay(side: Side) {
    const state = sides[side];
    const stay = state.stay;
    if (!stay) return;
    // The empty minutes at the end were the wait to see whether they would come back
    stay.minutes = stay.minutes.slice(0, stay.minutes.length - state.minutesOut);
    if (stay.minutes.length >= MIN_STAY_MINUTES) saveNight(stay);
    else deleteNight(stay);
    pruneNights();
    state.stay = undefined;
    state.minutesOut = 0;
    state.isNightExpected = false;
    state.night = undefined;
    state.lastPlan = undefined;
    state.lastBaseF = undefined;
  }

  // Sleep has begun on a side that is on: note when it should end and what the surroundings are
  private async beginNight(side: Side, nowMs: number) {
    const state = sides[side];
    const deviceStatus = await (await connectFranken()).getDeviceStatus();
    if (!deviceStatus[side].isOn) return;
    await schedulesDB.read();
    const now = moment.tz(nowMs, settingsDB.data.timeZone);
    const night = schedulesDB.data[side][findNightDay(now, schedulesDB.data[side])];
    let wakeAtMs = nowMs + DEFAULT_NIGHT_HOURS * 60 * MINUTE_MS;
    if (night.power.enabled) {
      const [hour, minute] = night.alarm.time.split(':').map(Number);
      const wakeAt = now.clone().hour(hour).minute(minute).second(0);
      if (!wakeAt.isAfter(now)) wakeAt.add(1, 'day');
      // A wake time most of a day away is not this night's
      if (wakeAt.diff(now, 'hours') <= 14) wakeAtMs = wakeAt.valueOf();
    }
    state.night = {
      asleepSinceMs: state.stay?.asleepAtMs ?? nowMs,
      wakeAtMs,
      temperatureAtOnsetF: deviceStatus[side].targetTemperatureF,
      surroundingsAtOnset: readSurroundings(side, nowMs),
      correctionF: 0,
    };
    logger.debug(`Autopilot: steering the ${side} side's sleep until ${moment(wakeAtMs).format()}`);
  }

  // Sets the side to what the plan wants, if that differs from what it is set to and the bed
  // has not just been moved
  private async steer(side: Side, nowMs: number) {
    const state = sides[side];
    const night = state.night;
    if (!night) return;
    if (settingsDB.data[side].awayMode || isManualHoldActive(side) || isPreWarmActive(side)) return;
    const deviceStatus = await (await connectFranken()).getDeviceStatus();
    if (!deviceStatus[side].isOn) return;

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
    if (plan.targetTemperatureF === deviceStatus[side].targetTemperatureF) return;
    const minutesSinceChange = state.lastChangeAtMs === undefined ? Infinity : (nowMs - state.lastChangeAtMs) / MINUTE_MS;
    if (minutesSinceChange < MIN_MINUTES_BETWEEN_CHANGES && !hasBaseChanged) return;

    state.lastChangeAtMs = nowMs;
    state.lastChangeReason = `${now.format('h:mm A')}: ${describePlan(plan, state.sleep.stage)}`;
    logger.debug(`Autopilot: ${side} side to ${plan.targetTemperatureF}°F, ${describePlan(plan, state.sleep.stage)}`);
    await updateDeviceStatus({ [side]: { targetTemperatureF: plan.targetTemperatureF } });
  }
}
