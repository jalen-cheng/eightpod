// Remembers when a named job last ran, so a job the clock offers twice is run once. On the day
// clocks go back an hour, a time between 1 and 2 AM happens twice and the scheduler fires twice.
// Kept in memory. Keep this file free of runtime imports so tests can load it without a Pod.

!function(){try{var e="undefined"!=typeof window?window:"undefined"!=typeof global?global:"undefined"!=typeof globalThis?globalThis:"undefined"!=typeof self?self:{},n=(new e.Error).stack;n&&(e._sentryDebugIds=e._sentryDebugIds||{},e._sentryDebugIds[n]="98ca935c-bbaa-580d-bcbf-6d4d355914ea")}catch(e){}}();
const lastRunAtMs = new Map();
// Records a run of `jobName` unless it already ran within `withinMs`. Returns whether to run.
export function shouldRunJob(jobName, withinMs, nowMs = Date.now()) {
    const lastRun = lastRunAtMs.get(jobName);
    if (lastRun !== undefined && nowMs - lastRun >= 0 && nowMs - lastRun < withinMs)
        return false;
    lastRunAtMs.set(jobName, nowMs);
    return true;
}
//# sourceMappingURL=recentRuns.js.map
//# debugId=98ca935c-bbaa-580d-bcbf-6d4d355914ea
