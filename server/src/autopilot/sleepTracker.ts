// Follows one sleeper through a stay in bed, a minute at a time, and says whether they are
// awake or asleep. It goes by stillness, the way a wrist tracker's movement sensor does: asleep
// after lying still long enough, awake again after a run of restless minutes. Steady breathing
// can be asked for as well, but only once calibration against a worn tracker has shown it
// helps. The heart rate is carried along for showing, and decides nothing. It does not try to tell deep sleep
// from the rest: the night plan assumes deep sleep by the clock instead.
// Keep this file free of runtime imports so tests can load it without a Pod environment.

export type SleepStage = 'out' | 'awake' | 'asleep';

export type MinuteSummary = {
  isInBed: boolean;
  // The minute's heart rate, or undefined when no estimate in it could be trusted
  heartRate?: number;
  // How many of the minute's seconds had movement. Undefined when the sensor sent too little
  // that minute to say: such a minute counts neither as lying still nor as restless.
  movementSeconds?: number;
  // Breaths a minute, and how far the minute's readings were apart (small in sleep)
  breathingRate?: number;
  breathingSpread?: number;
};

export type SleepState = {
  stage: SleepStage;
  minutesInBed: number;
  // Minutes since falling asleep, counted from the start of the still stretch that showed it
  // (undefined while awake)
  minutesAsleep?: number;
  heartRate?: number;
  breathingRate?: number;
};

// The numbers that calibration against a sleep tracker tunes
export type SleepRules = {
  // Asleep after this many minutes in a row of lying still
  stillMinutesToSleep: number;
  // A minute with at least this many moving seconds is a restless one
  restlessSecondsToWake: number;
  // When set, lying still only counts as asleep if breathing was this steady over the stretch
  // (the middle spread of its minutes, in breaths a minute). Unset by default.
  maxBreathingSpread?: number;
};
export const DEFAULT_SLEEP_RULES: SleepRules = { stillMinutesToSleep: 15, restlessSecondsToWake: 12 };

// A minute with this many moving seconds or fewer counts as lying still
const STILL_MINUTE_MAX_MOVEMENT_SECONDS = 3;
// Awake again: this many restless minutes among the last five. One turn in bed is not waking.
const AWAKE_RESTLESS_MINUTES = 3;
const RECENT_MINUTES = 5;

const median = (values: number[]): number | undefined => {
  if (values.length === 0) return undefined;
  const sorted = [...values].sort((first, second) => first - second);
  return sorted[Math.floor(sorted.length / 2)];
};

// Creates a tracker for one side of the bed. Call `addMinute` once a minute. `getRules` is read
// every minute, so rules changed by calibration apply at once.
export function createSleepTracker(getRules: () => SleepRules = () => DEFAULT_SLEEP_RULES) {
  let minutes: MinuteSummary[] = [];
  let asleepSinceMinute: number | undefined;

  const reset = () => {
    minutes = [];
    asleepSinceMinute = undefined;
  };

  const lastMinutes = (count: number) => minutes.slice(-count);

  const addMinute = (minute: MinuteSummary): SleepState => {
    if (!minute.isInBed) {
      reset();
      return { stage: 'out', minutesInBed: 0 };
    }
    minutes.push(minute);
    const rules = getRules();
    const minutesInBed = minutes.length;
    const recentMiddle = (read: (recent: MinuteSummary) => number | undefined) => median(
      lastMinutes(RECENT_MINUTES).flatMap((recent) => {
        const value = read(recent);
        return value === undefined ? [] : [value];
      }),
    );
    const heartRate = recentMiddle(recent => recent.heartRate);
    const breathingRate = recentMiddle(recent => recent.breathingRate);

    if (asleepSinceMinute === undefined) {
      const stillStretch = lastMinutes(rules.stillMinutesToSleep);
      const hasLainStill = minutesInBed >= rules.stillMinutesToSleep
        && stillStretch.every(recent => recent.movementSeconds !== undefined && recent.movementSeconds <= STILL_MINUTE_MAX_MOVEMENT_SECONDS);
      // With too few breathing readings in the stretch to judge by, stillness alone decides
      const spreads = stillStretch.flatMap(recent => (recent.breathingSpread === undefined ? [] : [recent.breathingSpread]));
      const isBreathingSteady = rules.maxBreathingSpread === undefined || spreads.length < stillStretch.length / 2
        || (median(spreads) ?? 0) <= rules.maxBreathingSpread;
      // Sleep began when the stillness did, not when it had lasted long enough to be believed
      if (hasLainStill && isBreathingSteady) asleepSinceMinute = minutesInBed - rules.stillMinutesToSleep;
    } else {
      const restlessMinutes = lastMinutes(RECENT_MINUTES)
        .filter(recent => (recent.movementSeconds ?? 0) >= rules.restlessSecondsToWake).length;
      if (restlessMinutes >= AWAKE_RESTLESS_MINUTES) asleepSinceMinute = undefined;
    }

    if (asleepSinceMinute === undefined) return { stage: 'awake', minutesInBed, heartRate, breathingRate };
    return { stage: 'asleep', minutesInBed, minutesAsleep: minutesInBed - asleepSinceMinute, heartRate, breathingRate };
  };

  return { addMinute, reset };
}

