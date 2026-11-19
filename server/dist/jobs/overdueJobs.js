// Spots a schedule whose timers have stopped. A job that is waiting always has its next run
// in the future; one whose next run is well in the past is not going to run. Another project
// running the same scheduler on a Pod saw exactly that (a bed-off that never came), and a jump
// of the clock can do it too. Keep this file free of runtime imports so tests can load it.
// A job this late is taken to be stuck, not just a moment behind

!function(){try{var e="undefined"!=typeof window?window:"undefined"!=typeof global?global:"undefined"!=typeof globalThis?globalThis:"undefined"!=typeof self?self:{},n=(new e.Error).stack;n&&(e._sentryDebugIds=e._sentryDebugIds||{},e._sentryDebugIds[n]="10c75c51-b53e-52eb-97a6-1abbd7497fec")}catch(e){}}();
export const OVERDUE_BY_MS = 90_000;
// The name of a job that should have run by now and has not, if there is one
export function findOverdueJob(jobs, nowMs) {
    return jobs.find(job => job.nextRunMs !== undefined && nowMs - job.nextRunMs > OVERDUE_BY_MS)?.name;
}
//# sourceMappingURL=overdueJobs.js.map
//# debugId=10c75c51-b53e-52eb-97a6-1abbd7497fec
