// Watches the bed's capacitive sensors to know whether someone is in bed, and runs what the
// settings say that should set off (see jobs/presenceActions.ts).
//
// A Pod 5's firmware publishes the sensors on its local message bus (NATS) twice a second. A Pod
// without that bus, or without that subject, simply never produces a reading: presence then
// stays "not available" and nothing else is affected.
import cbor from 'cbor';
import moment from 'moment-timezone';
import { NatsConnection, Subscription, connect } from 'nats';
import logger from '../logger.js';
import settingsDB from '../db/settings.js';
import schedulesDB from '../db/schedules.js';
import { DayOfWeek, Side } from '../db/schedulesSchema.js';
import { connectFranken } from './frankenServer.js';
import { CapacitiveReading, PRESENCE_DELTAS, PresenceSnapshot, SidePresence, createPresenceDetector } from './presenceDetector.js';
import { BedSession, PresenceAction, createBedSession, takeDueActions, trackBedSession } from '../jobs/presenceActions.js';
import { executeAlarm, getOneOffAlarmSettings } from '../jobs/alarmScheduler.js';
import { updateDeviceStatus } from '../routes/deviceStatus/updateDeviceStatus.js';

const NATS_SERVER = process.env.NATS_SERVER || '127.0.0.1:4222';
const CAPACITIVE_SUBJECT = 'rawmem.sens.capsense';
const SIDES: Side[] = ['left', 'right'];
const RECONNECT_WAIT_MS = 60_000;
// How often the stays in bed are checked against the settings
const ACTION_CHECK_INTERVAL_MS = 10_000;
// A reading older than this means the sensors have gone quiet
const STALE_READING_MS = 30_000;
const SECONDS_PER_HOUR = 3_600;

type CapacitiveMessage = Partial<Record<Side, CapacitiveReading>>;

const latest: Partial<Record<Side, SidePresence>> = {};
let lastReadingAtMs = 0;

// What the sensors say right now, for the API and the app
export function getPresenceSnapshot(nowMs: number = Date.now()): PresenceSnapshot {
  return { available: nowMs - lastReadingAtMs < STALE_READING_MS, left: latest.left, right: latest.right };
}

export class PresenceMonitor {
  private connection: NatsConnection | undefined;
  private subscription: Subscription | undefined;
  private reconnectTimer: ReturnType<typeof setTimeout> | undefined;
  private actionTimer: ReturnType<typeof setInterval> | undefined;
  private isStopped = false;
  private hasWarned = false;
  private readonly detectors = { left: createPresenceDetector(), right: createPresenceDetector() };
  // One stay per side, or one for the whole bed ("both") while the sides are linked
  private readonly sessions: Record<Side | 'both', BedSession> = {
    left: createBedSession(), right: createBedSession(), both: createBedSession(),
  };

  start() {
    void this.listen();
    this.actionTimer = setInterval(() => void this.runActions(), ACTION_CHECK_INTERVAL_MS);
  }

  async stop() {
    this.isStopped = true;
    clearTimeout(this.reconnectTimer);
    clearInterval(this.actionTimer);
    this.subscription?.unsubscribe();
    await this.connection?.close().catch(() => undefined);
  }

  // Connects to the firmware's message bus and handles readings until the connection ends,
  // then tries again later. A Pod without the bus is retried quietly.
  private async listen() {
    try {
      this.connection = await connect({ servers: NATS_SERVER, maxReconnectAttempts: -1, name: 'free-sleep-presence' });
      this.subscription = this.connection.subscribe(CAPACITIVE_SUBJECT);
      logger.info('Presence monitor is listening for the bed sensors');
      for await (const message of this.subscription) {
        this.handleReading(cbor.decodeFirstSync(Buffer.from(message.data)) as CapacitiveMessage);
      }
    } catch (error: unknown) {
      if (!this.hasWarned) {
        const reason = error instanceof Error ? error.message : String(error);
        logger.warn(`Presence monitor cannot reach the bed sensors (${reason}); it will keep trying`);
        this.hasWarned = true;
      }
    }
    if (!this.isStopped) this.reconnectTimer = setTimeout(() => void this.listen(), RECONNECT_WAIT_MS);
  }

