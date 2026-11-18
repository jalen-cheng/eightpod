# Free Pod — your Eight Sleep Pod, on your own network

<p align="center">
  <img src="docs/screenshots/overview.png" width="900" alt="Four phone screens: the temperature dial, a night's schedule, alarm options and in-bed detection">
</p>

<p align="center">
  <a href="CHANGELOG.md"><img src="https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fraw.githubusercontent.com%2Fjalen-cheng%2Ffree-sleep%2Fmain%2Fserver%2Fsrc%2FserverInfo.json&query=%24.version&label=version&style=flat-square" alt="Version"></a>
  <a href="https://freepod.vercel.app"><img src="https://img.shields.io/badge/demo-live-brightgreen?style=flat-square" alt="Live demo"></a>
  <a href="docs/POD_MODELS.md"><img src="https://img.shields.io/badge/tested%20on-Pod%205-blue?style=flat-square" alt="Tested on Pod 5"></a>
  <a href="https://github.com/jalen-cheng/free-sleep/pulls"><img src="https://img.shields.io/badge/PRs-welcome-brightgreen?style=flat-square" alt="Pull requests welcome"></a>
</p>

Free Pod controls an Eight Sleep Pod from your own network. Each Pod has a small Linux computer
inside; Free Pod installs a server on it that talks to the Pod's firmware and serves a web app
you open on your phone: temperature, a schedule for each night, a vibrating alarm, the Pod 5's
side buttons, in-bed detection and iPhone Shortcuts.

