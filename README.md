# SevenSleep — subscription-free, open-source local control for Eight Sleep Pods

<p align="center">
  <img src="docs/screenshots/overview.png" width="900" alt="Four phone screens: the temperature dial, a night's schedule, last night's sleep, and the in-bed detection and autopilot settings">
</p>

<p align="center">
  <a href="CHANGELOG.md"><img src="https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fraw.githubusercontent.com%2Fjalen-cheng%2Fsevensleep%2Fmain%2Fserver%2Fsrc%2FserverInfo.json&query=%24.version&label=version&style=flat-square" alt="Version"></a>
  <a href="https://github.com/jalen-cheng/sevensleep/actions/workflows/ci.yaml"><img src="https://img.shields.io/github/actions/workflow/status/jalen-cheng/sevensleep/ci.yaml?branch=main&label=tests&style=flat-square" alt="Tests"></a>
  <a href="LICENSE.md"><img src="https://img.shields.io/badge/license-MIT-blue?style=flat-square" alt="MIT license"></a>
  <a href="https://sevensleep.vercel.app"><img src="https://img.shields.io/badge/demo-live-brightgreen?style=flat-square" alt="Live demo"></a>
  <a href="#compatibility"><img src="https://img.shields.io/badge/tested%20on-Pod%205-blue?style=flat-square" alt="Tested on Pod 5"></a>
  <a href="DEVELOPING.md"><img src="https://img.shields.io/badge/node-24-339933?style=flat-square&logo=nodedotjs&logoColor=white" alt="Node 24"></a>
</p>

SevenSleep controls an Eight Sleep Pod from your own network. Each Pod has a small Linux computer
inside; SevenSleep installs a server on it that talks to the Pod's firmware and serves a web app
you open on your phone.

SevenSleep is an independent project. It is not affiliated with, endorsed by or supported by
Eight Sleep; "Eight Sleep" and "Pod" are that company's names for its products, used here only
to say what this software runs on.

