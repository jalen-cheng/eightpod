# Free Sleep — Local Control for 8 Sleep Pods

## About this fork

This is a fork of [throwaway31265/free-sleep](https://github.com/throwaway31265/free-sleep), built for and
tested on one **Pod 5**. Everything upstream does still applies, and upstream's own README follows
this section unchanged. Thanks to the upstream author and contributors for the project this builds on.

Start here:

| If you want to | Read |
|---|---|
| Install on a Pod 5, step by step | [docs/POD5_FIRST_DAY.md](docs/POD5_FIRST_DAY.md) |
| Control the bed from iPhone Shortcuts | [docs/IOS_SHORTCUTS.md](docs/IOS_SHORTCUTS.md) |
| Keep the Pod's address stable, or reach it away from home | [docs/REMOTE_ACCESS.md](docs/REMOTE_ACCESS.md) (Tailscale on the Pod; installed on the test Pod, phone sign-in not yet tried) |
| See every change, what was tested on a Pod, and what is not done | [docs/FORK_STATUS.md](docs/FORK_STATUS.md) |
| Use the API directly | [server/API.md](server/API.md) |

### What is different from upstream

| Area | Upstream | This fork |
|---|---|---|
| **Pod 5 side buttons** | Do nothing | + and - change the temperature and switch an off side on. Holding the middle button two seconds switches the side on or off. Any button stops an alarm. |
| **Temperatures** | Levels spread evenly over 55-110°F, off by up to 5°F | What the firmware aims for at each level, measured on a Pod 5. Range is 50-108°F. |
| **Display units** | °F or °C | °F, °C, or the -10 to +10 scale of Eight Sleep's app |
| **Both sides at once** | Each side set separately | A link switch: temperature, power, schedules, buttons and shortcuts apply to both sides |
| **Schedule page** | Separate sections per setting, one day at a time | One night as a list of events in order, with a tab per day. Save for that day or for any set of days. |
| **Alarm length** | A set time, 3 minutes at most | Keeps going until dismissed, for 10 to 30 minutes |
| **Alarm ramp-up** | The firmware's "rise" pattern, which on a Pod 5 is one steady strength | A real ramp: 20, 40, 60, 80% of the chosen strength, then full |
| **Before the alarm** | Nothing | Optional warm-up to a chosen temperature 15, 30 or 45 minutes before |
| **After the alarm** | Bed stays on until its off time | Optionally switches off when the alarm is dismissed |
| **One-time alarm** | "Override tonight's alarm" on the temperature page | Same place, or one request from a shortcut. For the next time the clock shows that time; goes off even if the bed is off. |
| **Alarm after the off time** | Skipped, because the bed is off | The bed stays on until the alarm has gone off (up to 6 hours past the off time) |
| **Two sleepers' alarms** | Dismissing one stops both (the firmware's doing), so the other is lost | The other side's alarm is started again |
| **iPhone Shortcuts** | Possible with the general API | Three short requests: set by -10..+10, set an alarm by time ("6:30 AM" works), read the bed in one sentence |
| **Internet block** | Blocks outbound traffic including DNS, which can stop the clock syncing | Also re-applied by its own service at every boot. DNS, DHCP and time sync keep working. Eight Sleep's updater is locked out. |
| **Updates** | From upstream | From whichever repository it was installed from; works on a Pod without Python's `json` and `sqlite3` |
| **Install on a Pod 5** | Wi-Fi step breaks a Pod already set up in the app; firmware socket not found | Both handled, with a walkthrough written from a real install |

### Smaller quality-of-life changes

- Temperature controls respond at once instead of locking after every press, and the app refreshes
  the bed's state every 5 seconds.
