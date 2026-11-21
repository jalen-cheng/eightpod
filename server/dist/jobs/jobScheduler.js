
!function(){try{var e="undefined"!=typeof window?window:"undefined"!=typeof global?global:"undefined"!=typeof globalThis?globalThis:"undefined"!=typeof self?self:{},n=(new e.Error).stack;n&&(e._sentryDebugIds=e._sentryDebugIds||{},e._sentryDebugIds[n]="d0d84671-b483-5330-8214-321a37ffff65")}catch(e){}}();
import path from 'path';
import chokidar from 'chokidar';
import moment from 'moment-timezone';
import schedule from 'node-schedule';
import config from '../config.js';
import logger from '../logger.js';
import schedulesDB from '../db/schedules.js';
import serverStatus from '../serverStatus.js';
import settingsDB from '../db/settings.js';
import { isSystemDateValid } from './isSystemDateValid.js';
import { findOverdueJob } from './overdueJobs.js';
import { scheduleAlarm, scheduleAlarmOverride, scheduleAlarmPreWarm } from './alarmScheduler.js';
import { extendNightTimers, schedulePowerOffAndSleepAnalysis, schedulePowerOn } from './powerScheduler.js';
import { schedulePrimingRebootAndCalibration } from './primeScheduler.js';
import { scheduleTemperatures } from './temperatureScheduler.js';
// Set when a change arrives while the jobs are being rebuilt, so that change is not lost
let isRebuildQueued = false;
// Cancels every job and creates them again from the saved settings and schedules
async function setupJobs() {
    try {
        if (serverStatus.status.jobs.status === 'started') {
            logger.debug('Job setup already running, it will run again when it finishes.');
            isRebuildQueued = true;
            return;
        }
        serverStatus.status.jobs.status = 'started';
        // Clear existing jobs
        logger.info('Canceling old jobs...');
        Object.keys(schedule.scheduledJobs).forEach((jobName) => {
            schedule.cancelJob(jobName);
        });
        await schedule.gracefulShutdown();
        await settingsDB.read();
        await schedulesDB.read();
        moment.tz.setDefault(settingsDB.data.timeZone || 'UTC');
        const schedulesData = schedulesDB.data;
        const settingsData = settingsDB.data;
        logger.info('Scheduling jobs...');
        scheduleAlarmOverride(settingsData, 'left');
        scheduleAlarmOverride(settingsData, 'right');
        Object.entries(schedulesData).forEach(([side, sideSchedule]) => {
            Object.entries(sideSchedule).forEach(([day, schedule]) => {
                schedulePowerOn(settingsData, side, day, schedule.power);
                schedulePowerOffAndSleepAnalysis(settingsData, side, day, schedule.power);
                scheduleTemperatures(settingsData, side, day, schedule);
                scheduleAlarm(settingsData, side, day, schedule);
                scheduleAlarmPreWarm(settingsData, side, day, schedule);
            });
        });
        schedulePrimingRebootAndCalibration(settingsData);
        // A night's off time may have just been moved; a bed that cannot be reached is tried again at the next change
        // Not waited for: reaching the bed can take a while at start-up, and the jobs are set either way
        void extendNightTimers(settingsData, schedulesData).catch(error => logger.debug(`Could not check the night's timers: ${String(error)}`));
        logger.info('Done scheduling jobs!');
        serverStatus.status.alarmSchedule.status = 'healthy';
        serverStatus.status.jobs.status = 'healthy';
        serverStatus.status.primeSchedule.status = 'healthy';
        serverStatus.status.powerSchedule.status = 'healthy';
        serverStatus.status.rebootSchedule.status = 'healthy';
        serverStatus.status.temperatureSchedule.status = 'healthy';
    }
    catch (error) {
        serverStatus.status.jobs.status = 'failed';
        const message = error instanceof Error ? error.message : String(error);
        logger.error(error);
        serverStatus.status.jobs.message = message;
    }
    if (isRebuildQueued) {
        isRebuildQueued = false;
        void setupJobs();
    }
}
let retryCount = 0;
function waitForValidDateAndSetupJobs() {
    serverStatus.status.systemDate.status = 'started';
    if (isSystemDateValid()) {
        serverStatus.status.systemDate.status = 'healthy';
        serverStatus.status.systemDate.message = '';
        logger.info('System date is valid. Setting up jobs...');
        void setupJobs();
    }
    else if (retryCount < 20) {
        serverStatus.status.systemDate.status = 'retrying';
        const message = `System date is invalid (year 2010). Retrying in 5 seconds... (Attempt #${retryCount}})`;
        serverStatus.status.systemDate.message = message;
        retryCount++;
        logger.debug(message);
        setTimeout(waitForValidDateAndSetupJobs, 5_000);
    }
    else {
        const message = `System date is invalid! No jobs can be scheduled! ${new Date().toISOString()} `;
        serverStatus.status.systemDate.message = message;
        logger.warn(message);
    }
}
// Monitor the JSON file and refresh jobs on change
chokidar.watch(config.lowDbFolder).on('change', (changedPath) => {
    const fileName = path.basename(changedPath);
    if (fileName === 'servicesDB.json') {
        logger.info(`Skipping restarting jobs for DB change: ${fileName}`);
        return;
    }
    else {
        logger.info(`Detected DB change, reloading... ${fileName}`);
    }
    if (serverStatus.status.systemDate.status === 'healthy') {
        void setupJobs();
    }
    else {
        waitForValidDateAndSetupJobs();
    }
});
// Initial job setup
waitForValidDateAndSetupJobs();
// How often the jobs are looked over for one that should have run, and the least time between
// two rebuilds made for that reason
const OVERDUE_CHECK_MS = 60_000;
const MIN_OVERDUE_REBUILD_GAP_MS = 5 * 60_000;
let lastOverdueRebuildMs = 0;
// Builds every job again when one is found stuck (overdueJobs.ts). A missed job is not run
// late; this only makes sure the ones still to come do run.
const overdueTimer = setInterval(() => {
    if (serverStatus.status.jobs.status !== 'healthy')
        return;
    const nowMs = Date.now();
    if (nowMs - lastOverdueRebuildMs < MIN_OVERDUE_REBUILD_GAP_MS)
        return;
    const waitingJobs = Object.entries(schedule.scheduledJobs).map(([name, job]) => ({ name, nextRunMs: job.nextInvocation()?.getTime() }));
    const overdueJob = findOverdueJob(waitingJobs, nowMs);
    if (!overdueJob)
        return;
    lastOverdueRebuildMs = nowMs;
    logger.warn(`The job "${overdueJob}" should have run by now and has not. Building every job again.`);
    void setupJobs();
}, OVERDUE_CHECK_MS);
// The check alone should not keep the server running
overdueTimer.unref();
//# sourceMappingURL=jobScheduler.js.map
//# debugId=d0d84671-b483-5330-8214-321a37ffff65
