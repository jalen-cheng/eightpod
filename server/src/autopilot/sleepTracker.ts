// Follows one sleeper through a stay in bed, a minute at a time, and says whether they are
// awake or asleep. It goes by stillness alone, the way a wrist tracker's movement sensor does:
// asleep after lying still long enough, awake again after a run of restless minutes. The heart
// rate is carried along for showing, and decides nothing. It does not try to tell deep sleep
// from the rest: the night plan assumes deep sleep by the clock instead.
// Keep this file free of runtime imports so tests can load it without a Pod environment.

export type SleepStage = 'out' | 'awake' | 'asleep';

export type MinuteSummary = {
  isInBed: boolean;
  // The minute's heart rate, or undefined when no estimate in it could be trusted
  heartRate?: number;
  // How many of the minute's seconds had movement
  movementSeconds: number;
};

export type SleepState = {
  stage: SleepStage;
  minutesInBed: number;
  // Minutes since falling asleep, counted from the start of the still stretch that showed it
  // (undefined while awake)
  minutesAsleep?: number;
  heartRate?: number;
};

// The two numbers that calibration against a sleep tracker tunes
export type SleepRules = {
  // Asleep after this many minutes in a row of lying still
  stillMinutesToSleep: number;
  // A minute with at least this many moving seconds is a restless one
  restlessSecondsToWake: number;
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
    const heartRate = median(lastMinutes(RECENT_MINUTES).flatMap(recent => (recent.heartRate === undefined ? [] : [recent.heartRate])));

    if (asleepSinceMinute === undefined) {
      const hasLainStill = minutesInBed >= rules.stillMinutesToSleep
        && lastMinutes(rules.stillMinutesToSleep).every(recent => recent.movementSeconds <= STILL_MINUTE_MAX_MOVEMENT_SECONDS);
      // Sleep began when the stillness did, not when it had lasted long enough to be believed
      if (hasLainStill) asleepSinceMinute = minutesInBed - rules.stillMinutesToSleep;
    } else {
      const restlessMinutes = lastMinutes(RECENT_MINUTES)
        .filter(recent => recent.movementSeconds >= rules.restlessSecondsToWake).length;
      if (restlessMinutes >= AWAKE_RESTLESS_MINUTES) asleepSinceMinute = undefined;
    }

    if (asleepSinceMinute === undefined) return { stage: 'awake', minutesInBed, heartRate };
    return { stage: 'asleep', minutesInBed, minutesAsleep: minutesInBed - asleepSinceMinute, heartRate };
  };

  return { addMinute, reset };
}

// ---------------------------------------------------------------------------------------------
// Calibration. Tunes the two numbers above against nights where a worn sleep tracker (a watch
// or band, by way of Apple Health or the like) said when the sleeper fell asleep and woke. Each
// candidate pair is replayed over the saved minutes of those nights, and the pair whose sleep
// and wake times land closest to the worn tracker's is kept.
// ---------------------------------------------------------------------------------------------
export type ReplayMinute = { isInBed: boolean; movementSeconds: number };

export type CalibrationNight = {
  minutes: ReplayMinute[];
  // What the worn tracker said, in minutes from the first saved minute
  trackerAsleepAtMinute: number;
  trackerAwakeAtMinute: number;
};

export type Calibration = {
  rules: SleepRules;
  nights: number;
  // How far the bed's times are from the worn tracker's with these rules, on average
  onsetErrorMinutes: number;
  wakeErrorMinutes: number;
};

// Fewer nights than this and the rules are left alone: one odd night should not set them
export const MIN_NIGHTS_TO_CALIBRATE = 3;
const STILL_MINUTES_CANDIDATES = [5, 8, 10, 15, 20, 30];
const RESTLESS_SECONDS_CANDIDATES = [8, 12, 20, 30];

