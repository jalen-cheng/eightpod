# Fork status

What this fork (`jalen-cheng/free-sleep`) changes from upstream Free Sleep, how it compares with
Eight Sleep's own app, and what is left to do. The fork targets a Pod 5.

Everything listed as done is merged to `main` and installed on the test Pod. It was checked with
unit tests and the demo UI. What has been confirmed on the Pod itself is listed under
[Confirmed on the Pod so far](#confirmed-on-the-pod-so-far); the rest runs there but has not been
deliberately tested.

- [Confirmed on the Pod so far](#confirmed-on-the-pod-so-far)
- [Calibration results](#calibration-results)
- [Changes by pull request](#changes-by-pull-request)
- [Compared with the Eight Sleep app](#compared-with-the-eight-sleep-app)
- [Checklist for the first day on the Pod](#checklist-for-the-first-day-on-the-pod)
- [Upstream issues that touch this fork](#upstream-issues-that-touch-this-fork)
- [Later](#later)

## Confirmed on the Pod so far

Pod 5, control board 830-00067-00 REV-17. Last updated 2026-11-16.

- [x] **The bootloader is not locked.** `Hit any key to stop autoboot` appeared and Ctrl+C stopped it.
- [x] **The serial header is J7**, the lower of the two pad grids on the board's right edge.
- [x] `current_slot=a`.
- [x] Root shell, file system remounted writable, `root` and `rewt` passwords set, clean reboot, login as `root`.
- [x] Eight Sleep system version at login: `4b7552d5a9aed31997ff22cf193240800056ef6a`.
- [x] Eight Sleep's updater disabled, Free Sleep installed from this fork (3.0.3, `main`), UI and SSH reachable, all services healthy.
- [x] **The firmware connects at `/persistent/deviceinfo/dac.sock`.** There is no `frank.sh` on this Pod, so the installer could not find it and it was set by hand. The installer now reads it from the `frank` service.
- [x] **The install guide's Wi-Fi step breaks a Pod 5.** The Pod already had a `customer-wifi` profile from app setup. Adding another and running the guide's `sed` gave every profile the same ID, and the Pod did not rejoin Wi-Fi after a reboot. Fixed by keeping only `customer-wifi`. The walkthrough now checks for an existing connection first.
- [x] The hub reports hardware revision G45, which Free Sleep labels "Pod 4"; its Pod 5 cutoff of G53 is a guess from upstream.
- [x] The firmware's status also carries a `dismissAlarm` counter and blanket sensor state, which Free Sleep does not read.
- [x] Reboot test passed with the internet block on; cover connected and identified as Pod 5 (J55).
- [x] **Buttons work through the firmware log.** + and - step the temperature and a long middle hold switches the side; three faults found in the first tests were fixed.
- [x] **Sensor readings arrive on `rawmem.*`, not `raw.*`.** The `raw` stream that upstream's sleep analysis reads is empty on this firmware, so biometrics cannot work here as written. Temperatures are hundredths of a degree Celsius.
- [x] **The firmware reports its own target water temperature** (`rawmem.frz.therm`, in °C). At level +100 it aims for 42.0°C (107.6°F), where Free Sleep shows 110°F.
- [x] **The firmware's "rise" pattern does not ramp.** Felt on the bed: one steady strength from start to finish. The firmware also ignores a new alarm while one is vibrating. Free Sleep now makes the ramp itself.
- [x] **Updates work** with `fs-update` over SSH, from this fork, with the internet block restored afterwards.
- [x] **Shortcuts work from an iPhone**: setting the temperature by -10..+10, setting a one-time alarm, and reading the bed's state.
- [x] **Calibration run done.** See [Calibration results](#calibration-results).
- [x] The firewall on this Pod cannot filter by program (`iptables -m owner` is missing), which shapes the [remote access](REMOTE_ACCESS.md) options.
- [x] **The `.local` name works.** After the update, `http://eight-pod.local:3000` loads from a Mac on the home network, with the internet block on.
- [x] **The bed stays on for an alarm set after the off time.** With off at 12:03 AM and the alarm at 12:06 AM, the off job kept both sides on until the alarm's end plus two minutes, then the firmware switched them off. The alarm itself was skipped in that run because a one-time alarm was set for the same day, which replaces the scheduled one by design.
- [x] **Tailscale runs on the Pod with the internet block on.** It reaches its sign-in servers and its two relay regions (Los Angeles, San Francisco) and nothing else; the daily relay refresh works while blocked. Signing in and opening the page from a phone are still to do.
- [x] **The measured temperature curve matches the firmware** at every level tried after it was applied, once one error was fixed: only level -100 drops to 10°C; -99 to -91 stay on the main line.
- [x] **Alarms, checked against the firmware's own log:**
  - Dismiss stops the vibration. The firmware's clear command stops both sides at once.
  - A 200-second alarm ran its 180-second limit, restarted for the last 20, and stopped when dismissed.
  - With "bed off when dismissed" the side switched off on dismissal.
  - A one-time alarm asked for as "2:00 PM" fired at 14:00 on the side that was on, was skipped on the side that was off, and did not fire again.
  - Moving the next alarm by minutes and cancelling a one-time alarm answer correctly.
  - The warm-up raised the target to the alarm temperature 15 minutes before a scheduled alarm.
- [x] With the sides linked, a request naming one side changes both.
- [x] Buttons with the sides linked.
- [x] The bed vibrates for an alarm while the side is off.
- [x] The stepped ramp-up runs as built: 20, 40, 60, 80% for 10 seconds each, then full strength.

Seen along the way: the serial line drops the odd character, password prompts show nothing while
typing, and the clock is unset before Wi-Fi (`password changed in future`).

## Calibration results

Run on the test Pod 5 on 2026-11-16. For each firmware level the script recorded the water
temperature the firmware says it is aiming for. Both sides gave identical figures.

| Dial | Firmware level | Firmware aims for | Free Sleep showed before #32 |
|---|---|---|---|
| -10 | -100 | 10.0°C / 50.0°F | 55.0°F |
| -9.9 | -99 | 15.1°C / 59.2°F | 55.3°F |
| -9 | -90 | 16.2°C / 61.2°F | 57.8°F |
| -5 | -50 | 21.0°C / 69.8°F | 68.8°F |
| 0 | 0 | 27.0°C / 80.6°F | 82.5°F |
| +5 | +50 | 36.0°C / 96.8°F | 96.3°F |
| +10 | +100 | 42.0°C / 107.6°F | 110.0°F |

What it shows:

- **Three straight stretches, not one.** From -9 to 0 each dial step is 1.2°C (2.2°F). From 0 to +5
  each step is 1.8°C (3.2°F). From +5 to +10 each step is 1.2°C again.
- **-10 is a special case**: level -100 alone jumps to 10°C, 5°C below level -99, which reads as "as cold as possible".
- **Free Sleep's °F figures were off by up to 5°F**, most at the two ends and around neutral.
- These are the firmware's targets, not measurements of the water. The optional `--measure` run,
  which checks the water reaches them, has not been done.

The full output is in [pod5_temperature_calibration.json](pod5_temperature_calibration.json).

Applied in [#32](https://github.com/jalen-cheng/free-sleep/pull/32): °F and °C now show what the firmware aims for, and the range
is 50 to 108°F instead of 55 to 110°F. Saved schedules are converted once, on the first start after
updating, so each keeps setting the bed to the same level; the schedules as they were are kept in
`/persistent/free-sleep-data/schedulesDB.before-measured-temperatures.json`. The -10 to +10
display is unaffected, because it is the firmware's own scale.

The curve was measured on one Pod 5 and is used for every model. A Pod 3 or 4 may differ; running
the calibration script on one would show it.

## Changes by pull request

### Before pull requests were used (merged straight to `main`)

| Branch | What changed |
|---|---|
| `firewall-persistence` | The internet block is saved and restored at boot by `free-sleep-firewall.service`. Sentry is blocked unless `ALLOW_SENTRY=true`. Updates lift the block only until the next reboot or re-block. |
| `update-source` | `install.sh` and `update.sh` read the repo and branch from `/etc/free-sleep/update_source.conf`, so updates come from this fork. |
| `updater-lockout` | `scripts/updater_lockout.sh enable\|disable` masks Eight Sleep's updater units and blocks its update hosts. Adds `ALLOW_TAILSCALE=true` to the firewall. |
| `tap-polling-fixes` | Faster tap polling on Pod 4/5, quiet status logs, several gestures handled per poll, unexpected socket messages logged. |
| `tap-alarm-actions` | A tap can dismiss or snooze a vibrating alarm, or toggle power when no alarm is going off. |
| `tap-settings-ui` | Tap gestures section on the Settings page. |
| `ios-shortcuts-docs` | `docs/IOS_SHORTCUTS.md`: control the Pod from Apple Shortcuts. |

### Pull requests

| PR | Type | What changed |
|---|---|---|
| [#1](https://github.com/jalen-cheng/free-sleep/pull/1) | Fixes | Firewall allows DHCP and link-local IPv6. Lockout undo only unmasks what it masked. +/- buttons stay within 55-110°F. Power button waits for the Pod's state. Tap steps shown in °C when set to Celsius. |
| [#2](https://github.com/jalen-cheng/free-sleep/pull/2) | Feature | Temperature controls respond at once instead of locking after each change. Step size, dial range and the matching Eight Sleep level are labelled. Schedule enabled switch and Save moved to the bottom. |
| [#3](https://github.com/jalen-cheng/free-sleep/pull/3) | Feature | Link button beside the side picker: temperature, power and schedule changes apply to both sides. |
| [#4](https://github.com/jalen-cheng/free-sleep/pull/4) | Build | Rebuilt app bundle for #1 to #3. |
| [#5](https://github.com/jalen-cheng/free-sleep/pull/5) | Feature | Tap settings reduced to one set of controls for both sides: a temperature step, what the third gesture does during an alarm, and what it does otherwise. Fixes labels breaking mid-word. |
| [#6](https://github.com/jalen-cheng/free-sleep/pull/6) | Feature | Level (-10 to +10) as a display unit next to °F and °C, everywhere a temperature is shown or picked. Fixes the schedule chart axis in °C. |
| [#7](https://github.com/jalen-cheng/free-sleep/pull/7) | Tooling | `collect_temperature_calibration.py`, which measures the real temperature at each level. First version of this file. |
| [#8](https://github.com/jalen-cheng/free-sleep/pull/8) | Docs | This file reorganised: changes by pull request, comparison with the Eight Sleep app, first-day checklist. |
| [#9](https://github.com/jalen-cheng/free-sleep/pull/9) | Docs, tooling | `POD5_FIRST_DAY.md` walkthrough. `GET /api/deviceStatus/raw` returns the firmware's unparsed status text, for seeing what a Pod reports beyond what Free Sleep reads. |
| [#10](https://github.com/jalen-cheng/free-sleep/pull/10) | Fix, docs | The internet block allows DNS to any resolver, so time servers can be found on networks with public DNS servers. Upstream issues that touch this fork are recorded here. |
| [#11](https://github.com/jalen-cheng/free-sleep/pull/11) | Docs | Findings from the project's Discord and other Pod 5 owners, with sources. |
| [#12](https://github.com/jalen-cheng/free-sleep/pull/12) | Feature | Pod 5 side buttons. A monitor follows the firmware's log, where a Pod 5 reports each press, and runs the same settings the tap gestures use. Holding the middle button two seconds switches the side on or off. Settings name the buttons on a Pod 5. |
| [#13](https://github.com/jalen-cheng/free-sleep/pull/13) | Docs | Walkthrough corrections from the first real install steps: the J7 header, versions from the boot log, serial quirks, checking the clock before the HTTPS download, and installing Biometrics before the block. |
| [#14](https://github.com/jalen-cheng/free-sleep/pull/14) | Docs | This file brought up to date. |
| [#15](https://github.com/jalen-cheng/free-sleep/pull/15) | Fixes | Installer reads the firmware socket path from the `frank` service when `frank.sh` is missing (Pod 5). Found on the first real install. |
| [#16](https://github.com/jalen-cheng/free-sleep/pull/16) | Docs | Walkthrough: a Pod 5 already has a Wi-Fi profile, so the upstream Wi-Fi step is skipped. Records what the install confirmed. |
| [#17](https://github.com/jalen-cheng/free-sleep/pull/17) | Docs | Walkthrough explains `fs-update`, shutting down, and reconnecting over SSH. |
| [#18](https://github.com/jalen-cheng/free-sleep/pull/18) | Fixes | Button reader can read the firmware log (journal group), long holds are recognised, and updates work without Python's `json` and `sqlite3` (database backup falls back to Node). |
| [#19](https://github.com/jalen-cheng/free-sleep/pull/19) | Fixes | Quick button presses all count, a long hold no longer undoes itself, and the app refreshes the Pod's state every 5 seconds. |
| [#20](https://github.com/jalen-cheng/free-sleep/pull/20) | Feature | Only a hold of the middle button switches power. Linked sides apply to the buttons. The dial is blue when cooling. Alarm warm-up (15, 30 or 45 minutes before) and switching the side off when the alarm is dismissed. |
| [#21](https://github.com/jalen-cheng/free-sleep/pull/21) | Feature | Schedule page redesigned as one night's list of events, with alarm options in their own dialog. Alarms run until dismissed, up to 30 minutes, by chaining the firmware's 3-minute limit. |
| [#22](https://github.com/jalen-cheng/free-sleep/pull/22) | Fix | Lint error in the alarm scheduler. |
| [#23](https://github.com/jalen-cheng/free-sleep/pull/23) | Feature | + or - switches a side on when it is off. |
| [#24](https://github.com/jalen-cheng/free-sleep/pull/24) | Feature, fixes | Day picker (every day, weekdays / weekend, each day). `POST /api/alarm/time` for shortcuts. Warm-up temperature shown only when a warm-up time is chosen; dial labels no longer covered. |
| [#25](https://github.com/jalen-cheng/free-sleep/pull/25) | Feature | The alarm time request sets a one-off alarm unless days are given. |
| [#26](https://github.com/jalen-cheng/free-sleep/pull/26) | Tooling | Calibration reads the firmware's live stream (`rawmem.*`) and takes ten minutes. |
| [#27](https://github.com/jalen-cheng/free-sleep/pull/27) | Feature | One-time alarm on the schedule page. "Bed turns off" can follow the alarm. `shiftMinutes` moves the next alarm; a cancel request. |
| [#28](https://github.com/jalen-cheng/free-sleep/pull/28) | Feature, docs | `POST /api/deviceStatus/dial` sets a side by -10..+10. Shortcuts guide cut to the essentials. |
| [#29](https://github.com/jalen-cheng/free-sleep/pull/29) | Feature | Shortcut requests default to both sides and follow linked sides. |
| [#30](https://github.com/jalen-cheng/free-sleep/pull/30) | Feature | Alarm times are read however a phone writes them (AM/PM, full dates). `GET /api/deviceStatus/dial` reports the bed in one sentence. |
| [#31](https://github.com/jalen-cheng/free-sleep/pull/31) | Docs | README introduces the fork; this file and the walkthrough updated; calibration results and remote access options written up. |
| [#32](https://github.com/jalen-cheng/free-sleep/pull/32) | Fix | °F and °C use the measured level-to-temperature curve instead of an even 55-110°F spread. Range is now 50-108°F. Saved schedule temperatures are converted once. |
| [#33](https://github.com/jalen-cheng/free-sleep/pull/33) | Fixes | Found by testing on the Pod. The curve drops to 10°C only at level -100. Dismissing one side's alarm no longer silently ends the other side's (the firmware stops both): with the sides linked both are dismissed, otherwise the other is restarted. Saving part of an alarm through the API keeps the rest of it. |
| [#34](https://github.com/jalen-cheng/free-sleep/pull/34) | Fix, removal | A one-time alarm goes off even when the side is off: one set for 11:55 was skipped because the schedule had switched the bed off at 11:00, after it had already replaced the 10:30 alarm. Snooze removed; an alarm gesture always dismisses. |
| [#35](https://github.com/jalen-cheng/free-sleep/pull/35) | Feature, fix | An alarm later than the schedule's off time (a one-time alarm, or the night's own) keeps the bed on until it has gone off, up to 6 hours past the off time. Ramp up is made by Free Sleep: 10-second steps at 20, 40, 60 and 80% of the chosen strength, then full strength. |
| [#36](https://github.com/jalen-cheng/free-sleep/pull/36) | Feature | Scheduled and one-time alarms always keep going until dismissed, up to 30 minutes. The length choice is gone from Alarm options. |
| [#37](https://github.com/jalen-cheng/free-sleep/pull/37) | Docs | README compares the fork with upstream area by area. |
| [#38](https://github.com/jalen-cheng/free-sleep/pull/38) | Feature | Alarm length choice (10 to 30 minutes) and a one-minute test are back in Alarm options. The one-time alarm is only on the Temperature page, with a cleaner dialog that can also go back to the schedule. The schedule page's two rows of day buttons are one "Schedule for" picker. |
| [#39](https://github.com/jalen-cheng/free-sleep/pull/39) | Feature | Schedule page: a tab per day replaces the "Schedule for" picker. The week starts on Monday. Saving offers that day, or a dialog to tick any days, and can copy a saved night to other days. |
| [#40](https://github.com/jalen-cheng/free-sleep/pull/40) | Feature, docs | `scripts/setup_local_name.sh` makes the Pod answer to `eight-pod.local` (opt-in), and the internet block allows the lookups. Remote access write-up extended: a stable address three ways, and options that need no other device at home. Schedule page: "Copy to other days" sits where "Saved" was, and the save buttons fit one row. |
| [#41](https://github.com/jalen-cheng/free-sleep/pull/41), [#42](https://github.com/jalen-cheng/free-sleep/pull/42) | Feature, docs | `scripts/setup_tailscale.sh` puts Tailscale on the Pod with the internet block on: only its sign-in range and two relay regions are opened, and a daily timer keeps the relay addresses current. The `.local` name and daily priming (2:00 PM) are on by default for new installs. |
| [#43](https://github.com/jalen-cheng/free-sleep/pull/43), [#44](https://github.com/jalen-cheng/free-sleep/pull/44), [#45](https://github.com/jalen-cheng/free-sleep/pull/45) | Fix, docs | The Tailscale unit no longer delays boot by two minutes. The app loads when opened as `eight-pod`, `eight-pod.local` or the Tailscale address (it was a blank page: the server refused its own script files under those names). The fork installs and updates from itself by default, and the README has current screenshots. |
| [#46](https://github.com/jalen-cheng/free-sleep/pull/46), [#47](https://github.com/jalen-cheng/free-sleep/pull/47) | Feature, fix, docs | Schedule page: a night switch under the day tabs and a save bar that stays in view. Clearer alarm text. Wi-Fi and version chips on Status. A one-time alarm now also replaces a scheduled alarm up to 6 hours after it (before, both went off). The alarm dialog shows again for the next alarm. Tailscale upgrades with Free Sleep updates. [HOW_IT_WORKS.md](HOW_IT_WORKS.md) explains every part. |
| [#48](https://github.com/jalen-cheng/free-sleep/pull/48) | Fix, feature | A night switched off no longer runs its temperature changes. A one-time alarm takes the warm-up with it. The daily reboot no longer needs daily priming on. App: linked sides show as one control, explanatory text moved behind "i" tips, Cancel sits on the left of every dialog, the copy button sits beside the night's switch. |
| [#49](https://github.com/jalen-cheng/free-sleep/pull/49), [#50](https://github.com/jalen-cheng/free-sleep/pull/50) | Feature | Schedule page: one line per event on a line with temperature-coloured dots, centred chart. A night with an alarm turns off 30 minutes after it (saved nights were brought in line); a one-time alarm moves that to 30 minutes after it goes off. Temperature page: dial centred on a phone with the alarm row at the bottom; dialogs restyled. |
| [#51](https://github.com/jalen-cheng/free-sleep/pull/51), [#52](https://github.com/jalen-cheng/free-sleep/pull/52), [#53](https://github.com/jalen-cheng/free-sleep/pull/53) | Feature | Linked sides show one "Both sides" button. A night is bedtime, temperature changes and a wake-up time; the bed-off row is gone and the bed always turns off 30 minutes after wake up. `setup_tailscale.sh home-address` makes one link work at home and away. README screenshots retaken. |
| [#54](https://github.com/jalen-cheng/free-sleep/pull/54) | Fix, docs | Reviewed against the original project for Pod 3 and Pod 4. The service starts without the journal group, the IPv6 firewall step is best-effort, the stepped alarm ramp is Pod 5 only, and a one-degree step can no longer get stuck at the coldest level. [POD_MODELS.md](POD_MODELS.md) lists what works on each model. |

## Compared with the Eight Sleep app

The Eight Sleep column is from memory and public material, not from testing the current app.

| Area | Eight Sleep app | This fork |
|---|---|---|
| Temperature | Level -10 to +10, no units | °F, °C or level. The °F and °C figures are the temperatures the firmware aims for, measured on a Pod 5 (see above). |
| Automatic adjustment | Autopilot changes temperature overnight | None. Fixed times and temperatures per day. |
| Schedules | Bedtime, night and wake phases | One night as a list of events: bedtime, any number of timed changes, alarm, bed off. A tab per day; an edit is saved for that day or for any set of days. |
| Both sides together | Per account | Link button for temperature, power and schedules. |
| Alarm | Vibration and thermal, snooze in app | Vibration until dismissed (10 to 30 min) with a stepped ramp-up, a test button, optional warm-up before it, bed off on dismissal, one-time alarms, and the bed stays on for an alarm later than its off time. No snooze. |
| Side buttons (Pod 5) | + warms, - cools, middle is configurable | + and - step the temperature, any button dismisses a vibrating alarm, and holding the middle button two seconds switches the side on or off. |
| Sleep data | Stages, score, snoring | Time in bed, heart rate, HRV, breathing, movement. |
| Base and speakers | Elevation, snore mitigation, audio | Not supported. |
| Remote access | Anywhere, through Eight Sleep's cloud | Home network only. Optional Tailscale on the Pod, set up with one script: [REMOTE_ACCESS.md](REMOTE_ACCESS.md). |
| Internet | Always connected, automatic firmware updates | Blocked at the firewall, updater disabled. |
| Automation | None | Local REST API, with short requests made for Apple Shortcuts (temperature, alarm, status). |

## Checklist for the first day on the Pod

In order. Stop and note the output if a step does not behave as described.
The full walkthrough, with every command and what to expect, is in [POD5_FIRST_DAY.md](POD5_FIRST_DAY.md).

### Before opening it
- [ ] Pod 5 is already set up in the Eight Sleep app (required before install).
- [ ] Tools from [INSTALLATION.md](../INSTALLATION.md#tools-required) are on hand.
- [x] ~~Note the firmware version in the Eight Sleep app.~~ The app does not show one; it is taken from the boot log.

### Install
- [ ] Follow [INSTALLATION.md](../INSTALLATION.md) steps 1 to 12 as written (board access, root access, disable software updates, Wi-Fi).
- [ ] After joining Wi-Fi, confirm the Pod has an address and `date` is correct before installing. The download uses HTTPS, which fails while the clock is wrong.
- [ ] Step 13 installs this fork as written; nothing extra to set.
- [ ] Steps 14 to 18: open the UI at the Pod's address, reboot once and confirm the UI comes back, set up SSH.
- [ ] Reconnect the cover (if it was disconnected) and confirm a temperature change is felt on each side.
- [ ] Install Biometrics with `sh /home/dac/free-sleep/scripts/enable_biometrics.sh` while the internet is open. The button probe and the calibration script need its Python environment.

### Buttons (do this before blocking the internet, while nothing else is changing)
- [ ] Watch the firmware log: `journalctl -u frank -f -o cat | grep -iE "button|TTC|tap"`.
- [ ] Run `/home/dac/venv/bin/python /home/dac/free-sleep/scripts/probe_nats_taps.py`.
- [ ] Press +, -, and the middle button once each, on each side, a few seconds apart. Note what prints for each.
- [ ] In another session, compare `curl -s localhost:3000/api/deviceStatus/raw` before and after each press: do `doubleTap`, `tripleTap` or `quadTap` change?
- [ ] Check the fork's button reader: + and - move the target, a two-second hold of the middle button switches the side, and the Free Sleep log has a `Button press:` line per press.
- [ ] Try a long press and a double press of the middle button and note any difference.

### Internet block
- [ ] With the firewall still open, list what Eight Sleep's software connects to: `ss -tunp`.
- [ ] Step 19: `sh /home/dac/free-sleep/scripts/block_internet_access.sh`.
- [ ] `sh /home/dac/free-sleep/scripts/updater_lockout.sh enable`.
- [ ] Reboot, then check:
  - [ ] the UI still loads from another device
  - [ ] `systemctl status free-sleep-firewall` is active
  - [ ] `curl -m 5 https://example.com` fails
  - [ ] `timedatectl` shows the clock synchronized
  - [ ] `systemctl status iptables ip6tables` shows no other unit loading different rules

### Controls
- [ ] Temperature: +/- and the dial change the bed; the number shown matches after a few seconds.
- [ ] Link sides: linking matches the other side; a change reaches both.
- [ ] Schedule: save one that powers on a few minutes ahead and confirm it fires.
- [ ] Alarm: set one a few minutes ahead. Check that the app's Dismiss stops it, whether it stops both sides, and whether turning the side off stops it.
- [ ] Settings: switch between °F, °C and Level and confirm the dial and schedules follow.

### Running cost
- [ ] After an hour: `top` for CPU use by the Free Sleep server, and the size of the logs.

### Updates
- [ ] `fs-update` over SSH completes and the UI comes back.
- [ ] `cat /etc/free-sleep/update_source.conf` still names this fork.
- [ ] `curl -m 5 https://example.com` still fails afterwards.

### Calibration (about ten minutes)
- [ ] `cd /home/dac/free-sleep/biometrics/temperature_calibration && /home/dac/venv/bin/python collect_temperature_calibration.py`
- [ ] Keep `/persistent/free-sleep-data/temperature_calibration.json`.

### For remote access later (read-only checks)
- [ ] `uname -m` (processor type) and `df -h /persistent` (free space).
- [ ] `ls /dev/net/tun` (tunnel device).
- [ ] `iptables -m owner --help | tail -5` (per-program firewall rules).

## Upstream issues that touch this fork

From the upstream issue tracker and open pull requests, checked 2026-11-13.

| Upstream | What it says | Effect here |
|---|---|---|
| [#66](https://github.com/throwaway31265/free-sleep/issues/66) | A Pod 5 with a March 2025 bootloader shows no autoboot prompt, so the serial install cannot start. Open, unanswered. | May block the install entirely. The walkthrough says what to look for. |
| [#54](https://github.com/throwaway31265/free-sleep/issues/54) | On a Pod 3, the dismiss command does not stop an alarm that is already vibrating. Sending a new one-second alarm does. Untested on Pod 4/5. | Dismiss from the app and from the bed both use that command. If the Pod 5 behaves the same, dismiss and snooze need the one-second-alarm method instead. |
| [#53](https://github.com/throwaway31265/free-sleep/issues/53) | Old `.RAW` sensor files fill `/persistent` within days on a Pod 3 and stop Free Sleep from starting. | Unknown on Pod 5, which stores sensor data differently. Free space is on the checklist. |
| [PR 51](https://github.com/throwaway31265/free-sleep/pull/51), [PR 60](https://github.com/throwaway31265/free-sleep/pull/60) | With the block on, the clock stopped syncing on a network whose DNS servers were public addresses, because DNS was blocked. | Fixed here the same way: DNS is allowed to any resolver. This fork's rules already cover the other findings in PR 60 (IPv6 neighbor discovery, and removing Sentry rules when it is switched back off). |
| [#62](https://github.com/throwaway31265/free-sleep/issues/62), [#63](https://github.com/throwaway31265/free-sleep/issues/63) | On some Pod 4s the installer cannot find the firmware socket path and the server silently uses the Pod 3 path. | Not changed here. If the UI stays greyed out with the cover connected, check `fs-debug` for the socket path. |

### From the project's Discord and other Pod 5 owners

Searched 2026-11-13. These are other people's reports, not verified here.

| Finding | Source | Effect here |
|---|---|---|
| **Newer Pod 5 units cannot be rooted this way.** Several owners report no autoboot prompt. One bought in June could interrupt the boot; the view in the server is that newer units ship with it disabled and older ones have not been patched so far. | #support, #general, Sept to Nov 2026 | Same blocker as upstream #66. Whether yours is affected depends on when it was made. |
| **Pod 5 buttons do nothing under Free Sleep.** An owner on current `main` gets the haptic click from + and - but no temperature change. | #support, 1 Nov 2026 | The tap features in this fork will not respond to the Pod 5's + and - buttons as they stand. |
| **Pod 5 buttons show up in the firmware's log, not in the tap counters.** Another owner's fork reads `journalctl -u frank` for lines such as `[TTC] processing [button] side left { button: top, type: short` (top is +, bottom is -, plus middle) and `[buttons] middle button held for <N>ms`. | [seanpasino/free-sleep](https://github.com/seanpasino/free-sleep), branch `seanpasino/personal`, `server/src/8sleep/buttonMonitor.ts` | This is how to read the buttons, including how long the middle one was held. Needs a new reader in this fork. |
| **The dismiss command takes a side.** A related project sends `ALARM_CLEAR` with `0` (left) or `1` (right). Free Sleep sends the word `empty`, which may be why upstream #54 sees no effect. | [sleepypod/core docs/hardware/alarms.md](https://github.com/sleepypod/core/blob/6cf0c24fa793b0cda78d4ab5c299cff4dbfd926a/docs/hardware/alarms.md) | A likely fix for dismiss. To be tried on the Pod. |
| **The firmware stops a vibrating alarm by itself on any tap**, and that tap can be missing from the status counters. | same document | Dismiss-by-tap may already work without Free Sleep; snooze-by-tap may never see the tap. |
| **On some Pod 4 firmware the tap fields hold the time of the last tap, not a count.** | same document | This fork would read one tap as three (it caps a jump at three). Needs handling before Pod 4 use. |
| **A fresh Pod 5 install can show 55° and never change temperature** until a firmware component is updated. | #support, 1 Nov 2026 ("look up '55'") | If the bed does not respond after install, search the Discord's #support for `55`. |
| **Tailscale on the Pod works, but the firewall has to be opened for it by hand**, with long lists of addresses. | #support, #general, Mar to Apr 2026 | Matches the plan to allow Tailscale by program instead of by address. |

## Later

### Depends on what the Pod shows
- [ ] **Pod 4 tap fields.** Treat a large jump in a tap field as one tap, for firmware that reports a time instead of a count.
- [ ] **Calibration, second half.** Run the script with `--measure` on an empty bed to see whether the water reaches what the firmware aims for, especially at -10 and +10.
- [ ] **Remote access.** Tailscale on the Pod is signed in and survives a reboot. Still to do: confirm the page loads on a phone over cellular after the blank-page fix ([REMOTE_ACCESS.md](REMOTE_ACCESS.md)).
- [ ] **Biometrics.** Point the sleep analysis at the `rawmem.*` subjects this firmware publishes.

### Known gaps
- [ ] On a Pod 4, a four-tap just after an alarm stops vibrating toggles power; a short grace period would avoid it. (A Pod 5 is not affected.)
- [ ] In Level, tap steps are stored as whole °F (3, 6 or 8), so many presses in a row can drift by a level.
- [ ] An alarm restarted because the other side dismissed theirs starts over from its full length.
- [ ] Node tests (`tests/*.test.mjs`) do not run in CI, and no CI runs on the fork.
- [ ] Hardware differences between Pod 3, 4 and 5 are checked ad hoc; one capabilities table per model would replace those checks.
- [ ] Not started, by choice: an iOS app wrapper.