- The dial is blue when cooling and red when warming, and labels its range and step size.
- The power button waits for the Pod's state instead of acting on a guess.
- Alarm options has a one-minute test that vibrates the bed as currently set.
- Saving a schedule says what it will write to ("Save for Tuesday"), or lets you tick the days.
- The schedule chart's time axis marks the events you set, and its temperature axis is right in °C.
- Tap and button settings are one short set of choices for both sides, named for the buttons on a Pod 5.
- `GET /api/deviceStatus/raw` shows the firmware's unparsed status, for seeing what a Pod reports.
- A calibration script that reads the firmware's own targets in ten minutes.

### Removed

- Snooze. Upstream defines the setting but never acts on it; this fork briefly did, then took it out.

### Sent back to upstream

Open pull requests on the original project, each a small fix that stands on its own:
[#67](https://github.com/throwaway31265/free-sleep/pull/67) Pod 5 Wi-Fi step,
[#68](https://github.com/throwaway31265/free-sleep/pull/68) chart axis in °C,
[#69](https://github.com/throwaway31265/free-sleep/pull/69) +/- button range,
[#70](https://github.com/throwaway31265/free-sleep/pull/70) power button loading,
[#72](https://github.com/throwaway31265/free-sleep/pull/72) measured temperatures,
[#73](https://github.com/throwaway31265/free-sleep/pull/73) partial alarm updates,
[#74](https://github.com/throwaway31265/free-sleep/pull/74) alarm flag on both sides.

### Things to know before using it

- **Tested on one Pod 5 only.** Pod 3 and Pod 4 run the same code but have not been tried with this
  fork. The temperature figures were measured on that one Pod and are used for every model.
- **Sleep tracking (Biometrics) does not work on the tested Pod 5**: its firmware publishes sensor
  data somewhere the analysis does not read. This is the same upstream.
- **Some newer Pod 5 units cannot be opened up this way.** See the first section of the walkthrough.
- **Saved schedules are converted once** when updating to the measured temperatures, so each keeps
  setting the same level. The originals are kept beside them.
- To install this fork instead of upstream, set `FREE_SLEEP_REPO=jalen-cheng/free-sleep` before
  running the installer, as the walkthrough shows. Updates then come from this fork.
- The demo link below shows upstream's app, not this fork's.

---

## 👀 [Demo App](https://free-sleep.vercel.app/)

## 💬 [Discord Server](https://discord.gg/JpArXnBgEj)
- Support
- Feature requests
- Updates
- Contributing

## [🤖 Custom ChatGPT Support Bot](https://chatgpt.com/g/g-68fb217791dc8191b82d2d0ae7b29940-free-sleep-bot)

- A custom ChatGPT with Free Sleep documentation and related resources. It can help troubleshoot installations, answer setup questions, and guide you through common issues.

---

## 🛠️ [Installation Instructions](./INSTALLATION.md) 🛠

--- 

## Overview
Free Sleep is an open-source project that lets you control your Eight Sleep Pod locally — without relying on the cloud or the official app.
Each Pod actually runs a small Linux computer inside it. Free Sleep installs a lightweight server on that computer, giving you full local control.
- **Server**: Runs directly on the Pod and talks to its hardware using custom APIs.
- **App**: A simple, user-friendly web interface for changing temperatures, schedules, alarms, and settings. See [app demo here](https://free-sleep.vercel.app/)

## Compatability
- Pod 1 - ❌ **NOT COMPATIBLE**
- Pod 2 - ❌ **NOT COMPATIBLE**
- Pod 3 - **(With SD card)** - ✅
- Pod 3 - **(No SD card)** - ✅ FCC ID: 2AYXT61100001 (The FCC ID is located in the back of the pod where you plug in the water tubes)
- Pod 4 ✅
- Pod 5 ✅

---  
![App](docs/app.gif)

---
## FAQ
### Is it reversible?
Yes, you can easily firmware reset the pod and go back to the official 8 Sleep App

### Will I brick my pod?
Pod 3 **without** the SD card, Pod 4, and Pod 5 are impossible to brick - _as long as you follow the directions_ 

### Will it void my warranty?
Free Sleep is not officially supported by 8 Sleep, so there’s always a chance it could affect your warranty.
That said, you can fully reset the firmware and return the Pod to its original state at any time, and there’s no permanent modification made to the hardware.


## Features
- Allows complete control of device WITHOUT requiring internet access. If you lose internet, your pod WILL NOT turn off, it will continue working! You can completely block WAN internet access if you'd like too. (I blocked all internet access from my pod on my router...)
- WARNING: This will bypass blocked devices, please use responsibly
- Dynamic temperature control with real-time updates
- Schedule management: 
  - Set power on/off times 
  - Schedule temperature adjustments
  - Schedule daily time to prime the pod
  - Alarms - If you turn off the Pod prior to the alarm running, then the alarm will not run
- Settings customization: Configure timezones, away mode, brightness of LED on pod
- Website works on desktop and mobile


### Biometrics 📈
- **The only biometrics data that has been validated is heart rate**, HRV & breathing rates have not been validated & may be inaccurate.
Heart rates were validated over 33 sleep periods from 3 males & 3 females against mostly Apple Watches. 
**Heart rate calculations tend to be slightly less accurate for females**
- Summary statistics for all 33 periods:
  - RMSE - 2.88 average, 1.45 min, 7.63 max 
  - Correlation - 80.8% average, 27% min, 95% max
  - MAE - 1.83 average, 1 min, 5.77 max
- How to enable:
  - `sh /home/dac/free-sleep/scripts/enable_biometrics.sh`
- How to disable:
  - `sh /home/dac/free-sleep/scripts/disable_biometrics.sh`

#### Biometrics Overview

All biometric and sleep data is inserted into SQLite @ `/persistent/free-sleep-data/free-sleep.db`.

1. Vitals (Heart rate, breath rate, HRV) `biometrics/stream/stream.py` - This runs 24/7 and calculates vitals when it detects presence.
Vitals are inserted once every 60 seconds & you can access the raw data @ <POD_IP>/api/metrics/vitals


---
## Technical details

### **Server**
- REST API for managing device settings, schedules, and status.
- Modular design with routes for `deviceStatus`, `settings`, `schedules`, and `execute`.
- Uses Node.js and Express for lightweight, fast operations.

---

## Tech Stack
- **Server**: Node.js, Express, TypeScript.
- **App**: React, Material-UI, Zustand, React Query.
- **Database**: LowDB for simple JSON-based storage.

## Contributing
- Read [contributing docs](CONTRIBUTING.md) 

### Developing
- [front-end](app/README_APP.md)
- [back-end](server/README_SERVER.md)


---

## Support

If you find this project helpful and would like to support its continued development, you can send a tip to my Bitcoin address or PayPal

- [PayPal](https://paypal.me/realfreesleep)
- BTC Address: `bc1qjapkufh65gs68v2mkvrzq2ney3vnvv87jdxxg6`

Thank you for your support!


---
## Supporters

### Sentry.io 
Sentry
has generously sponsored error monitoring for the Free Sleep open-source project.
Their support helps us maintain a more reliable experience for users by 
enabling real-time visibility into issues and performance data — thank you, Sentry, 
for supporting open-source innovation!

---

## License
This project is licensed under the MIT License. See the `LICENSE.md` file for details.

---

## Acknowledgments
- Huge thanks to [@bobobo1618](https://github.com/bobobo1618) & their research on how the device is controlled via dac.sock


---

## App screenshots
![Device on](docs/on.PNG)
![Device off](docs/off.PNG)
![Scheduled temperature adjustments](docs/schedules.PNG)
![Alarms](docs/alarm.PNG)
![Health status](docs/health_status.PNG)
![Settings](docs/settings.PNG)
![Biometrics - 1](docs/sleep_data.PNG)
![Biometrics - 2](docs/metrics.PNG)
![Biometrics - 3](docs/movement.PNG)
![Settings](docs/settings.PNG)
![Settings](docs/settings_2.PNG)
![Support](docs/support.PNG)