// When the bed's rules would have called the sleeper asleep and awake over a saved stay, in
// minutes from its first row. The longest sleep counts, so a doze before the real one does not.
export function detectSleepTimes(minutes: ReplayMinute[], rules: SleepRules): { asleepAtMinute?: number; awakeAtMinute?: number } {
  const tracker = createSleepTracker(() => rules);
  let longest: { asleepAtMinute: number; awakeAtMinute: number } | undefined;
  let current: { asleepAtMinute: number; awakeAtMinute: number } | undefined;
  minutes.forEach((minute, index) => {
    const state = tracker.addMinute(minute);
    if (state.stage === 'asleep') {
      current ??= { asleepAtMinute: index + 1 - (state.minutesAsleep ?? 0), awakeAtMinute: index + 1 };
      current.awakeAtMinute = index + 1;
      if (!longest || current.awakeAtMinute - current.asleepAtMinute > longest.awakeAtMinute - longest.asleepAtMinute) longest = current;
    } else {
      current = undefined;
    }
  });
  return longest ?? {};
}

const average = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);

// How far a set of rules lands from the worn tracker over some nights. A night where the rules
// see no sleep at all counts as wrong by the whole length of the tracker's sleep.
export function measureRules(nights: CalibrationNight[], rules: SleepRules): Calibration {
  const onsetErrors: number[] = [];
  const wakeErrors: number[] = [];
  for (const night of nights) {
    const detected = detectSleepTimes(night.minutes, rules);
    const missedBy = night.trackerAwakeAtMinute - night.trackerAsleepAtMinute;
    onsetErrors.push(detected.asleepAtMinute === undefined ? missedBy : Math.abs(detected.asleepAtMinute - night.trackerAsleepAtMinute));
    wakeErrors.push(detected.awakeAtMinute === undefined ? missedBy : Math.abs(detected.awakeAtMinute - night.trackerAwakeAtMinute));
  }
  return {
    rules, nights: nights.length, onsetErrorMinutes: Math.round(average(onsetErrors)), wakeErrorMinutes: Math.round(average(wakeErrors)),
  };
}

// The rules that fit these nights best. With too few nights the default rules are kept and only
// measured. The default is tried first and has to be beaten, so a tie changes nothing.
export function calibrateSleepRules(nights: CalibrationNight[]): Calibration {
  let best = measureRules(nights, DEFAULT_SLEEP_RULES);
  if (nights.length < MIN_NIGHTS_TO_CALIBRATE) return best;
  for (const stillMinutesToSleep of STILL_MINUTES_CANDIDATES) {
    for (const restlessSecondsToWake of RESTLESS_SECONDS_CANDIDATES) {
      const candidate = measureRules(nights, { stillMinutesToSleep, restlessSecondsToWake });
      if (candidate.onsetErrorMinutes + candidate.wakeErrorMinutes < best.onsetErrorMinutes + best.wakeErrorMinutes) best = candidate;
    }
  }
  return best;
}

// ---------------------------------------------------------------------------------------------
// Reading what a worn tracker sends
// ---------------------------------------------------------------------------------------------
export type SleepSample = { startMs: number; endMs: number; value?: string };
export type SleepPeriod = { asleepAtMs: number; awakeAtMs: number };

// Health apps record a night as many short samples, some of them "awake" or "in bed"
const NOT_ASLEEP = /awake|in ?bed/i;
// Samples closer together than this are one sleep; further apart, a night and a nap
const SAME_SLEEP_GAP_MS = 60 * 60_000;
const SHORTEST_SLEEP_MS = 15 * 60_000;

// Joins a tracker's sleep samples into whole sleeps, oldest first
export function findSleepPeriods(samples: SleepSample[]): SleepPeriod[] {
  const asleep = samples
    .filter(sample => sample.endMs > sample.startMs && !NOT_ASLEEP.test(sample.value ?? ''))
    .sort((first, second) => first.startMs - second.startMs);
  const periods: SleepPeriod[] = [];
  for (const sample of asleep) {
    const last = periods[periods.length - 1];
    if (last && sample.startMs - last.awakeAtMs <= SAME_SLEEP_GAP_MS) last.awakeAtMs = Math.max(last.awakeAtMs, sample.endMs);
    else periods.push({ asleepAtMs: sample.startMs, awakeAtMs: sample.endMs });
  }
  return periods.filter(period => period.awakeAtMs - period.asleepAtMs >= SHORTEST_SLEEP_MS);
}
