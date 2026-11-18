# EightPod Agent Notes

## What This Repo Is
- EightPod is a local controller for 8 Sleep Pods. The server runs on the Pod's embedded Linux system and exposes a local REST API. The app is a React/MUI web UI served by the server.
- The Pod hardware is controlled through a Unix socket called `dac.sock`; this repo calls that integration "Franken" or "Franken sock".
- Persistent user data lives under `/persistent/free-sleep-data/` on the Pod. Local development mirrors parts of that under `server/free-sleep-data/`.

## Top-Level Layout
- `app/`: Vite React frontend using MUI, Zustand, React Query, and Axios.
- `server/`: Express TypeScript backend, LowDB JSON settings/schedules, Prisma SQLite metrics, node-schedule jobs, and Franken socket control.
- `biometrics/`: Python stream processing, sleep detection, vitals calculation, and SQLite writes for biometrics.
- `scripts/`: Pod install/update/reset/service helper scripts.
- `docs/`: user guides, screenshots and hardware teardown photos. `DEVELOPING.md` covers setup, checks and releases.
- `tests/`: Node tests (`node --test tests/*.test.mjs`) that import the TypeScript sources directly, so the modules they load must have no runtime imports.
- `server/dist` and `server/public` are committed build output: the Pod runs them as downloaded, so every source change ships with a rebuild.

## Common Commands
- App typecheck: `cd app && npx tsc -b`
- App lint: `cd app && npm run lint`
- App dev server: `cd app && VITE_POD_IP=<pod-ip> npm run dev`
- Server typecheck without writing `dist`: `cd server && npx tsc --noEmit`
- Server lint: `cd server && npm run lint`
- Server hot reload on Pod: `fs-dev-server` (see `DEVELOPING.md`)
- Server local dev: `cd server && npm run dev:local`

## Runtime Notes
- `server/src/config.ts` requires `DATA_FOLDER` and `ENV`; Pod runtime gets these through `server/.env.pod` via `npm start`.
- `server/src/jobs/jobScheduler.ts` schedules jobs at import time and watches the LowDB folder for changes. Writes to settings or schedules trigger full job cancellation and recreation.
- Schedule data is stored in `schedulesDB.json`; settings are stored in `settingsDB.json`; service health is stored in `servicesDB.json`.
- The app imports schemas directly from `server/src/db/*Schema.ts`; schema changes must remain compatible with both app and server TypeScript settings.

## Scheduling Hotspots
- Client schedule state lives in `app/src/pages/SchedulePage/scheduleStore.tsx`.
- Schedule save payloads are assembled in `app/src/pages/SchedulePage/SchedulePage.tsx`.
- Server schedule writes are handled by `server/src/routes/schedules/schedules.ts`.
- Scheduled jobs are created in:
  - `server/src/jobs/powerScheduler.ts`
  - `server/src/jobs/temperatureScheduler.ts`
  - `server/src/jobs/alarmScheduler.ts`
  - `server/src/jobs/primeScheduler.ts`
- Pure helpers the jobs rely on, each with tests in `tests/`: `server/src/jobs/scheduleTiming.ts` (which day a time belongs to), `alarmSession.ts` (alarm stretches and dismissal), `presenceActions.ts` (what being in bed sets off), `manualHold.ts`, `preWarmState.ts`, and `server/src/db/automaticOffTime.ts` (the bed's off time follows the wake-up time).

## Franken Hotspots
- Socket lifecycle: `server/src/8sleep/frankenServer.ts`
- Socket server wrapper: `server/src/8sleep/unixSocketServer.ts`
- Message parsing: `server/src/8sleep/messageStream.ts`
- Hardware command map: `server/src/8sleep/deviceApi.ts`
- Device status parsing: `server/src/8sleep/loadDeviceStatus.ts`
- Pod 5 buttons, read from the firmware journal: `server/src/8sleep/buttonMonitor.ts`, `buttonEvents.ts`
- Bed sensors over the firmware's NATS bus (in-bed detection, measured water temperature): `server/src/8sleep/bedSensorMonitor.ts`, `presenceDetector.ts`, `measuredWater.ts`
- Left/right flip, applied only where the server meets the firmware: `server/src/8sleep/sideMapping.ts`
- Startup initializes Franken from `server/src/server.ts`; health is surfaced through `server/src/serverStatus.ts`.

## Review Cautions
- Check timezone behavior with `moment-timezone`; the app sets a default timezone after settings load, and server jobs set `RecurrenceRule.tz`.
- Prefer adding tests or small reproductions around scheduling time math before changing job timing.
- When reviewing install/update scripts, remember they run as root or through sudo on an embedded Yocto-based system.


# Releases
- `server/src/serverInfo.json` holds EightPod's version. The app compares it with the copy on `main` to offer an update, so raise it (semver) in any PR whose change people should update for.

# Code smells
- Any complicated functions should have concise, short comments explaining what the function does
- Do not write obscure code with abbreviated variable names <= 2 characters
- Scalability is important, don't write one off hacks. Ensure new files and code are placed in appropriate locations.


