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
you open on your phone.

It started as a fork of [Free Sleep](https://github.com/throwaway31265/free-sleep) by
throwaway31265 and its contributors, and grew into a rework: the Pod 5's side buttons, calibrated
temperatures, in-bed detection, a redesigned app, a schedule built around one night at a time,
alarms that run until you dismiss them, and an address you can remember (`http://bed.local`). It
was developed and tested on one Pod 5.

**Local, with no catch.** No cloud, no account and no subscription. The Pod is blocked from the
internet, so nothing is sent to Eight Sleep or anyone else, and the bed keeps working when your
internet does not.

[Demo](https://freepod.vercel.app) · [Install](INSTALLATION.md) · [Using the app](docs/USING.md) · [How it works](docs/HOW_IT_WORKS.md) · [Shortcuts](docs/IOS_SHORTCUTS.md) · [API](server/API.md) · [Changelog](CHANGELOG.md)

## Install

You need a Pod 3, 4 or 5, about two hours, and $20 to $70 of parts: a USB serial adapter, plus
either a tag-connect cable or three soldered wires. The one hands-on step is opening the Pod's hub
and attaching the adapter to get a root shell; the [install guide](INSTALLATION.md) has photos for
each Pod. Then, on the Pod:

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/jalen-cheng/free-sleep/main/scripts/install.sh)"
```

Already running Free Sleep? Over SSH, lift its internet block, run the same installer, and block
again. Settings and schedules are kept:

```bash
sh /home/dac/free-sleep/scripts/unblock_internet_access.sh
```
```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/jalen-cheng/free-sleep/main/scripts/install.sh)"
```
```bash
sh /home/dac/free-sleep/scripts/block_internet_access.sh
```

Read [what changes](docs/POD_MODELS.md) first.

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

**The big ones**

- **Pod 5 side buttons work.** + and - change the temperature, holding the middle button switches the side on or off, and any button stops an alarm.
- **Temperatures are calibrated.** The number shown is what the firmware aims for at each level, measured on a Pod 5, and the page also shows the temperature the bed measures. Units are °F, °C, or the -10 to +10 scale of Eight Sleep's app.
- **In-bed detection (Pod 5).** The bed knows when someone is in it, and can turn itself on when you get in and off after you get out, or vibrate after a long stay.
- **Networking.** The app opens at `http://bed.local`, with no IP address or port to remember. The internet block keeps the clock and name lookups working and is restored at every boot. Optional Tailscale reaches the Pod from anywhere with the block still on.

**The app**

- **A new look.** Dark grey, one typeface and text size, a dial with the bed's real temperature under the target, and layouts made for a phone first.
- **A night is one list.** Bed on, temperature changes and wake time on one screen with a tab per day and a chart of the night. Save a night for one day or any set of days.
- **No off time to manage.** The bed turns off 30 minutes after the wake time, or the moment you dismiss the alarm if you choose.
- **Less text.** Explanations sit behind an "i" instead of under every control, and one button opens everything about the alarm.
- **Status at a glance.** Wi-Fi strength, whether an update is out, and each internal service on one page.

**Alarms and two sleepers**

- **Alarms that wake you.** They run until dismissed (10 to 30 minutes) with a real ramp-up on a Pod 5, an optional warm-up beforehand, and a one-minute test.
- **One-time alarm.** Change tomorrow's alarm without touching the schedule; it goes off even if the bed is off.
- **Linked sides.** Control the whole bed at once: temperature, power, schedules, buttons and shortcuts. Unlinked, dismissing one alarm no longer cancels the other.

**Quality of life**

- **iPhone Shortcuts.** One request sets the temperature, sets an alarm by time ("6:30 AM" works), or reads the bed in a sentence.
- **Turning on by hand** lasts 3, 6 or 12 hours, and can ignore the schedule meanwhile.
- **Updates from the app.** It shows when a newer version exists and updates in about four minutes, putting the old version back if anything fails.
- **Housekeeping.** Daily priming is on by default at 2 PM, the daily reboot has its own switch, left and right can be flipped, and Eight Sleep's updater can be locked out.
- **Controls respond at once** instead of locking after every press, and the power button waits for the Pod's real state.

The full comparison with Free Sleep is in [CHANGELOG.md](CHANGELOG.md#compared-with-free-sleep).

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
| Help test or contribute | [CONTRIBUTING.md](CONTRIBUTING.md) |

## Development

```bash
git clone https://github.com/jalen-cheng/free-sleep.git
cd free-sleep/app && npm install && VITE_ENV=demo VITE_USE_MSW=true npx vite
```

That runs the app on made-up data, with no Pod. Running against a Pod, the checks and how
releases work are in [DEVELOPING.md](DEVELOPING.md). The folders, services and commands on the Pod
keep the name `free-sleep`, so an existing install updates in place.

## Contributing

Issues and pull requests are welcome. The most useful contribution is a report from hardware Free
Pod has not seen: a Pod 3 or Pod 4, or a newer Pod 5. [CONTRIBUTING.md](CONTRIBUTING.md) says how,
and issues labelled [needs testing](https://github.com/jalen-cheng/free-sleep/issues?q=is%3Aissue+is%3Aopen+label%3A%22needs+testing%22)
list what is waiting to be checked.

## Credits

Free Pod exists because of Free Sleep. Its community, support and donations are its author's:

- **[throwaway31265/free-sleep](https://github.com/throwaway31265/free-sleep)**, the original project, with its Discord server linked from its README. To support the original author, use the donation links there.
- [@bobobo1618](https://github.com/bobobo1618), for the research into how the Pod is controlled through `dac.sock`.
- The original's error monitoring is sponsored by Sentry. Free Pod does not use it.

## License

See [LICENSE.md](LICENSE.md).
