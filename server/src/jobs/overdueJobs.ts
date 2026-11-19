// Spots a schedule whose timers have stopped. A job that is waiting always has its next run
// in the future; one whose next run is well in the past is not going to run. Another project
// running the same scheduler on a Pod saw exactly that (a bed-off that never came), and a jump
// of the clock can do it too. Keep this file free of runtime imports so tests can load it.

// A job this late is taken to be stuck, not just a moment behind
export const OVERDUE_BY_MS = 90_000;

export type WaitingJob = { name: string; nextRunMs?: number };

// The name of a job that should have run by now and has not, if there is one
export function findOverdueJob(jobs: WaitingJob[], nowMs: number): string | undefined {
  return jobs.find(job => job.nextRunMs !== undefined && nowMs - job.nextRunMs > OVERDUE_BY_MS)?.name;
}