**No cloud, no subscription.** The server runs on the Pod itself: no account, nothing sent to
Eight Sleep or anyone else, and the Pod is blocked from the internet. Other tools for the Pod,
such as [eightctl](https://github.com/steipete/eightctl) and the Home Assistant integrations, are
remote controls for Eight Sleep's cloud, so they stop when it does. When AWS went down on 20
October 2025, Eight Sleep's cloud went with it and Pods were left stuck at their last setting,
some of them heating ([PCWorld](https://www.pcworld.com/article/2948826/these-smart-beds-began-roasting-their-owners-during-aws-outage.html)).
A Pod running SevenSleep has nothing upstream to go down.

**If sleep metrics matter to you, the real thing may suit you better.** SevenSleep controls the
bed. Sleep stages, heart rate and Autopilot are Eight Sleep's, and SevenSleep's own sleep tracking
does not work on a Pod 5. If you want those, Eight Sleep's app and plan (from $199 a year) are
the way to get them.

It started as a fork of [Free Sleep](https://github.com/throwaway31265/free-sleep) and was developed and tested on one Pod 5.

<table>
  <tr>
    <td align="center" width="130"><a href="https://sevensleep.vercel.app">Demo</a></td>
    <td align="center" width="130"><a href="INSTALLATION.md">Install</a></td>
    <td align="center" width="130"><a href="docs/USING.md">Usage</a></td>
    <td align="center" width="130"><a href="https://jalen-cheng.github.io/sevensleep/">Docs</a></td>
    <td align="center" width="130"><a href="docs/IOS_SHORTCUTS.md">Shortcuts</a></td>
    <td align="center" width="130"><a href="server/API.md">API</a></td>
    <td align="center" width="130"><a href="#faq">FAQ</a></td>
    <td align="center" width="130"><a href="CHANGELOG.md">Changelog</a></td>
  </tr>
</table>

## Install

You need a Pod 3, 4 or 5, about two hours, and $20 to $70 of parts: a USB serial adapter, plus
either a tag-connect cable or three soldered wires. Adhesive strips are optional, for sticking the
hub's rubber feet back on afterwards. The one hands-on step is opening the Pod's hub
and attaching the adapter to get a root shell; the [install guide](INSTALLATION.md) has photos for
each Pod. Then, on the Pod:

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/jalen-cheng/sevensleep/main/scripts/install.sh)"
```

P.S. If you are in San Francisco and want to borrow the cable and adapter I used for my install,
I am happy to lend them out :) Open an [issue](https://github.com/jalen-cheng/sevensleep/issues) to ask.

### Already running Free Sleep

No cable and no opening the hub. Over SSH, lift the internet block, run the same installer, and
block again. Settings and schedules are kept, and going back is one command:

```bash
sh /home/dac/free-sleep/scripts/unblock_internet_access.sh
```
```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/jalen-cheng/sevensleep/main/scripts/install.sh)"
```
```bash
sh /home/dac/free-sleep/scripts/block_internet_access.sh
```

Read [what changes](docs/POD_MODELS.md#things-to-know-before-updating-from-the-original) first; the
[install guide](INSTALLATION.md#coming-from-free-sleep) has the same steps with checks.

## Quick start

1. Open `http://sevensleep.local` on a phone on the same Wi-Fi. The installer names the Pod `sevensleep`. If it
   does not load (some Android phones and Linux computers do not look up `.local` names), use
   `http://<pod-ip>:3000`.
2. In **Settings**, set your time zone. Until you do, every scheduled time is off by hours.
3. In **Schedules**, set when the bed turns on, the temperatures through the night and when you wake.
4. Block the Pod from the internet (step 16 of the install guide), then close the hub.

No Pod yet? **[sevensleep.vercel.app](https://sevensleep.vercel.app)** is the app on made-up data.

## How it works

- The **firmware** is Eight Sleep's own program. It runs the pumps, heaters and vibration motors, and is left as it is.
- The **server** (`server/`) takes the place of Eight Sleep's cloud: it tells the firmware what to do, runs the schedule and alarms, and reads the buttons and the bed's sensors.
- The **app** (`app/`) is a web page the server serves. Add it to your phone's home screen and it behaves like an app.
- **Shortcuts and automations** use the same [local API](server/API.md) the app does.
- Away from home, optional **[Tailscale on the Pod](docs/REMOTE_ACCESS.md)** reaches it privately, with the internet block still on.

[HOW_IT_WORKS.md](docs/HOW_IT_WORKS.md) explains every part and how they interact.

## What it does

- **The Eight Sleep app's controls, on your own network:** temperature for each side, a schedule for every night, vibration alarms, wake-up heat, priming and away mode. Sleep tracking and Autopilot are not part of it.
- **A local API:** every control is a documented request to the Pod itself, so it keeps working when your internet or Eight Sleep's servers are down, which tools built on the cloud cannot do. Anything that sends a web request can drive the bed: iPhone Shortcuts, Home Assistant, a script, or an AI assistant. See [server/API.md](server/API.md).
- **A private tunnel for access away from home:** optional Tailscale on the Pod opens the same app from anywhere, with the Pod still blocked from the internet.
- **Pod 5 side buttons enabled:** + and - change the temperature, holding the middle button switches the side on or off, and any button stops an alarm.

**Quality of life**

- **A redesigned app:** dark, phone-first and quiet, with one screen per night, explanations behind an "i", controls that respond at once, and a page that lists the API.
- **In-bed detection (Pod 5):** the bed knows when someone is in it, and can turn on when you get in, off after you get out, or vibrate after a long stay.
- **Autopilot (Pod 5, experimental):** while you sleep, the bed runs cooler early in the night, warms toward morning, follows the room, learns from the changes you make, and can tune its sleep detection to a watch or band through Apple Health (iPhone only). Off by default. See [docs/AUTOPILOT.md](docs/AUTOPILOT.md).
- **Calibrated temperatures:** the number shown is what the firmware aims for at each level, measured on a Pod 5, beside the temperature the bed measures. Units are °F, °C, or Eight Sleep's -10 to +10.
- **An address you can remember:** `http://sevensleep.local`, with no IP address or port.
- **Wake-up heat:** the bed warms to a temperature you choose 15 to 45 minutes before the alarm.
- **Alarms that keep going:** they vibrate until you dismiss them, with a real ramp-up on a Pod 5, and go off even if the bed is off.
- **One-time alarms:** change one morning's alarm without touching the schedule.
- **Linked sides:** control the whole bed as one, across temperature, power, schedules, buttons and shortcuts.
- **Updates from the app:** it shows when a newer version exists and updates in about four minutes, putting the old version back if anything fails.

The rest, and the full comparison with Free Sleep, is in [CHANGELOG.md](CHANGELOG.md#compared-with-free-sleep).

## Security

- **The app has no login.** Anyone on your home network can open it. Never put it on the open internet; use [Tailscale](docs/REMOTE_ACCESS.md) to reach it from elsewhere.
- **The internet block** stops the Pod reaching Eight Sleep or anything else, and is restored at every boot. SevenSleep has no error-reporting destination built in.
- **You need root on the Pod once**, through a serial adapter. It is not supported by Eight Sleep. The install can be undone; see the [FAQ](#faq).

## Compatibility

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

## FAQ

Select a question to open its answer.

<details>
<summary><b>Is it reversible?</b></summary>
<br>

Yes. The install leaves Eight Sleep's firmware in place and only switches its cloud services
off, so going back means switching them on again.

- **Pod 3 and Pod 4:** a firmware reset puts the Pod back as it left the factory.
- **Pod 5:** [six commands over SSH](INSTALLATION.md#going-back-to-eight-sleep) switch Eight
  Sleep's services back on and remove the internet block. They are the install steps in reverse.
  The one test Pod is still in use, so they have not been run yet; if you try them, please say how
  it went.

</details>

<details>
<summary><b>Will I brick my Pod?</b></summary>
<br>

The install does not touch the firmware that runs the bed; it adds a program beside it and
switches a few services off. The risk is in the steps before that: you open the hub and type
commands as root, and a wrong command can stop the Pod booting. Follow the guide step by step and
do not improvise. A Pod 3 with an SD card is the riskiest, because the card itself is modified.

</details>

<details>
<summary><b>Will it void my warranty?</b></summary>
<br>

SevenSleep is not supported by Eight Sleep, and their warranty terms are theirs to apply. Nothing
is soldered or cut: the hub is opened with a screwdriver and closed again, and the software
change can be undone (see "Is it reversible?").

</details>

<details>
<summary><b>Do I still need an Eight Sleep subscription or account?</b></summary>
<br>

No. Nothing here talks to Eight Sleep. Their app stops working with the Pod once it is installed.

</details>

<details>
<summary><b>Does it work without internet?</b></summary>
<br>

Yes. The Pod is blocked from the internet on purpose and everything runs on it. You need your
home Wi-Fi to reach the app from your phone, and the side buttons and schedule work without that.

</details>

<details>
<summary><b>How do I update?</b></summary>
<br>

The app shows when a newer version is out. **Settings > Pod > Update** takes about four
minutes, keeps your settings, and puts the old version back if anything fails. The internet block
is lifted for the download and put back afterwards.

</details>

**More questions**

<details>
<summary><b>Can I control it away from home?</b></summary>
<br>

Yes, with [Tailscale on the Pod](docs/REMOTE_ACCESS.md). It is optional, takes one script, and
keeps the internet block on. A shortcut can open the app at home and offer Tailscale when you are
away.

</details>

<details>
<summary><b>Does sleep tracking work?</b></summary>
<br>

Not on a Pod 5: its firmware publishes sensor data where the analysis does not read. On a Pod 3 or
4 the code is the original's, unchanged and untested here. Help is [wanted](https://github.com/jalen-cheng/sevensleep/issues).

</details>

<details>
<summary><b>Does the bed know when I am in it?</b></summary>
<br>

On a Pod 5, yes. It can turn on when you get in, turn off about 15 minutes after you get out, and
vibrate if you have been in bed longer than you chose. A Pod 3 or 4 does not report the sensors
this needs.

</details>

<details>
<summary><b>Do the buttons or taps on the bed work?</b></summary>
<br>

Pod 5 buttons do: + and - for temperature, hold the middle to switch a side on or off, any button
to stop an alarm. Pod 4 taps are handled by the same code and have not been run. A Pod 3 has
neither.

</details>

<details>
<summary><b>Two of us share the bed. Does each side get its own settings?</b></summary>
<br>

Yes: its own temperature, schedule and alarm. Or link the sides and control the bed as one.

</details>

<details>
<summary><b>Can I go back to the original Free Sleep?</b></summary>
<br>

Yes. One command over SSH reinstalls it and keeps your schedules; see
[docs/POD_MODELS.md](docs/POD_MODELS.md).

</details>

## Documentation

| Goal | Start here |
|---|---|
| Read all of this as a website | [jalen-cheng.github.io/sevensleep](https://jalen-cheng.github.io/sevensleep/) |
| Install it on a Pod | [INSTALLATION.md](INSTALLATION.md) |
| Usage: a night, alarms, settings | [docs/USING.md](docs/USING.md) |
| Know what works on a Pod 3 or Pod 4 | [docs/POD_MODELS.md](docs/POD_MODELS.md) |
| Keep the address stable, or reach the Pod away from home | [docs/REMOTE_ACCESS.md](docs/REMOTE_ACCESS.md) |
| Control the bed from iPhone Shortcuts | [docs/IOS_SHORTCUTS.md](docs/IOS_SHORTCUTS.md) |
| Understand every part and how they interact | [docs/HOW_IT_WORKS.md](docs/HOW_IT_WORKS.md) |
| Use the API | [server/API.md](server/API.md) |
| See what changed and what was tested | [CHANGELOG.md](CHANGELOG.md) |
| Help test or contribute | [CONTRIBUTING.md](CONTRIBUTING.md) |

## Development

```bash
git clone https://github.com/jalen-cheng/sevensleep.git
cd free-sleep/app && npm install && VITE_ENV=demo VITE_USE_MSW=true npx vite
```

That runs the app on made-up data, with no Pod. Running against a Pod, the checks and how
releases work are in [DEVELOPING.md](DEVELOPING.md). The folders, services and commands on the Pod
keep the name `free-sleep`, so an existing install updates in place.

## Contributing

Issues and pull requests are welcome, including new features, a different direction for the
product and UI rewrites. The only fixed rules are that it stays local and leaves Eight Sleep's
firmware alone. The most useful contribution is a report from hardware Free
Pod has not seen: a Pod 3 or Pod 4, or a newer Pod 5. [CONTRIBUTING.md](CONTRIBUTING.md) says how,
and issues labelled [needs testing](https://github.com/jalen-cheng/sevensleep/issues?q=is%3Aissue+is%3Aopen+label%3A%22needs+testing%22)
list what is waiting to be checked.

## Credits

SevenSleep exists because of Free Sleep. Its community, support and donations are its author's:

- **[throwaway31265/free-sleep](https://github.com/throwaway31265/free-sleep)**, the original project, with its Discord server linked from its README. To support the original author, use the donation links there.
- [@bobobo1618](https://github.com/bobobo1618), for the research into how the Pod is controlled through `dac.sock`.
- The original's error monitoring is sponsored by Sentry. SevenSleep does not use it.

## License

See [LICENSE.md](LICENSE.md).
