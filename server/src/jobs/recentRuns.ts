// Remembers when a named job last ran, so a job the clock offers twice is run once. On the day
// clocks go back an hour, a time between 1 and 2 AM happens twice and the scheduler fires twice.
// Kept in memory. Keep this file free of runtime imports so tests can load it without a Pod.

const lastRunAtMs = new Map<string, number>();

// Records a run of `jobName` unless it already ran within `withinMs`. Returns whether to run.
export function shouldRunJob(jobName: string, withinMs: number, nowMs: number = Date.now()): boolean {
  const lastRun = lastRunAtMs.get(jobName);
  if (lastRun !== undefined && nowMs - lastRun >= 0 && nowMs - lastRun < withinMs) return false;
  lastRunAtMs.set(jobName, nowMs);
  return true;
}
