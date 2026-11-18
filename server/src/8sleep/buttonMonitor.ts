import { ChildProcess, spawn } from 'child_process';
import { createInterface } from 'readline';
import logger from '../logger.js';
import config from '../config.js';
import settingsDB from '../db/settings.js';
import { Side } from '../db/schedulesSchema.js';
import { Version } from '../routes/deviceStatus/deviceStatusSchema.js';
import { connectFranken } from './frankenServer.js';
import { toFirmwareSide } from './sideMapping.js';
import {
  ButtonPress, countPressesAsGestures, createButtonLineParser, hasTemperaturePress, isPowerHold,
} from './buttonEvents.js';
import { noteAlarmGestureHandled, runSideGestures, setSidePower } from './gestureActions.js';

// Presses are collected for this long before acting, so a quick run of "+" presses becomes one
// temperature change from one reading of the current target
const PRESS_BATCH_MS = 400;
// The firmware takes a moment to report a target it was just given. A press that follows
// within this time builds on the target we last set instead of the stale reported one.
const RECENT_TARGET_MS = 5_000;
// Pause before reopening the firmware log if following it stops
const RESTART_WAIT_MS = 5_000;
// How often to look for a Pod 5 cover while none is attached
const COVER_CHECK_INTERVAL_MS = 30_000;

// Follows the firmware's log on a Pod 5 and runs the configured action for each button press.
// The Pod 5's buttons do not show up in the tap counters that FrankenMonitor polls.
export class ButtonMonitor {
  private isRunning = false;
  private logFollower?: ChildProcess;
  private pendingPresses: Record<Side, ButtonPress[]> = { left: [], right: [] };
  private batchTimer?: NodeJS.Timeout;
  // Batches run one after another, so two never read and change the same target at once
  private batchQueue: Promise<void> = Promise.resolve();
  private coverCheckTimer?: NodeJS.Timeout;
  private lastCoverVersion?: string;
  private hasWarnedAboutLog = false;
  private recentTargets: Partial<Record<Side, { temperatureF: number; setAtMs: number }>> = {};

  // Starts following the firmware log as soon as a Pod 5 cover is attached. The cover may be
  // plugged in (or swapped) long after the server starts, so this keeps checking until then.
  public start() {
    if (this.isRunning) return;
    this.isRunning = true;
    void this.startWhenPod5CoverAttached();
  }

  public stop() {
    this.isRunning = false;
    if (this.batchTimer) clearTimeout(this.batchTimer);
    if (this.coverCheckTimer) clearTimeout(this.coverCheckTimer);
    this.logFollower?.kill();
  }

  private async startWhenPod5CoverAttached() {
    if (!this.isRunning) return;
    let coverVersion: string = Version.NotFound;
    try {
      const franken = await connectFranken();
      coverVersion = (await franken.getDeviceStatus(false, true)).coverVersion;
    } catch (error) {
      logger.debug(`Button monitor could not read the cover version: ${error instanceof Error ? error.message : String(error)}`);
    }
    if (!this.isRunning) return;
    if (coverVersion === Version.Pod5) {
      this.followFirmwareLog();
      logger.info('Button monitor started');
      return;
    }
    // Logged once per change, so a Pod without a Pod 5 cover does not fill the log
    if (coverVersion !== this.lastCoverVersion) {
      logger.debug(`Button monitor waiting for a Pod 5 cover (cover: ${coverVersion})`);
      this.lastCoverVersion = coverVersion;
    }
    this.coverCheckTimer = setTimeout(() => void this.startWhenPod5CoverAttached(), COVER_CHECK_INTERVAL_MS);
  }

  // Streams new lines of the firmware's journal. Starting at the end (`-n 0`) means presses made
  // before the server started are never replayed.
  private followFirmwareLog() {
    const parseLine = createButtonLineParser();
    const logFollower = spawn('journalctl', ['-u', config.firmwareLogUnit, '-f', '-n', '0', '-o', 'cat'], {
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    this.logFollower = logFollower;

    createInterface({ input: logFollower.stdout! }).on('line', (line) => {
      this.hasWarnedAboutLog = false;
      const press = parseLine(line);
      if (press) this.addPress(press);
    });
    logFollower.on('error', error => logger.error(`Button monitor could not read the firmware log: ${error.message}`));
    logFollower.on('close', (exitCode) => {
      if (!this.isRunning) return;
      // Logged once per run of failures: a server that may not read the journal fails every time
      if (!this.hasWarnedAboutLog) {
        logger.warn(`Button monitor cannot follow the firmware log (journalctl exited with ${exitCode}). `
          + 'The server user needs the systemd-journal group; reinstalling EightPod sets it. Retrying quietly...');
        this.hasWarnedAboutLog = true;
      }
      setTimeout(() => {
        if (this.isRunning) this.followFirmwareLog();
      }, RESTART_WAIT_MS);
    });
  }

  // `firmwarePress` names the side as the firmware does; it is turned into EightPod's side here
  private addPress(firmwarePress: ButtonPress) {
    const press = { ...firmwarePress, side: toFirmwareSide(firmwarePress.side) };
    logger.debug(`Button press: ${press.side} ${press.button} x${press.count}${press.heldMs === undefined ? '' : ` held ${press.heldMs}ms`}`);
    this.pendingPresses[press.side].push(press);
    if (this.batchTimer) clearTimeout(this.batchTimer);
    this.batchTimer = setTimeout(() => {
      const presses = this.pendingPresses;
      this.pendingPresses = { left: [], right: [] };
      this.batchQueue = this.batchQueue.then(() => this.runBatch(presses));
    }, PRESS_BATCH_MS);
  }

  // Acts on one batch of presses: power holds first, then everything else through the same
  // gesture settings the tap counters use.
  private async runBatch(presses: Record<Side, ButtonPress[]>) {
    try {
      const franken = await connectFranken();
      const deviceStatus = await franken.getDeviceStatus(false, true);
      await settingsDB.read();
      for (const side of Object.keys(presses) as Side[]) {
        const sidePresses = presses[side];
        if (sidePresses.length === 0) continue;
        if (sidePresses.some(isPowerHold)) {
          logger.debug(`Middle button held on ${side}, switching power`);
          await setSidePower(side, !deviceStatus[side].isOn);
          // The firmware can follow a long hold with a second, shorter middle event. Without
          // this it would be taken as a new press and switch the side straight back.
          noteAlarmGestureHandled(side);
          continue;
        }
        // + or - on a side that is off switches it on at its current target. During an alarm
        // the press belongs to the alarm instead.
        if (!deviceStatus[side].isOn && !deviceStatus[side].isAlarmVibrating && hasTemperaturePress(sidePresses)) {
          logger.debug(`Temperature button pressed on ${side} while off, switching on`);
          await setSidePower(side, true);
          continue;
        }
        const recentTarget = this.recentTargets[side];
        if (recentTarget && Date.now() - recentTarget.setAtMs < RECENT_TARGET_MS) {
          deviceStatus[side].targetTemperatureF = recentTarget.temperatureF;
        }
        // The gesture code works on counters, so presses are passed as a count starting from zero
        const targetTemperatureF = await runSideGestures(side, deviceStatus, { doubleTap: 0, tripleTap: 0, quadTap: 0 }, {
          doubleTap: 0, tripleTap: 0, quadTap: 0, ...countPressesAsGestures(sidePresses, deviceStatus[side].isAlarmVibrating),
        });
        if (targetTemperatureF !== undefined) {
          this.recentTargets[side] = { temperatureF: targetTemperatureF, setAtMs: Date.now() };
        }
      }
    } catch (error) {
      logger.error(error);
    }
  }
}
