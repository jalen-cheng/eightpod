# API reference

The server on the Pod serves the web app and a JSON API on port 3000 and also on port 80. API paths start with `/api`, so
`http://<pod-ip>/api/deviceStatus` works too.

```bash
curl http://<pod-ip>:3000/api/deviceStatus
```

Contents: [What you can control](#what-you-can-control) · [General](#general) · [Device status](#device-status) · [Dial](#dial) · [Alarms](#alarms) · [Settings](#settings) · [Schedules](#schedules) · [Execute](#execute) · [Jobs](#jobs) · [Services](#services) · [Server status](#server-status) · [Logs](#logs) · [Metrics](#metrics) · [Presence](#presence) · [Autopilot](#autopilot)

## What you can control

Everything the app does is a request listed here, and every command the firmware accepts can be
sent. Nothing needs an Eight Sleep account, a subscription or the internet.

| To do this | Use |
|---|---|
| Read the bed: on or off, target and measured temperature, time left, water, priming | [`GET /api/deviceStatus`](#get-apidevicestatus) |
| Turn a side on or off, set its temperature, stop an alarm, start priming, set LED brightness | [`POST /api/deviceStatus`](#post-apidevicestatus) |
| Set the temperature on Eight Sleep's -10 to +10 scale, or read it as a sentence | [Dial](#dial) |
| Vibrate now, set a one-time alarm, move or cancel the next alarm, change a weekly alarm | [Alarms](#alarms) |
| Read or change the weekly schedule | [Schedules](#schedules) |
| Read or change settings: time zone, away mode, buttons and taps, in-bed detection, priming, reboot | [Settings](#settings) |
| Know whether someone is in bed (Pod 5) | [Presence](#presence) |
| See what the autopilot reads and has done; switch it on with `autopilot.enabled` in Settings (Pod 5) | [Autopilot](#autopilot) |
| Update EightPod, reboot the Pod, run calibration | [Jobs](#jobs) |
| Send a firmware command directly | [`POST /api/execute`](#post-apiexecute) |
| Check health and read logs | [Server status](#server-status), [Logs](#logs) |

Five firmware commands are deliberately not sent by anything here, because what they do on a Pod
is either destructive or unknown: reset, force reset, format, solo alarm and stop priming.

**Connecting other things.** The API is plain JSON over HTTP on your home network, with no login,
so anything that can send a web request can use it: iPhone Shortcuts
([recipes](../docs/IOS_SHORTCUTS.md)), Home Assistant's `rest_command` and `rest` sensors, a cron
job with `curl`, or an AI assistant given this file and a way to make requests. From outside the
home, reach the Pod over [Tailscale](../docs/REMOTE_ACCESS.md) first; never expose it to the internet.

## General

- **No login.** Anything that can reach port 3000 can control the bed.
- **Origins.** Requests without an `Origin` header (curl, phone shortcuts) are accepted. A browser page may call the API only when its origin's host is one of:
  - `localhost`, or an address in `127.x.x.x`, `10.x.x.x`, `192.168.x.x`, `172.16-31.x.x`, or `100.64.0.0/10` (the range Tailscale uses);
  - the Pod's own hostname, `<hostname>.local`, or `<hostname>.<anything>.ts.net`;
  - an origin starting with the `ALLOWED_ORIGIN` environment variable, if set (`*` allows every origin).

  Other origins get a 500 with `{"error": {"message": "Not allowed by CORS"}}`.
- **Bodies** are JSON (`Content-Type: application/json`).
- **Partial updates.** `POST /api/deviceStatus`, `/api/settings`, `/api/schedules` and `/api/services` accept any subset of the fields. Unknown fields are rejected where the schema is strict (device status, schedules, the top level and each side of settings, the top level of services).
- **Sides.** `left` and `right` are the sides as named in the app. If `swapSides` is on in settings, the server swaps them when talking to the firmware.
- **Temperatures** are in °F whatever `temperatureFormat` is set to.

Status codes worth knowing:

| Code | When |
| --- | --- |
| 204 | `POST /api/deviceStatus`, `POST /api/jobs`, `DELETE /api/metrics/sleep/:id` succeeded. No body. |
| 400 | Invalid body. Most endpoints answer `{"error": "Invalid request data", "details": [...]}`, where `details` is the list of zod issues, or one sentence when a rule other than the body's shape was broken (for example a wake-up time too close to the bed-on time). Unparseable JSON gives `{"error": {"message": "Invalid JSON"}}`. |
| 404 | Unknown `/api/*` path: `{"error": {"message": "Not Found"}}`. |
| 409 | `POST /api/alarm/time` with `shiftMinutes` when there is no alarm to move. |
| 500 | Anything else that fails: `{"error": {"message": "..."}}`. |

---

## Device status

### `GET /api/deviceStatus`

The current state of the Pod, read from the firmware.

```json
{
  "left": {
    "currentTemperatureLevel": -12,
    "currentTemperatureF": 78,
    "measuredTemperatureF": 78.3,
    "targetTemperatureF": 75,
    "secondsRemaining": 21600,
    "isOn": true,
    "isAlarmVibrating": false
  },
  "right": {
    "currentTemperatureLevel": 0,
    "currentTemperatureF": 81,
    "targetTemperatureF": 81,
    "secondsRemaining": 0,
    "isOn": false,
    "isAlarmVibrating": false
  },
  "coverVersion": "Pod 5",
  "hubVersion": "Pod 5",
  "eightPod": { "version": "3.4.0", "branch": "main" },
  "waterLevel": "true",
  "isPriming": false,
  "settings": { "v": 1, "gainLeft": 400, "gainRight": 400, "ledBrightness": 0 },
  "wifiStrength": 52
}
```

- `currentTemperatureLevel` is the firmware's level, -100 to 100. `currentTemperatureF` and `targetTemperatureF` are that level converted with the curve in `server/src/db/temperatureCurve.ts`.
- `measuredTemperatureF` is optional: the water temperature the bed measures on that side, to one decimal. It is present only where the Pod reports it and a recent reading exists.
- `isOn` is true when `secondsRemaining` is above 0.
- `taps` (`{"doubleTap": n, "tripleTap": n, "quadTap": n}` per side, the firmware's tap counters) is an optional field of the schema. This endpoint does not ask the firmware for it, so it is not in the response.
- `coverVersion` and `hubVersion` are `Pod 3`, `Pod 4`, `Pod 5` or `Version not found`.

### `GET /api/deviceStatus/raw`

The firmware's status reply as plain text (`text/plain`), unparsed. For debugging.

### `POST /api/deviceStatus`

Changes the Pod. Send only what should change. Returns **204** with no body.

| Field | Effect |
| --- | --- |
| `left.isOn` / `right.isOn` | `true` switches the side on for `manualOn.hours` (settings); `false` switches it off. |
| `left.targetTemperatureF` / `right.targetTemperatureF` | Number from 50 to 110. The Pod's range is 50 to 108; values above 108 are treated as the hottest setting. |
| `left.secondsRemaining` / `right.secondsRemaining` | Sets how long the side stays on, in seconds. Applied after `isOn`. |
| `left.isAlarmVibrating` / `right.isAlarmVibrating` | `false` dismisses the alarm. The firmware stops both sides; the server restarts the other side's alarm if it was still going, unless both sides began going off within a minute of each other. `true` does not start an alarm. |
| `isPriming` | `true` starts priming. |
| `settings` | Any of `v`, `gainLeft`, `gainRight`, `ledBrightness`; sent to the firmware. |

Other fields of the status are accepted and ignored. If either side is in away mode, a change sent for one side is applied to both.

```bash
curl -X POST http://<pod-ip>:3000/api/deviceStatus \
  -H 'Content-Type: application/json' \
  -d '{"left": {"isOn": true, "targetTemperatureF": 75}}'
```

```json
{ "right": { "isAlarmVibrating": false } }
```

---

## Dial

Short requests for phone shortcuts, on the stock app's scale from -10 (coldest) to +10 (hottest). One dial step is 10 firmware levels.

`side` in the bodies below is `left`, `right` or `both`. Left out, it means both. With `linkSides` on, one side means both.

### `GET /api/deviceStatus/dial`

What each side is set to and has reached, rounded to half steps, with a sentence to show or speak.

```json
{
  "summary": "Left set to +5, now at +4. Right off.",
  "left": { "isOn": true, "targetDial": 5, "currentDial": 4, "summary": "set to +5, now at +4" },
  "right": { "isOn": false, "targetDial": 0, "currentDial": 0, "summary": "off" }
}
```

When both sides have the same summary, the top-level sentence is `Both sides ...`.

### `POST /api/deviceStatus/dial`

Turns a side on at a dial setting. Body: `side` (optional) and `dial` (number, -10 to 10). No other fields.

```json
{ "side": "left", "dial": -3 }
```

Response (200):

```json
{ "sides": ["left"], "dial": -3, "targetTemperatureF": 74.12 }
```

`targetTemperatureF` is the temperature for that level, not rounded, so it can carry floating-point noise.

---

## Alarms

### `POST /api/alarm`

Starts an alarm now. It does not change the schedule.

| Field | Type |
| --- | --- |
| `side` | `left` or `right` (required) |
| `vibrationIntensity` | integer 1-100 |
| `vibrationPattern` | `rise` or `double` |
| `duration` | seconds, integer 1-1800 |
| `force` | optional boolean. Without it, nothing happens if the side is off or in away mode. |
| `turnOffAfterDismiss` | optional boolean. Switch the side off when the alarm is dismissed. |

`rampStep` is also accepted; the server uses it internally for the later stretches of a ramp-up alarm.

```json
{ "side": "left", "vibrationIntensity": 50, "vibrationPattern": "rise", "duration": 30, "force": true }
```

The response is 200 with the full schedules object (the same as `GET /api/schedules`). It is sent before the alarm has started, so it does not say whether the alarm ran.

To stop an alarm, post `isAlarmVibrating: false` to [`/api/deviceStatus`](#post-apidevicestatus).

### `POST /api/alarm/time`

Sets or moves an alarm with one short request. Send `side` (optional, as for the dial) and exactly one of `time` or `shiftMinutes`.

- `time`: a time of day, 24-hour (`06:30`) or 12-hour (`6:30 AM`), alone or inside a longer text.
- `shiftMinutes`: integer from -720 to 720.
- `days`: optional list of weekday names (`monday` ... `sunday`). Only with `time`.
- `enabled`: optional boolean, used only with `days`. Defaults to `true`.

| Body | Effect |
| --- | --- |
| `{"side": "left", "time": "06:30"}` | One-off alarm the next time the clock shows 06:30. The weekly schedule is unchanged. The scheduled alarm of that same morning is skipped if it falls before the one-off or up to 6 hours after it. |
| `{"side": "left", "shiftMinutes": 60}` | Moves the side's next alarm (a waiting one-off, else the next scheduled one) later, as a one-off. Negative moves it earlier. |
| `{"side": "left", "time": "08:00", "days": ["saturday", "sunday"]}` | Sets the weekly alarm time on those days and switches the alarm on. The rest of each alarm is kept. |
| `{"time": "08:00", "days": ["monday"], "enabled": false}` | Switches the weekly alarm off on those days. See the note below about `time`. |

Responses (200):

```json
{ "kind": "oneOff", "alarms": [{ "side": "left", "time": "06:30", "firesAt": "2026-11-18T06:30:00-08:00" }] }
```

```json
{ "kind": "weekly", "sides": ["left"], "days": ["saturday", "sunday"], "time": "08:00", "enabled": true }
```

- **409** `{"error": "No alarm in the next 24 hours that can be moved that far"}`: with `shiftMinutes`, when no side has an alarm within 24 hours, or the moved time would be in the past or more than 24 hours ahead.
- A one-off alarm is stored in settings under `<side>.scheduleOverrides.alarm`.
- A one-off alarm leaves an alarm skipped from the app skipped.
- With `days`, a time under 1 hour or over 23 hours after that night's bed-on time is refused, and nothing is changed on any day or side in the request: `400` with
  `{"error": "Invalid request data", "details": "The wake-up time must be 1 to 23 hours after the bed-on time (left monday)"}`.
  Only nights whose schedule is on are checked. `POST /api/schedules` refuses the same nights with the same body.
- A phone shortcut that does not read the response shows nothing when a request is refused; see [docs/IOS_SHORTCUTS.md](../docs/IOS_SHORTCUTS.md).
- With `days`, the off-time rule in [Schedules](#schedules) is applied to each day, so the bed's off time moves with the new time.

### `POST /api/alarm/time/cancel`

Drops a waiting one-off alarm, so the weekly schedule applies again. Body: `{"side": "left"}` (`side` optional).

```json
{ "kind": "cancelled", "sides": ["left"] }
```

---

## Settings

### `GET /api/settings`

Stored in `settingsDB.json`. The values below are the defaults, except `id` (a random UUID) and the names.

```json
{
  "id": "d07caf20-4f6a-4a9b-be8e-012989b0a65f",
  "timeZone": "UTC",
  "temperatureFormat": "fahrenheit",
  "rebootDaily": true,
  "linkSides": false,
  "swapSides": false,
  "left": {
    "name": "Left",
    "awayMode": false,
    "scheduleOverrides": {
      "temperatureSchedules": { "disabled": false, "expiresAt": "" },
      "alarm": { "disabled": false, "timeOverride": "", "expiresAt": "" }
    },
    "taps": {
      "doubleTap": { "type": "temperature", "change": "decrement", "amount": 1 },
      "tripleTap": { "type": "temperature", "change": "increment", "amount": 1 },
      "quadTap": { "type": "alarm", "behavior": "dismiss", "snoozeDuration": 60, "inactiveAlarmBehavior": "power" }
    }
  },
  "right": { "name": "Right", "awayMode": false, "scheduleOverrides": {}, "taps": {} },
  "manualOn": { "hours": 12, "overridesSchedule": false },
  "autopilot": { "enabled": false },
  "presence": {
    "sensitivity": "medium",
    "wakeAfterHours": { "enabled": false, "hours": 9 },
    "turnOnWhenInBed": { "enabled": false, "temperatureF": 81, "stayOn": "untilOutOfBed" }
  },
  "primePodDaily": { "enabled": true, "time": "14:00" }
}
```

`right` has the same shape as `left`; it is shortened here.

| Field | Values |
| --- | --- |
| `timeZone` | A name from `server/src/db/timeZones.ts`, for example `America/Los_Angeles`. |
| `temperatureFormat` | `fahrenheit`, `celsius` or `level` (the -10 to +10 scale). Display only. |
| `rebootDaily` | boolean |
| `linkSides` | When true, a temperature or power change made for one side applies to both. |
| `swapSides` | When true, EightPod's left is the firmware's right and the other way round. |
| `<side>.name` | 1-20 characters |
| `<side>.awayMode` | boolean |
| `<side>.scheduleOverrides.temperatureSchedules` | `disabled`, `expiresAt` (string) |
| `<side>.scheduleOverrides.alarm` | `disabled`, `timeOverride` (`HH:mm` of a one-off alarm, or empty), `expiresAt` |
| `<side>.taps.doubleTap` / `tripleTap` / `quadTap` | One of two shapes, picked by `type`: `{"type": "temperature", "change": "increment" \| "decrement", "amount": 0-10}` or `{"type": "alarm", "behavior": "snooze" \| "dismiss", "snoozeDuration": 60-600, "inactiveAlarmBehavior": "power" \| "none"}` |
| `manualOn.hours` | `3`, `6` or `12`: how long a side switched on by hand stays on. |
| `manualOn.overridesSchedule` | When true, the schedule leaves a side switched on by hand alone until it turns off. Alarms still go off. |
| `autopilot.enabled` | Lets the bed adjust a sleeping side's temperature (Pod 5, experimental). See [Autopilot](#autopilot). |
| `presence.sensitivity` | `low`, `medium` or `high` |
| `presence.wakeAfterHours` | `enabled`, `hours` (integer 1-14): vibrate the alarm after this long in bed in one stay. |
| `presence.turnOnWhenInBed` | `enabled`, `temperatureF` (50-110), `stayOn` (integer hours 1-12, or `"untilOutOfBed"`) |
| `primePodDaily` | `enabled`, `time` (`HH:mm`) |

### `POST /api/settings`

Merges the body into the stored settings and returns the full settings (200). `id` in the body is ignored. A complete tap config replaces the stored one as a whole; send all fields for its `type`.

```json
{ "linkSides": true, "left": { "awayMode": true } }
```

Writing settings makes the server cancel and recreate its scheduled jobs.

---

## Schedules

### `GET /api/schedules`

Stored in `schedulesDB.json`: `left` and `right`, each with `sunday` to `saturday`. One day:

```json
{
  "left": {
    "monday": {
      "temperatures": { "23:00": 70, "03:00": 74 },
      "power": { "on": "21:00", "off": "07:30", "onTemperature": 82, "enabled": true },
      "alarm": {
        "time": "07:00",
        "enabled": true,
        "vibrationIntensity": 100,
        "vibrationPattern": "rise",
        "duration": 600,
        "alarmTemperature": 82,
        "preWarmMinutes": 15,
        "turnOffAfterDismiss": false
      }
    }
  }
}
```

| Field | Values |
| --- | --- |
| `temperatures` | Map of `HH:mm` to °F (integer 50-110). |
| `power.on`, `power.off` | `HH:mm` |
| `power.onTemperature` | °F, integer 50-110 |
| `power.enabled` | boolean |
| `alarm.time` | `HH:mm`. The wake-up time, whether or not the alarm is enabled. |
| `alarm.enabled` | boolean |
| `alarm.vibrationIntensity` | integer 1-100 |
| `alarm.vibrationPattern` | `rise` or `double` |
| `alarm.duration` | seconds, integer 1-1800 |
| `alarm.alarmTemperature` | °F, integer 50-110 |
| `alarm.preWarmMinutes` | optional, integer 0-60. Minutes before the alarm to start warming to `alarmTemperature`. 0 or missing: no warm-up. |
| `alarm.turnOffAfterDismiss` | optional boolean |

### `POST /api/schedules`

Send any subset of sides, days and fields. Returns the full schedules (200). For each day in the body:

- `power` and `alarm` are merged into the stored values, so fields left out are kept.
- `temperatures` replaces the stored map as a whole.
- Then the off-time rule runs on that day (`server/src/db/automaticOffTime.ts`):
  `power.off` is set to `alarm.time` plus 30 minutes, whether the alarm is enabled or not. `alarm.time` is the
  night's wake-up time; `alarm.enabled` only decides whether it vibrates. A posted `off` is overwritten.

In short, do not set `power.off`; set `alarm.time`. Times wrap past midnight.

```json
{ "left": { "monday": { "alarm": { "time": "06:45", "enabled": true } } } }
```

After this request, Monday's `power.off` is `07:15`.

Writing schedules makes the server cancel and recreate its scheduled jobs.

---

## Execute

### `POST /api/execute`

Sends one command straight to the firmware. Body: `command` and an optional string `arg`.

```json
{ "command": "TEMP_LEVEL_LEFT", "arg": "-20" }
```

```json
{ "success": true, "message": "Command 'TEMP_LEVEL_LEFT' executed successfully." }
```

Allowed commands (`server/src/8sleep/deviceApi.ts`): `HELLO`, `SET_TEMP`, `SET_ALARM`, `ALARM_LEFT`, `ALARM_RIGHT`, `SET_SETTINGS`, `LEFT_TEMP_DURATION`, `RIGHT_TEMP_DURATION`, `TEMP_LEVEL_LEFT`, `TEMP_LEVEL_RIGHT`, `PRIME`, `DEVICE_STATUS`, `ALARM_CLEAR`.

- Any other command gets 400 with the text `Invalid command`.
- `arg` is not validated. The server itself sends a firmware level (-100 to 100) to `TEMP_LEVEL_*`, seconds to `*_TEMP_DURATION`, and hex-encoded CBOR to `ALARM_*` and `SET_SETTINGS`.
- With `swapSides` on, the side-specific commands are swapped before sending: `TEMP_LEVEL_LEFT` goes out as `TEMP_LEVEL_RIGHT`, and the same for `*_TEMP_DURATION` and `ALARM_*`. The response message names the command as posted.
- The firmware's reply is not returned.

---

## Jobs

### `POST /api/jobs`

Starts jobs now. The body is a JSON array of job names. Returns **204** without waiting for them to finish.

| Name | What it runs |
| --- | --- |
| `analyzeSleepLeft`, `analyzeSleepRight` | Sleep analysis over the last 12 hours for that side. |
| `biometricsCalibrationLeft`, `biometricsCalibrationRight` | Sensor calibration over the last 2 hours for that side. |
| `reboot` | Reboots the Pod. |
| `update` | Starts `free-sleep-update.service`, which updates EightPod. |

```json
["analyzeSleepLeft"]
```

---

## Services

### `GET /api/services`

Reads which optional services are enabled, and the health of the biometrics jobs. Stored in `servicesDB.json`.

```json
{
  "sentryLogging": { "enabled": false },
  "biometrics": {
    "enabled": true,
    "jobs": {
      "installation": {
        "name": "Biometrics installation",
        "message": "",
        "status": "healthy",
        "description": "Whether or not biometrics was installed successfully",
        "timestamp": ""
      }
    }
  }
}
```

`jobs` has six entries of the same shape: `installation`, `stream`, `analyzeSleepLeft`, `analyzeSleepRight`, `calibrateLeft`, `calibrateRight`. `status` is one of `failed`, `healthy`, `not_started`, `restarting`, `retrying`, `started`.

### `POST /api/services`

Merges the body into the stored services and returns the result (200).

```json
{ "biometrics": { "enabled": true } }
```

`sentryLogging.enabled` switches error reporting on or off. EightPod has no built-in destination: nothing is sent unless `SENTRY_DSN` is set in the server's environment (`server/src/instrument.ts`).

---

## Server status

### `GET /api/serverStatus`

Health of the server's parts. Every entry has `name`, `status`, `description`, `message`, and optionally `timestamp`. `status` takes the same values as in [Services](#services).

```json
{
  "alarmSchedule": { "name": "Alarm schedule", "status": "healthy", "description": "", "message": "" },
  "database": { "name": "Database", "status": "healthy", "description": "Connection to SQLite DB", "message": "" },
  "franken": { "name": "Franken sock", "status": "healthy", "description": "Socket service for controlling the hardware", "message": "" }
}
```

Keys always present: `alarmSchedule`, `database`, `express`, `franken`, `frankenMonitor`, `jobs`, `logger`, `powerSchedule`, `primeSchedule`, `rebootSchedule`, `systemDate`, `temperatureSchedule`.

Keys taken from the services data: `biometricsInstallation` always; `analyzeSleepLeft`, `analyzeSleepRight`, `biometricsCalibrationLeft`, `biometricsCalibrationRight` and `biometricsStream` only while biometrics is enabled. `biometricsStream` is reported as `failed` when its last timestamp is 5 minutes old or more.

---

## Logs

### `GET /api/logs`

Names of the files ending in `log` in `/persistent/free-sleep-data/logs` and `/var/log`, newest first.

```json
{ "logs": ["free-sleep.log"] }
```

### `GET /api/logs/:filename`

A server-sent event stream (`text/event-stream`), not JSON. The first event carries the last 1000 lines of the file. While the connection is open, another event with the last 1000 lines is sent when the file grows.

```
data: {"message": "line 1\nline 2"}
```

If the file is in neither folder, the stream sends one event, `{"message": "Log file not found"}`, and ends. The status is still 200.

---

## Metrics

Biometrics data from the SQLite database. The three list endpoints and the summary take the same optional query parameters:

- `side`: `left` or `right`
- `startTime`, `endTime`: date-times, ISO 8601

Timestamps in responses are ISO 8601 strings in the settings time zone. Results are ordered oldest first.

```bash
curl 'http://<pod-ip>:3000/api/metrics/vitals?side=left&startTime=2026-11-16T20:00:00Z'
```

### `GET /api/metrics/sleep`

Sleep records that overlap the range: `left_bed_at` at or after `startTime` and `entered_bed_at` at or before `endTime`.

```json
[
  {
    "id": 1,
    "side": "left",
    "entered_bed_at": "2026-11-16T22:00:00-08:00",
    "left_bed_at": "2026-11-17T06:00:00-08:00",
    "sleep_period_seconds": 28800,
    "times_exited_bed": 1,
    "present_intervals": [["2026-11-16T22:00:00-08:00", "2026-11-17T03:10:00-08:00"]],
    "not_present_intervals": [["2026-11-17T03:10:00-08:00", "2026-11-17T03:14:00-08:00"]]
  }
]
```

### `PUT /api/metrics/sleep/:id`

Edits a sleep record. The body is any subset of the record's fields; `entered_bed_at` and `left_bed_at` must be ISO 8601 date-times in UTC (ending in `Z`). When both are sent, `sleep_period_seconds` and `times_exited_bed` are recalculated. Returns the updated record (200).

```json
{ "entered_bed_at": "2026-11-17T06:30:00Z", "left_bed_at": "2026-11-17T14:00:00Z" }
```

Errors: 400 `{"error": "Invalid ID"}`, 404 `{"error": "Sleep record not found"}`, 400 `{"error": "Invalid request body", "details": {...}}`.

### `DELETE /api/metrics/sleep/:id`

Deletes a sleep record. Returns **204**.

### `GET /api/metrics/vitals`

```json
[
  { "id": 1, "side": "left", "timestamp": "2026-11-16T22:00:00-08:00", "heart_rate": 58, "hrv": 42, "breathing_rate": 14 }
]
```

Each row covers a 5-minute interval. `heart_rate`, `hrv` and `breathing_rate` can be `null`.

### `GET /api/metrics/vitals/summary`

```json
{ "avgHeartRate": 58, "minHeartRate": 49, "maxHeartRate": 71, "avgHRV": 52, "avgBreathingRate": 14 }
```

Values are rounded, and 0 when there is no data. The HRV average uses only rows with HRV from 30 to 120; the breathing average only rows from 5 to 20.

### `GET /api/metrics/movement`

```json
[
  { "id": 1, "side": "left", "timestamp": "2026-11-16T22:00:00-08:00", "total_movement": 37 }
]
```

---

## Presence

There are two unrelated things under `/api/metrics/presence`.

### `GET /api/metrics/presence/sensors`

What the bed's own presence sensors say now (Pod 5). The settings that act on this are under `presence` in [Settings](#settings).

```json
{
  "available": true,
  "left": { "present": true, "signal": 4310, "baseline": 3890, "changedAt": "2026-11-17T22:41:07.000Z" },
  "right": { "present": false, "signal": 3955, "baseline": 3950, "changedAt": "2026-11-17T21:02:11.000Z" }
}
```

- `available` is false until the sensors have reported, and again when no reading has arrived for 30 seconds. On a Pod that does not report the sensors it stays false.
- `left` and `right` are missing until that side has a reading.
- `signal` is the smoothed sum of the side's three zones; `baseline` is the level taken as an empty bed.
- A side that only picks up the person on the other side is reported with `present: false`.

### `POST /api/metrics/presence/sensors/empty`

Says the bed is empty right now. In-bed detection forgets what it learned and takes the next
readings as the empty bed. No body. Returns 204, or 503 when the sensors are not running.

### `GET /api/metrics/presence`

A value held in memory that an external process sets with the POST below. It is not derived from the bed's sensors and has nothing to do with `/api/metrics/presence/sensors`. It resets to `present: false` when the server restarts.

```json
{
  "left": { "present": false, "lastUpdatedAt": "2026-11-17T00:12:34-08:00" },
  "right": { "present": true, "lastUpdatedAt": "2026-11-17T00:12:34-08:00" }
}
```

### `POST /api/metrics/presence`

Sets that value for one or both sides. `lastUpdatedAt` is set by the server; a value in the body is ignored. Returns the full value (200).

```json
{ "left": { "present": true } }
```

A body with neither `left` nor `right` gets 400 `{"error": "At least one side (left or right) must be specified", "message": "..."}`.

## Autopilot

Pod 5 only, experimental. Switch it on with `POST /api/settings` and `{ "autopilot": { "enabled": true } }`.
[docs/AUTOPILOT.md](../docs/AUTOPILOT.md) says what it does.

### `GET /api/autopilot`

What the autopilot reads and has done. Sleep is followed whether or not it is switched on; the
temperature is only changed when it is.

```json
{
  "available": true,
  "enabled": true,
  "room": { "temperatureF": 68, "humidityPercent": 46 },
  "left": {
    "stage": "asleep",
    "heartRate": 54,
    "minutesAsleep": 62,
    "offsetF": -3,
    "lastChange": "12:40 AM: 3°F cooler (time of night, first sleep cycle)",
    "sleepKind": "night",
    "learned": { "early": -0.5, "middle": 0, "late": 0 },
    "rules": { "stillMinutesToSleep": 10, "restlessSecondsToWake": 20 },
    "tracker": { "source": "Apple Health", "syncedAt": "2026-11-18T15:02:11.000Z", "nights": 6, "onsetErrorMinutes": 7, "wakeErrorMinutes": 4 }
  },
  "right": { "stage": "out", "learned": { "early": 0, "middle": 0, "late": 0 }, "rules": { "stillMinutesToSleep": 15, "restlessSecondsToWake": 12 } }
}
```

| Field | Meaning |
|---|---|
| `available` | `false` when the piezo sensor has sent nothing in the last 2 minutes (other Pods) |
| `room` | The air at the cover. Read as hundredths of a degree; not checked against a thermometer |
| `stage` | `out`, `awake` or `asleep` |
| `sleepKind` | While asleep: `night` when the autopilot is treating it as the night's sleep, `nap` when it is leaving it alone (it began at an hour that looks like a nap and has not yet lasted 3 hours) |
| `breathingRate` | Breaths a minute over the last 5 minutes; missing when no reading could be trusted |
| `heartRate` | Beats a minute over the last 5 minutes; missing when no reading could be trusted. Shown only: sleep is judged from stillness |
| `rules` | The sleep rules in use: still minutes before "asleep", moving seconds that make a minute restless, and `maxBreathingSpread` when calibration has found that asking for steady breathing helps |
| `tracker` | The last sleep tracker to report on this side, and how far the bed's sleep and wake times are from its, in minutes |
| `offsetF` | How far the side is from its set temperature because of the autopilot |
| `learned` | What your changes have taught it for each third of the night, in °F |

### `POST /api/autopilot/sleepTimes`

Sleep and wake times from a watch or band, sent by a phone shortcut or a script. Each sleep is
filed with the saved stay in bed it overlaps, and the side's `rules` are fitted again (once 3
nights have tracker times). Send the two times, or a health app's raw samples:

| Field | Type |
| --- | --- |
| `side` | `left` or `right` (required) |
| `source` | optional name, up to 40 characters: `"Apple Health"`, `"Whoop"` |
| `asleepAt`, `awakeAt` | date and time with an offset, such as `2026-11-18T23:12:00-08:00` |
| `samples` | in place of the two times: up to 2000 of `{ "start", "end", "value" }`. Samples whose value says awake or in bed are left out, and the rest are joined into sleeps (a gap over an hour starts a new one) |

```json
{ "side": "left", "source": "Whoop", "asleepAt": "2026-11-18T23:12:00-08:00", "awakeAt": "2026-11-19T06:48:00-08:00" }
```

`side` and `source` may be given in the address instead (`?side=left`), for an app that cannot
shape its own request. The body the iPhone app Health Auto Export posts is read as it is
(`data.metrics` with a `sleep_analysis` entry, one row a night or sample by sample); that was
written from the app's documentation and has not been run against the app.

The response says how many sleeps were read, how many matched a saved stay, and the rules now in
use. 400 when the body is not valid or holds no sleep.

### `GET /api/autopilot/nights`

The saved stays in bed, newest first, without their minute rows: `side`, `startedAtMs`,
`minutesLogged`, `kind` (`nap` for a sleep under 3 hours, else `night`), the bed's `asleepAtMs`
and `awakeAtMs`, the middle `heartRate` and `breathingRate` of the asleep minutes, and `tracker`
when times were sent. `?limit=` takes 1 to 60 (default 14).

### `GET /api/autopilot/nights/export`

Everything saved, as a JSON file to download: every night with its minute rows, the sleep rules,
what was learned from corrections, and the tracker links. The newest 180 stays are kept on the
Pod in `/persistent/free-sleep-data/autopilot_nights/`.