// ---------------------------------------------------------------------------------------------
// Calibration. Tunes the numbers above against nights where a worn sleep tracker (a watch or
// band, by way of Apple Health) said, minute by minute, when the sleeper was asleep. Each
// candidate set of numbers is replayed over the saved minutes of those nights and scored by
// how many minutes it disagrees with the tracker on, which counts lying awake in the middle of
// the night as well as the times of falling asleep and waking.
// ---------------------------------------------------------------------------------------------
export type ReplayMinute = { isInBed: boolean; movementSeconds?: number; breathingSpread?: number };

export type CalibrationNight = {
  minutes: ReplayMinute[];
  // What the worn tracker said for each of those minutes
  trackerAsleep: boolean[];
};

export type Calibration = {
  rules: SleepRules;
  nights: number;
  // The share of minutes on which the bed and the tracker agree, with these rules
  agreementPercent: number;
  // True when the rules were changed from the default to fit the tracker
  isTuned: boolean;
};

// Fewer nights than this and the rules are left alone
export const MIN_NIGHTS_TO_CALIBRATE = 5;
// Fitted rules are only taken up if, tried on each night after being fitted to the others, they
// disagree with the tracker on at most this fraction of the minutes the default rules do. A
// fit that only looks good on the nights it was made from is not taken.
const HELD_OUT_SHARE_TO_BEAT = 0.9;
const STILL_MINUTES_CANDIDATES = [5, 8, 10, 15, 20, 30];
const RESTLESS_SECONDS_CANDIDATES = [8, 12, 20, 30];
const BREATHING_SPREAD_CANDIDATES = [undefined, 2, 4];

// For each minute of a saved stay, whether the bed's rules would have called the sleeper
// asleep. Sleep is counted from when the stillness began, as the tracker does it.
export function replaySleep(minutes: ReplayMinute[], rules: SleepRules): boolean[] {
  const tracker = createSleepTracker(() => rules);
  const isAsleep: boolean[] = new Array<boolean>(minutes.length).fill(false);
  minutes.forEach((minute, index) => {
    const state = tracker.addMinute(minute);
    if (state.stage !== 'asleep') return;
    const firstAsleep = Math.max(0, index + 1 - (state.minutesAsleep ?? 1));
    for (let asleepIndex = firstAsleep; asleepIndex <= index; asleepIndex++) isAsleep[asleepIndex] = true;
  });
  return isAsleep;
}

// When the longest sleep of a saved stay began and ended, in minutes from its first row
export function detectSleepTimes(minutes: ReplayMinute[], rules: SleepRules): { asleepAtMinute?: number; awakeAtMinute?: number } {
  let longest: { asleepAtMinute: number; awakeAtMinute: number } | undefined;
  let runStart: number | undefined;
  [...replaySleep(minutes, rules), false].forEach((isAsleep, index) => {
    if (isAsleep) {
      runStart ??= index;
    } else if (runStart !== undefined) {
      const isLongest = !longest || index - runStart > longest.awakeAtMinute - longest.asleepAtMinute;
      if (isLongest) longest = { asleepAtMinute: runStart, awakeAtMinute: index };
      runStart = undefined;
    }
  });
  return longest ?? {};
}

