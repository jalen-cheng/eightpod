import { http, HttpResponse } from 'msw/http';
import { delay } from 'msw/utils/delay';
import { sse } from 'msw/sse';
import type { SleepRecord } from '@api/sleepSchema.ts';
import type { Jobs } from '@api/jobs.ts';
import {
  getServices,
  updateServices,
  getSchedules,
  updateSchedules,
  getSettings,
  updateSettings,
  getDeviceStatus,
  updateDeviceStatus,
  getServerStatus,
  listSleepRecords,
  setSleepRecords,
  listMovementRecords,
  listVitalsRecords,
  filterByQuery,
  listLogs,
  getLogFiles,
  handleJobs,
} from './mockData';

type Side = 'left' | 'right';

type Filters = {
  startTime?: string;
  endTime?: string;
  side?: Side;
};

const deepClone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const toFilters = (request: Request): Filters => {
  const url = new URL(request.url);
  const startTime = url.searchParams.get('startTime') ?? undefined;
  const endTime = url.searchParams.get('endTime') ?? undefined;
  const sideParam = url.searchParams.get('side') ?? undefined;
  const side = sideParam === 'left' || sideParam === 'right' ? sideParam : undefined;
  return { startTime, endTime, side };
};

// The sides a request for 'left', 'right' or 'both' applies to
const alarmSides = (side: Side | 'both' | undefined): Side[] => (side === 'left' || side === 'right' ? [side] : ['left', 'right']);

const notFound = (message: string) => HttpResponse.json({ message }, { status: 404 });

// As on a Pod, there is no sleep data unless biometrics is switched on in Settings
const isBiometricsOn = () => getServices().biometrics.enabled;