  private handleReading(message: CapacitiveMessage) {
    const nowMs = Date.now();
    const presenceDelta = PRESENCE_DELTAS[settingsDB.data.presence.sensitivity];
    for (const side of SIDES) {
      const reading = message[side];
      if (!reading) continue;
      const estimate = this.detectors[side].update(reading, nowMs, presenceDelta);
      const previous = latest[side];
      if (previous?.present === estimate.present) {
        latest[side] = { ...estimate, changedAt: previous.changedAt };
        continue;
      }
      if (previous) logger.debug(`Presence: ${side} side is now ${estimate.present ? 'in bed' : 'empty'}`);
      latest[side] = { ...estimate, changedAt: new Date(nowMs).toISOString() };
    }
    lastReadingAtMs = nowMs;
  }

  // Checks each stay in bed against the settings and runs what has come due
  private async runActions() {
    try {
      const nowMs = Date.now();
      if (!getPresenceSnapshot(nowMs).available) return;
      await settingsDB.read();
      const settings = settingsDB.data;
      const { wakeAfterHours, turnOnWhenInBed } = settings.presence;
      const units: { key: Side | 'both'; sides: Side[] }[] = settings.linkSides
        ? [{ key: 'both', sides: SIDES }]
        : SIDES.map(side => ({ key: side, sides: [side] }));

      for (const unit of units) {
        // A side in away mode has nobody to act for
        const activeSides = unit.sides.filter(side => !settings[side].awayMode);
        const isPresentNow = activeSides.some(side => latest[side]?.present);
        const session = trackBedSession(this.sessions[unit.key], isPresentNow, nowMs);
        if (session.inBedSinceMs === undefined || activeSides.length === 0) continue;
        if (!wakeAfterHours.enabled && !turnOnWhenInBed.enabled) continue;

        // The firmware is only asked whether the bed is on when turning it on is still possible
        const mayTurnOn = turnOnWhenInBed.enabled && !session.hasTurnedOn && isPresentNow;
        const isOn = mayTurnOn ? await this.isAnySideOn(activeSides) : true;
        const clockTime = moment.tz(settings.timeZone).format('HH:mm');
        const dueActions = takeDueActions(session, settings.presence, { nowMs, clockTime, isPresentNow, isOn });
        for (const action of dueActions) await this.runAction(action, activeSides);
      }
    } catch (error: unknown) {
      logger.error(error);
    }
  }

  private async isAnySideOn(sides: Side[]) {
    const deviceStatus = await (await connectFranken()).getDeviceStatus();
    return sides.some(side => deviceStatus[side].isOn);
  }

  private async runAction(action: PresenceAction, sides: Side[]) {
    const settings = settingsDB.data;
    const now = moment.tz(settings.timeZone);
    logger.info(`Presence: running "${action}" for ${sides.join(' and ')}`);
    if (action === 'wake') {
      // Vibrates as that day's alarm is set up to, whether or not the side is on
      for (const side of sides) {
        const { vibrationIntensity, duration, vibrationPattern, turnOffAfterDismiss } = getOneOffAlarmSettings(settings, side, now);
        await executeAlarm({ side, vibrationIntensity, duration, vibrationPattern, turnOffAfterDismiss, force: true });
      }
      return;
    }
    // Turn on at the temperature tonight's schedule starts with. Before noon, "tonight" began yesterday.
    await schedulesDB.read();
    const nightStart = now.hour() < 12 ? now.clone().subtract(1, 'day') : now;
    const nightDay = nightStart.format('dddd').toLowerCase() as DayOfWeek;
    const secondsRemaining = settings.presence.turnOnWhenInBed.hours * SECONDS_PER_HOUR;
    const update = Object.fromEntries(sides.map(side => [
      side, { isOn: true, targetTemperatureF: schedulesDB.data[side][nightDay].power.onTemperature, secondsRemaining },
    ]));
    await updateDeviceStatus(update, { isManual: true });
  }
}