// How many of a night's minutes the rules and the tracker disagree on
export function countDisagreements(night: CalibrationNight, rules: SleepRules): number {
  return replaySleep(night.minutes, rules).filter((isAsleep, index) => isAsleep !== (night.trackerAsleep[index] ?? false)).length;
}

const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);

// The rules that fit these nights best, if a fit can be trusted. The default rules are kept
// with too few nights, and unless fitted rules also do better on nights they were not fitted to.
export function calibrateSleepRules(nights: CalibrationNight[]): Calibration {
  const minutesInAll = Math.max(1, sum(nights.map(night => night.minutes.length)));
  const agreementOf = (disagreements: number) => Math.round(100 * (1 - disagreements / minutesInAll));
  const defaultDisagreements = nights.map(night => countDisagreements(night, DEFAULT_SLEEP_RULES));
  const untuned = {
    rules: DEFAULT_SLEEP_RULES, nights: nights.length, agreementPercent: agreementOf(sum(defaultDisagreements)), isTuned: false,
  };
  if (nights.length < MIN_NIGHTS_TO_CALIBRATE) return untuned;

  const candidates: SleepRules[] = [];
  for (const stillMinutesToSleep of STILL_MINUTES_CANDIDATES) {
    for (const restlessSecondsToWake of RESTLESS_SECONDS_CANDIDATES) {
      for (const maxBreathingSpread of BREATHING_SPREAD_CANDIDATES) {
        candidates.push({ stillMinutesToSleep, restlessSecondsToWake, maxBreathingSpread });
      }
    }
  }
  // One replay of each candidate over each night; everything after is sums over this table
  const disagreements = candidates.map(candidate => nights.map(night => countDisagreements(night, candidate)));
  // The candidate that fits best when one night is left out of the count
  const findBest = (leftOutNight?: number): number => {
    const totals = disagreements.map(row => sum(row.filter((_count, nightIndex) => nightIndex !== leftOutNight)));
    return totals.indexOf(Math.min(...totals));
  };
  const heldOutDisagreements = sum(nights.map((_night, nightIndex) => disagreements[findBest(nightIndex)][nightIndex]));
  if (heldOutDisagreements > sum(defaultDisagreements) * HELD_OUT_SHARE_TO_BEAT) return untuned;
  return { rules: candidates[findBest()], nights: nights.length, agreementPercent: agreementOf(heldOutDisagreements), isTuned: true };
}

// ---------------------------------------------------------------------------------------------
// Reading what a worn tracker sends
// ---------------------------------------------------------------------------------------------
export type SleepSample = { startMs: number; endMs: number; value?: string };
type Interval = { startMs: number; endMs: number };
// One sleep as the tracker saw it: when it began and ended, and the stretches awake within it
export type SleepPeriod = { asleepAtMs: number; awakeAtMs: number; awakeIntervals: Interval[] };

// Health apps record a night as many short samples, some of them "awake" or "in bed"
const NOT_ASLEEP = /awake|in ?bed/i;
// Samples closer together than this are one sleep; further apart, a night and a nap
const SAME_SLEEP_GAP_MS = 60 * 60_000;
// A gap between two asleep samples longer than this is time awake
const AWAKE_GAP_MS = 60_000;
const SHORTEST_SLEEP_MS = 15 * 60_000;