**Local, with no catch.** No cloud, no account and no subscription. The Pod is blocked from the
internet, so nothing is sent to Eight Sleep or anyone else, and the bed keeps working when your
internet does not. Free Pod builds on [Free Sleep](https://github.com/throwaway31265/free-sleep)
by throwaway31265 and its contributors, and was developed and tested on one Pod 5.

[Demo](https://freepod.vercel.app) · [Install](INSTALLATION.md) · [Using the app](docs/USING.md) · [How it works](docs/HOW_IT_WORKS.md) · [Shortcuts](docs/IOS_SHORTCUTS.md) · [API](server/API.md) · [Changelog](CHANGELOG.md)

## Install

You need a Pod 3, 4 or 5, a USB serial adapter (about $10) and around an hour. The one hands-on
step is opening the Pod's hub and attaching the adapter to get a root shell; the
[install guide](INSTALLATION.md) has photos for each Pod. Then, on the Pod:

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/jalen-cheng/free-sleep/main/scripts/install.sh)"
```

Already running Free Sleep? Run the same command over SSH. Settings and schedules are kept;
[what changes](docs/POD_MODELS.md).

## Quick start

1. Open `http://bed.local` on a phone on the same Wi-Fi. The installer names the Pod `bed`.
2. In **Settings**, set your time zone. Until you do, every scheduled time is off by hours.
3. In **Schedules**, set when the bed turns on, the temperatures through the night and when you wake.
4. Block the Pod from the internet (step 16 of the install guide), then close the hub.

No Pod yet? **[freepod.vercel.app](https://freepod.vercel.app)** is the app on made-up data.

## How it fits together

- The **firmware** is Eight Sleep's own program. It runs the pumps, heaters and vibration motors, and is left as it is.
- The **server** (`server/`) takes the place of Eight Sleep's cloud: it tells the firmware what to do, runs the schedule and alarms, and reads the buttons and the bed's sensors.
- The **app** (`app/`) is a web page the server serves. Add it to your phone's home screen and it behaves like an app.
- **Shortcuts and automations** use the same [local API](server/API.md) the app does.
- Away from home, optional **[Tailscale on the Pod](docs/REMOTE_ACCESS.md)** reaches it privately, with the internet block still on.

[HOW_IT_WORKS.md](docs/HOW_IT_WORKS.md) explains every part and how they interact.

## What it changes

Free Sleep is what makes any of this possible. On the test Pod 5 it fell short in ways that add
up to most of this project:

| Area | Free Sleep | Free Pod |
|---|---|---|
| **Pod 5 side buttons** | Do nothing | + and - change the temperature and switch an off side on. Holding the middle button two seconds switches the side on or off. Any button stops an alarm |
| **Temperatures** | Levels spread evenly over 55 to 110°F | What the firmware aims for at each level, measured on a Pod 5: 50 to 108°F. The page also shows the temperature the bed measures |
| **Display units** | °F or °C | °F, °C, or the -10 to +10 scale of Eight Sleep's app |
| **Both sides at once** | Each side set separately | Link the sides: temperature, power, schedules, buttons and shortcuts apply to both |
| **A night's schedule** | Power on and off times, temperature changes and an alarm, set separately | Bed-on time, temperature changes and a wake-up time, as one list with a tab per day. No off time: the bed turns off 30 minutes after wake-up |
| **Alarm length** | Up to 3 minutes | Until dismissed, for 10 to 30 minutes |
| **Alarm ramp-up** | The firmware's "rise" pattern, which on a Pod 5 is one steady strength | On a Pod 5, a real ramp: 20, 40, 60, 80% of the chosen strength, then full |
| **Before the alarm** | Nothing | Optional warm-up to a chosen temperature 15, 30 or 45 minutes before |
| **After the alarm** | Bed stays on until its off time | Bed turns off 30 minutes after the wake-up time, or the moment the alarm is dismissed |
| **One-time alarm** | Overrides tonight's alarm | Set in the app or by one request. Replaces that morning's alarm, goes off even if the bed is off, and the bed stays on for it |
| **Two sleepers' alarms** | Dismissing one stops both, so the other is lost | Linked sides stop together; otherwise the other side's alarm starts again |
| **In-bed detection** (Pod 5) | None | Knows when someone is in bed. Optionally turns the bed on when you get in, and vibrates after a long stay |
| **Turning on by hand** | Stays on 12 hours | 3, 6 or 12 hours, and can ignore the schedule meanwhile |
| **Left and right** | As the firmware has them | Can be flipped in Settings |
| **iPhone Shortcuts** | Possible with the general API | Short requests: set by -10..+10, set an alarm by time ("6:30 AM" works), read the bed in one sentence |
| **Opening by name** | Blank page under any name | `http://bed.local` at home and `http://bed` with Tailscale, with no port to remember |
| **Internet block** | Also blocks DNS, which can stop the clock syncing | DNS, address requests and time sync keep working; restored at every boot; Eight Sleep's updater can be locked out |
| **Remote access** | None | Optional Tailscale on the Pod, set up by one script, with the block still on |
| **Updates** | From the original project | From this fork; the app shows when a newer version exists |
| **Housekeeping** | Daily priming off by default; daily reboot only while priming is on | Daily priming on at 2 PM by default; the daily reboot has its own switch |

Smaller changes: temperature controls respond at once instead of locking after every press; the
power button waits for the Pod's real state; alarm options has a one-minute test; a schedule can be
saved for one day or any set of days; snooze was removed (the original stored the setting and never
acted on it).

Fixes offered back to the original project, each small and standing on its own:
[#67](https://github.com/throwaway31265/free-sleep/pull/67),
[#68](https://github.com/throwaway31265/free-sleep/pull/68),
[#69](https://github.com/throwaway31265/free-sleep/pull/69),
[#70](https://github.com/throwaway31265/free-sleep/pull/70),
[#72](https://github.com/throwaway31265/free-sleep/pull/72),
[#73](https://github.com/throwaway31265/free-sleep/pull/73),
[#74](https://github.com/throwaway31265/free-sleep/pull/74).

## Security

- **The app has no login.** Anyone on your home network can open it. Never put it on the open internet; use [Tailscale](docs/REMOTE_ACCESS.md) to reach it from elsewhere.
- **The internet block** stops the Pod reaching Eight Sleep or anything else, and is restored at every boot. Free Pod has no error-reporting destination built in.
- **You need root on the Pod once**, through a serial adapter. It is not supported by Eight Sleep and may affect your warranty. A Pod 3 or 4 can be put back with a firmware reset; a reset procedure for a Pod 5 is not documented here.

## Which Pods

| Pod | Status |
|---|---|
| Pod 5 | Tested on one unit. Some newer units cannot be opened up the way the install guide needs; the guide says how to tell. |
| Pod 4 | Same code as the original project in the hardware paths, with the differences in [docs/POD_MODELS.md](docs/POD_MODELS.md). **Not run on a Pod 4.** |
| Pod 3 (with or without SD card) | As Pod 4: reviewed against the original, **not run**. |
| Pod 1, Pod 2 | Not compatible. |

## Status

On the test Pod 5: install and update, temperature and power, the measured temperature curve,
schedules, alarms with the stepped ramp, one-time alarms and the bed staying on for them, buttons,
linked sides, shortcuts, the internet block, the `.local` name, Tailscale on the Pod (from a phone
on cellular), in-bed detection and the bed turning on when someone gets in.

Not yet seen working on a Pod: the bed turning off after someone gets out, the long-stay alarm,
"ignore the schedule" after turning on by hand, and flipping left and right. Nothing has been run
on a Pod 3 or Pod 4. [CHANGELOG.md](CHANGELOG.md) keeps the full list.

**Biometrics are untested.** Sleep tracking, heart rate and the other measurements on the Data
page are Free Sleep's code, unchanged, and off unless you enable them. They produced nothing on
the test Pod 5 and were not looked into further.

## Documentation

| Goal | Start here |
|---|---|
| Install it on a Pod | [INSTALLATION.md](INSTALLATION.md) |
| Use the app: a night, alarms, settings | [docs/USING.md](docs/USING.md) |
| Know what works on a Pod 3 or Pod 4 | [docs/POD_MODELS.md](docs/POD_MODELS.md) |
| Keep the address stable, or reach the Pod away from home | [docs/REMOTE_ACCESS.md](docs/REMOTE_ACCESS.md) |
| Control the bed from iPhone Shortcuts | [docs/IOS_SHORTCUTS.md](docs/IOS_SHORTCUTS.md) |
| Understand every part and how they interact | [docs/HOW_IT_WORKS.md](docs/HOW_IT_WORKS.md) |
| Use the API | [server/API.md](server/API.md) |
| See what changed and what was tested | [CHANGELOG.md](CHANGELOG.md) |

## Development

```bash
git clone https://github.com/jalen-cheng/free-sleep.git
cd free-sleep/app && npm install && VITE_ENV=demo VITE_USE_MSW=true npx vite
```

That runs the app on made-up data, with no Pod. Running against a Pod, the checks and how
releases work are in [DEVELOPING.md](DEVELOPING.md). The folders, services and commands on the Pod
keep the name `free-sleep`, so an existing install updates in place.

## Contributing

Issues and pull requests are welcome on [this repository](https://github.com/jalen-cheng/free-sleep).
Most useful: reports from a Pod 3 or Pod 4, and anything that gets biometrics working.

## Credits

Free Pod exists because of Free Sleep. Its community, support and donations are its author's:

- **[throwaway31265/free-sleep](https://github.com/throwaway31265/free-sleep)**, the original project, with its Discord server linked from its README. To support the original author, use the donation links there.
- [@bobobo1618](https://github.com/bobobo1618), for the research into how the Pod is controlled through `dac.sock`.
- The original's error monitoring is sponsored by Sentry. Free Pod does not use it.

## License

See [LICENSE.md](LICENSE.md).