export const handlers = [
  http.post('/api/metrics/presence/sensors/empty', async () => {
    await delay(120);
    return new HttpResponse(null, { status: 204 });
  }),
  // A week of saved nights on the left, each with a watch's times a few minutes off the bed's, and a nap
  http.get('/api/autopilot/nights', async () => {
    await delay(80);
    const MINUTE_MS = 60_000;
    const lastMidnight = new Date().setHours(0, 0, 0, 0);
    const nights = Array.from({ length: 7 }, (_unused, index) => {
      const startedAtMs = lastMidnight - index * 24 * 60 * MINUTE_MS - (70 - index * 4) * MINUTE_MS;
      const asleepAtMs = startedAtMs + (18 + index * 2) * MINUTE_MS;
      const awakeAtMs = asleepAtMs + (430 + index * 6) * MINUTE_MS;
      return {
        side: 'left', startedAtMs, minutesLogged: Math.round((awakeAtMs - startedAtMs) / MINUTE_MS) + 9, kind: 'night',
        asleepAtMs, awakeAtMs, heartRate: 54 + (index % 3), breathingRate: 14 - (index % 2),
        tracker: {
          source: 'Apple Health', asleepAtMs: asleepAtMs - (9 - index) * MINUTE_MS, awakeAtMs: awakeAtMs + (index - 3) * MINUTE_MS,
          receivedAtMs: awakeAtMs + 40 * MINUTE_MS,
        },
      };
    });
    const napStartedAtMs = lastMidnight - 9 * 60 * MINUTE_MS;
    nights.splice(1, 0, {
      side: 'left', startedAtMs: napStartedAtMs, minutesLogged: 58, kind: 'nap',
      asleepAtMs: napStartedAtMs + 12 * MINUTE_MS, awakeAtMs: napStartedAtMs + 52 * MINUTE_MS, heartRate: 58, breathingRate: 15,
    } as typeof nights[number]);
    return HttpResponse.json(nights);
  }),
  http.get('/api/autopilot/nights/export', async () => {
    await delay(80);
    return HttpResponse.json({ exportedAt: new Date().toISOString(), nights: [] }, {
      headers: { 'Content-Disposition': 'attachment; filename="eightpod-nights-demo.json"' },
    });
  }),
  // The autopilot early in the night: the left sleeper asleep, the right side empty
  http.get('/api/autopilot', async () => {
    await delay(60);
    return HttpResponse.json({
      available: true,
      enabled: true,
      room: { temperatureF: 68, humidityPercent: 46 },
      left: {
        stage: 'asleep', heartRate: 54, breathingRate: 14, minutesAsleep: 62, offsetF: -3,
        lastChange: '3°F cooler (time of night, first sleep cycle)', learned: { early: -0.5, middle: 0, late: 0 },
        sleepKind: 'night', rules: { stillMinutesToSleep: 10, restlessSecondsToWake: 20 },
        tracker: { source: 'Apple Health', syncedAt: new Date().toISOString(), nights: 6, onsetErrorMinutes: 7, wakeErrorMinutes: 4 },
      },
      right: { stage: 'out', learned: { early: 0, middle: 0, late: 0 }, rules: { stillMinutesToSleep: 15, restlessSecondsToWake: 12 } },
    });
  }),
  // The bed's presence sensors: someone on the left, nobody on the right
  http.get('/api/metrics/presence/sensors', async () => {
    await delay(60);
    const changedAt = new Date().toISOString();
    return HttpResponse.json({
      available: true,
      left: { present: true, signal: 4310, baseline: 3890, changedAt },
      right: { present: false, signal: 3955, baseline: 3950, changedAt },
    });
  }),
  http.get('/api/services', async () => {
    await delay(120);
    return HttpResponse.json(deepClone(getServices()));
  }),
  http.post('/api/services', async ({ request }) => {
    const body = (await request.json()) as Partial<ReturnType<typeof getServices>>;
    const updated = updateServices(body);
    await delay(120);
    return HttpResponse.json(deepClone(updated));
  }),
  http.get('/api/schedules', async () => {
    await delay(120);
    return HttpResponse.json(deepClone(getSchedules()));
  }),
  http.post('/api/schedules', async ({ request }) => {
    const body = (await request.json()) as Partial<ReturnType<typeof getSchedules>>;
    const updated = updateSchedules(body);
    await delay(120);
    return HttpResponse.json(deepClone(updated));
  }),
  http.get('/api/settings', async () => {
    await delay(120);
    return HttpResponse.json(deepClone(getSettings()));
  }),
  http.post('/api/settings', async ({ request }) => {
    const body = (await request.json()) as Partial<ReturnType<typeof getSettings>>;
    const updated = updateSettings(body);
    await delay(120);
    return HttpResponse.json(deepClone(updated));
  }),
  // A one-time alarm is kept as an override on each side's settings, as the server does
  http.post('/api/alarm/time', async ({ request }) => {
    const body = (await request.json()) as { side?: Side | 'both'; time?: string };
    if (!body.time) return HttpResponse.json({ error: 'Invalid request data' }, { status: 400 });
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1_000).toISOString();
    const override = { scheduleOverrides: { alarm: { disabled: false, timeOverride: body.time, expiresAt } } };
    updateSettings(Object.fromEntries(alarmSides(body.side).map(alarmSide => [alarmSide, override])));
    await delay(120);
    return HttpResponse.json(deepClone(getSettings()));
  }),
  http.post('/api/alarm/time/cancel', async ({ request }) => {
    const body = (await request.json()) as { side?: Side | 'both' };
    const override = { scheduleOverrides: { alarm: { disabled: false, timeOverride: '', expiresAt: '' } } };
    updateSettings(Object.fromEntries(alarmSides(body.side).map(alarmSide => [alarmSide, override])));
    await delay(120);
    return HttpResponse.json(deepClone(getSettings()));
  }),
  // "Test for a minute": nothing to vibrate in the demo
  http.post('/api/alarm', async () => {
    await delay(120);
    return new HttpResponse(null, { status: 204 });
  }),
  http.get('/api/deviceStatus', async () => {
    await delay(120);
    return HttpResponse.json(deepClone(getDeviceStatus()));
  }),
  http.post('/api/deviceStatus', async ({ request }) => {
    const body = (await request.json()) as Partial<ReturnType<typeof getDeviceStatus>>;
    updateDeviceStatus(body);
    await delay(120);
    return new HttpResponse(null, { status: 204 });
  }),
  http.get('/api/serverStatus', async () => {
    await delay(150);
    return HttpResponse.json(deepClone(getServerStatus()));
  }),
  http.get('/api/metrics/sleep', async ({ request }) => {
    const filters = toFilters(request);
    const records = isBiometricsOn() ? listSleepRecords() : [];
    // @ts-expect-error
    const filtered = filterByQuery(records, filters, (record: SleepRecord) => Date.parse(record.entered_bed_at));
    await delay(150);
    return HttpResponse.json(deepClone(filtered));
  }),
  http.delete('/api/metrics/sleep/:id', async ({ params }) => {
    const id = Number(params.id);
    const records = listSleepRecords();
    const next = records.filter((record) => record.id !== id);
    if (next.length === records.length) {
      return notFound('Sleep record not found');
    }
    setSleepRecords(next);
    await delay(80);
    return new HttpResponse(null, { status: 204 });
  }),
  http.put('/api/metrics/sleep/:id', async ({ params, request }) => {
    const id = Number(params.id);
    const updates = (await request.json()) as Partial<SleepRecord>;
    const records = deepClone(listSleepRecords());
    const index = records.findIndex((record) => record.id === id);
    if (index === -1) {
      return notFound('Sleep record not found');
    }
    const updatedRecord = { ...records[index], ...updates } satisfies SleepRecord;
    records[index] = updatedRecord;
    setSleepRecords(records);
    await delay(80);
    return HttpResponse.json(updatedRecord);
  }),
  http.get('/api/metrics/movement', async () => {
    // const filters = toFilters(request);
    const records = isBiometricsOn() ? listMovementRecords() : [];
    // const filtered = filterByQuery(records, filters, (record: MovementRecord) => record.timestamp * 1000);
    await delay(120);
    return HttpResponse.json(records);
  }),
  http.get('/api/metrics/vitals', async () => {
    // const filters = toFilters(request);
    const records = isBiometricsOn() ? listVitalsRecords() : [];
    // const filtered = filterByQuery(records, filters, (record: VitalsRecord) => record.timestamp * 1000);
    await delay(120);
    return HttpResponse.json(records);
  }),
  http.get('/api/metrics/vitals/summary', async () => {
    await delay(120);
    return HttpResponse.json({
      avgHeartRate: 55,
      minHeartRate: 45,
      maxHeartRate: 68,
      avgHRV: 63,
      avgBreathingRate: 12,
    });
  }),
  http.post('/api/jobs', async ({ request }) => {
    const jobs = (await request.json()) as Jobs;
    handleJobs(jobs);
    await delay(150);
    return new HttpResponse(null, { status: 204 });
  }),
  http.get('/api/logs', async () => {
    await delay(120);
    return HttpResponse.json({ logs: getLogFiles() });
  }),
  // Stream existing and newly appended demo log entries until the viewer disconnects.
  sse('/api/logs/:filename', ({ params, request, client }) => {
    const filename = String(params.filename);
    const logStore = listLogs();
    const initialLogs = deepClone(logStore[filename] ?? []);
    if (!logStore[filename]) {
      client.send({ data: JSON.stringify({ message: 'Log file not found' }) });
      client.close();
      return;
    }

    initialLogs.forEach((entry) => {
      client.send({ data: JSON.stringify({ message: entry }) });
    });
    let lastIndex = initialLogs.length;
    const interval = setInterval(() => {
      const latest = listLogs()[filename] ?? [];
      if (latest.length > lastIndex) {
        latest.slice(lastIndex).forEach((entry) => {
          client.send({ data: JSON.stringify({ message: entry }) });
        });
        lastIndex = latest.length;
      }
    }, 2000);
    request.signal.addEventListener('abort', () => clearInterval(interval), { once: true });
  }),
];