// Joins a tracker's sleep samples into whole sleeps, oldest first, keeping the time awake
// between samples of the same sleep
export function findSleepPeriods(samples: SleepSample[]): SleepPeriod[] {
  const asleep = samples
    .filter(sample => sample.endMs > sample.startMs && !NOT_ASLEEP.test(sample.value ?? ''))
    .sort((first, second) => first.startMs - second.startMs);
  const periods: SleepPeriod[] = [];
  for (const sample of asleep) {
    const last = periods[periods.length - 1];
    if (last && sample.startMs - last.awakeAtMs <= SAME_SLEEP_GAP_MS) {
      if (sample.startMs - last.awakeAtMs >= AWAKE_GAP_MS) last.awakeIntervals.push({ startMs: last.awakeAtMs, endMs: sample.startMs });
      last.awakeAtMs = Math.max(last.awakeAtMs, sample.endMs);
    } else {
      periods.push({ asleepAtMs: sample.startMs, awakeAtMs: sample.endMs, awakeIntervals: [] });
    }
  }
  return periods.filter(period => period.awakeAtMs - period.asleepAtMs >= SHORTEST_SLEEP_MS);
}

// Several sleeps within one stay in bed as a single account of it: the first falling asleep,
// the last waking, and everything awake in between
export function mergeSleepPeriods(periods: SleepPeriod[]): SleepPeriod {
  const sorted = [...periods].sort((first, second) => first.asleepAtMs - second.asleepAtMs);
  const between = sorted.slice(1).map((period, index) => ({ startMs: sorted[index].awakeAtMs, endMs: period.asleepAtMs }));
  return {
    asleepAtMs: sorted[0].asleepAtMs,
    awakeAtMs: Math.max(...sorted.map(period => period.awakeAtMs)),
    awakeIntervals: [...sorted.flatMap(period => period.awakeIntervals), ...between].sort((first, second) => first.startMs - second.startMs),
  };
}

const MINUTE_MS = 60_000;

// What the tracker says for each minute of a stay that began at `startedAtMs`: asleep or not,
// judged at the middle of the minute
export function readTrackerMinutes(
  tracker: Omit<SleepPeriod, 'awakeIntervals'> & { awakeIntervals?: Interval[] },
  startedAtMs: number,
  minuteCount: number,
): boolean[] {
  return Array.from({ length: minuteCount }, (_unused, index) => {
    const atMs = startedAtMs + (index + 0.5) * MINUTE_MS;
    return atMs >= tracker.asleepAtMs && atMs < tracker.awakeAtMs
      && !(tracker.awakeIntervals ?? []).some(interval => atMs >= interval.startMs && atMs < interval.endMs);
  });
}

// The iPhone app Health Auto Export can post Apple Health data on its own schedule. Its sleep
// rows come either one a night (`sleepStart`, `sleepEnd`) or as the health app's own samples
// (`start`/`startDate`, `end`/`endDate`, `value`), with dates like "2024-02-06 14:30:00 -0800".
// Written from the app's documentation; not yet run against the app.
const EXPORT_DATE = /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2}) ([+-]\d{2}):?(\d{2})$/;
const parseExportDate = (text: unknown): number | undefined => {
  if (typeof text !== 'string') return undefined;
  const parts = EXPORT_DATE.exec(text.trim());
  const timeMs = Date.parse(parts ? `${parts[1]}T${parts[2]}${parts[3]}:${parts[4]}` : text);
  return Number.isNaN(timeMs) ? undefined : timeMs;
};

type ExportRow = Record<string, unknown>;
type HealthExport = { data?: { metrics?: { name?: string; data?: ExportRow[] }[] } };

// The sleep samples in a Health Auto Export body, or undefined when it is not one
export function readHealthExportSleep(body: unknown): SleepSample[] | undefined {
  const metrics = (body as HealthExport | undefined)?.data?.metrics;
  if (!Array.isArray(metrics)) return undefined;
  const rows = metrics.filter(metric => metric.name === 'sleep_analysis').flatMap(metric => metric.data ?? []);
  return rows.flatMap((row) => {
    const startMs = parseExportDate(row.sleepStart ?? row.start ?? row.startDate);
    const endMs = parseExportDate(row.sleepEnd ?? row.end ?? row.endDate);
    if (startMs === undefined || endMs === undefined) return [];
    return [{ startMs, endMs, value: typeof row.value === 'string' ? row.value : undefined }];
  });
}
