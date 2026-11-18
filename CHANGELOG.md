# Changelog

What Free Pod changed from [throwaway31265/free-sleep](https://github.com/throwaway31265/free-sleep),
what was checked on a real Pod, and what was not. Free Pod is at version 3.4.1. Everything was
developed and tested on one Pod 5 between 13 and 17 Nov 2026.

- [Tested on the Pod](#tested-on-the-pod)
- [Not tested](#not-tested)
- [Known gaps](#known-gaps)
- [Temperature calibration](#temperature-calibration)
- [Compared with Free Sleep](#compared-with-free-sleep)
- [Changes](#changes)

## Tested on the Pod

Each of these was seen working on the test Pod 5, in its log or by the person on the bed.

| Area | What was seen |
|---|---|
| Install and update | Installed from Free Pod; `fs-update` works and ends with the internet block on; survives a reboot |
| Temperature | Every level sets the target the curve predicts; the measured water temperature is read and shown |
| Schedule | Power on, temperature changes and power off fire at their times; the bed turns off 30 minutes after the wake-up time |
| Alarm | Stepped ramp felt (20, 40, 60, 80%, then full); a 10-minute alarm sent as chained stretches; dismissed by any button, by the app and by a request |
| One-time alarm | Replaced that morning's alarm and its warm-up, got its own warm-up, went off with the bed kept on past the off time, and set the bed to turn off 30 minutes later |
| Buttons | +, -, and the middle button held, on both sides and with sides linked |
| Shortcuts | Setting the temperature by -10..+10, a one-time alarm by time, and reading the bed's state, from an iPhone |
| Internet block | Blocks everything but the home network, time sync, DNS and address requests; restored at boot |
| `.local` name | `http://eight-pod.local:3000` loads on the home network (the Pod has since been renamed `bed`; the address is now `http://bed.local`) |
| Tailscale on the Pod | Installed with the block on; reaches only its sign-in servers and two relay regions; page opened from an iPhone on cellular; comes back after a reboot |
| In-bed detection | One person detected on each side within about a minute; "Turn on when I get into bed" turned both linked sides on |

## Not tested

- **Pod 3 and Pod 4.** Nothing has been run on either. See [docs/POD_MODELS.md](docs/POD_MODELS.md).
- **In-bed detection:** the bed turning off after someone gets out, the long-stay alarm, and its
  state being restored after a restart.
- **Turning on by hand:** the 3 and 6 hour lengths, and "Ignore the schedule until it turns off".
- **Flip left and right.**
- **A full 30-minute alarm**, and two unlinked sides with different alarms.
- **Biometrics.** It does not work on the tested Pod 5; its code is unchanged from the original.
- **The second fixed address** and the one-link-everywhere route in [docs/REMOTE_ACCESS.md](docs/REMOTE_ACCESS.md).

## Known gaps

- A scheduled time just before bedtime is treated as the next day (bedtime 22:00, change at 21:55).
- With unlinked sides, an alarm restarted because the other side dismissed theirs starts over, ramp included.
- Two saves in quick succession can leave the scheduled jobs built from the first; any later save fixes it.
- Holding the middle button during an alarm switches the bed on or off but does not dismiss the alarm.
- On a Pod 4, four taps just after an alarm stops can toggle power.
- In Level, button steps are stored as whole °F, so many presses in a row can drift by a level.
- Converting saved schedules to the measured curve can move a temperature by up to 2 levels out of 200.
- Priming and the daily reboot do not check whether the bed is in use.
- The automated checks on GitHub do not run the tests in `tests/`; they are run by hand.
- Hardware differences between Pod 3, 4 and 5 are checked in several places instead of one table.

## Temperature calibration

### First run: what the firmware aims for

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
- These are the firmware's targets. The second run, below, measured the water against them.

The full output is in [pod5_temperature_calibration.json](docs/pod5_temperature_calibration.json).

Applied in [#32](https://github.com/jalen-cheng/free-sleep/pull/32): °F and °C now show what the firmware aims for, and the range
is 50 to 108°F instead of 55 to 110°F. Saved schedules are converted once, on the first start after
updating, so each keeps setting the bed to the same level; the schedules as they were are kept in
`/persistent/free-sleep-data/schedulesDB.before-measured-temperatures.json`. The -10 to +10
display is unaffected, because it is the firmware's own scale.

The curve was measured on one Pod 5 and is used for every model. A Pod 3 or 4 may differ; running
the calibration script on one would show it.

### Second run: what the water reaches

A two-hour run on an empty bed (17 Nov 2026) held five levels for 20 minutes each and averaged the
measured water temperature over the next three.

| Dial | Firmware aims for | Water measured, left / right |
|---|---|---|
| -10 | 50.0°F | 63.0 / 62.3°F |
| -5 | 69.8°F | 70.5 / 70.5°F |
| 0 | 80.6°F | 81.1 / 81.1°F |
| +5 | 96.8°F | 98.4 / 98.4°F |
| +10 | 107.6°F | 108.5 / 108.2°F |

From -5 to +10 the water settles within 2°F of the target. At -10 it reached about 63°F in 20
minutes; whether it gets to 50°F with more time is not known from this run.

## Compared with Free Sleep

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

## Changes

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

### Pull requests on Free Pod

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
| [#46](https://github.com/jalen-cheng/free-sleep/pull/46), [#47](https://github.com/jalen-cheng/free-sleep/pull/47) | Feature, fix, docs | Schedule page: a night switch under the day tabs and a save bar that stays in view. Clearer alarm text. Wi-Fi and version chips on Status. A one-time alarm now also replaces a scheduled alarm up to 6 hours after it (before, both went off). The alarm dialog shows again for the next alarm. Tailscale upgrades with Free Sleep updates. [HOW_IT_WORKS.md](docs/HOW_IT_WORKS.md) explains every part. |
| [#48](https://github.com/jalen-cheng/free-sleep/pull/48) | Fix, feature | A night switched off no longer runs its temperature changes. A one-time alarm takes the warm-up with it. The daily reboot no longer needs daily priming on. App: linked sides show as one control, explanatory text moved behind "i" tips, Cancel sits on the left of every dialog, the copy button sits beside the night's switch. |
| [#49](https://github.com/jalen-cheng/free-sleep/pull/49), [#50](https://github.com/jalen-cheng/free-sleep/pull/50) | Feature | Schedule page: one line per event on a line with temperature-coloured dots, centred chart. A night with an alarm turns off 30 minutes after it (saved nights were brought in line); a one-time alarm moves that to 30 minutes after it goes off. Temperature page: dial centred on a phone with the alarm row at the bottom; dialogs restyled. |
| [#51](https://github.com/jalen-cheng/free-sleep/pull/51), [#52](https://github.com/jalen-cheng/free-sleep/pull/52), [#53](https://github.com/jalen-cheng/free-sleep/pull/53) | Feature | Linked sides show one "Both sides" button. A night is bedtime, temperature changes and a wake-up time; the bed-off row is gone and the bed always turns off 30 minutes after wake up. `setup_tailscale.sh home-address` makes one link work at home and away. README screenshots retaken. |
| [#54](https://github.com/jalen-cheng/free-sleep/pull/54) | Fix, docs | Reviewed against the original project for Pod 3 and Pod 4. The service starts without the journal group, the IPv6 firewall step is best-effort, the stepped alarm ramp is Pod 5 only, and a one-degree step can no longer get stuck at the coldest level. [POD_MODELS.md](docs/POD_MODELS.md) lists what works on each model. |
| [#55](https://github.com/jalen-cheng/free-sleep/pull/55) | Feature | Settings: how long the bed stays on when turned on by hand (3, 6 or 12 hours), and a switch that makes the schedule leave a hand-switched side alone until it turns off. |
| [#56](https://github.com/jalen-cheng/free-sleep/pull/56) | Feature | In-bed detection from the bed's capacitive sensors (Pod 5), with two optional actions: turn the bed on when someone gets in during the evening, and an alarm after a long time in bed. Detection margins are from an empty bed only and are not yet verified with someone in it. |
| [#57](https://github.com/jalen-cheng/free-sleep/pull/57) | Feature | The Temperature page shows the measured water temperature under the target where the Pod reports it. Second calibration run: water within 2°F of the target from level -5 to +10; 63°F against 50°F at the coldest level after 20 minutes. |
| [#58](https://github.com/jalen-cheng/free-sleep/pull/58) | Feature | Flip left and right. In-bed detection margins set from a person on the bed. "Turn on when I get into bed" takes a temperature and can last until the person gets out. The measured temperature reads "Bed at". |
| [#60](https://github.com/jalen-cheng/free-sleep/pull/60) | Fix, docs | Error reporting has no built-in destination (the original project's address was removed). The README no longer links the original's demo, and its screenshots are current. Version is now 3.1.0. |
| [#59](https://github.com/jalen-cheng/free-sleep/pull/59) | Tests | A test used the test Pod's own Tailscale address; replaced with a generic one. |
| [#61](https://github.com/jalen-cheng/free-sleep/pull/61) | Fix | In-bed state survives a restart of the server. A side picking up the person on the other side no longer reads as a second person. |
| [#62](https://github.com/jalen-cheng/free-sleep/pull/62) | Docs, fix | One install guide, a first-use guide, a complete API reference and a developer guide; the README is the fork's own and this changelog replaces the status document. A wake-up time set while the alarm is off is kept. In-bed margins raised so a laptop left on the bed is not a person. Links in the app point at this fork. |
| [#63](https://github.com/jalen-cheng/free-sleep/pull/63) | Feature, docs | The fork is named Free Pod. The installer renames a factory-named Pod to `bed` and the server also listens on port 80, so the app opens at `http://bed.local` (or `http://bed` with Tailscale). Screenshots are one size in phone frames. The README opens with why the fork exists and says biometrics are untested. A demo is at freepod.vercel.app. |
| [#64](https://github.com/jalen-cheng/free-sleep/pull/64) | Design, docs | New look: a night-blue palette with one accent, the Geist typeface, one text size across fields, pill switches, filled fields without outlines. The dial's handle is a ring. Turn on is a pill button. The schedule's wake-up line has one "Alarm on/off" button that opens everything about the alarm, and the off time is shown as the last line. In-bed state sits beside its heading. New icon. README has Demo and Install sections; a shortcut recipe opens the app at home or offers Tailscale away. |
| [#65](https://github.com/jalen-cheng/free-sleep/pull/65) | Design | Neutral dark greys with a white accent in place of the blue palette. Small square switches. The Temperature page has a heading and the dial's digits are spaced normally. The schedule's Bed off line is gone again. Biometrics is greyed out in Settings. |
| [#66](https://github.com/jalen-cheng/free-sleep/pull/66) | Design, docs | The schedule's last row is labelled "Wake". The icon is the app's dial. Biometrics rows on the Status page are greyed; the Biometrics switch in Settings works again. The README is reshaped: banner, summary, install, quick start, how it fits together, security, documentation, credits. |
| [#67](https://github.com/jalen-cheng/free-sleep/pull/67) | Fix, feature, docs | A review pass with fixes. **Alarms:** a shortcut or dial press on a bed that is already on no longer shortens its night; a one-time alarm moved up to 30 minutes later keeps the bed on; a one-time alarm only replaces a scheduled alarm within 6 hours of it; a dismissal between two stretches of an alarm counts; "Bed off on dismiss" ends a hold by hand; a date written with dots is not read as a time. **In-bed detection:** turning on when you get in holds the schedule for the stay, not for the manual length; a "Bed is empty now" button relearns the empty bed. **App:** Prime now no longer locks the app; saving keeps the open day; the side cannot be switched with unsaved edits; a night must be 1 to 23 hours and its changes inside it; Skip applies to both linked sides; filled buttons are grey. **Updates:** however an update ends, the server is started and the internet block is put back; downloads time out; DNS replies over TCP can no longer open a connection. **Docs:** CONTRIBUTING.md, a test-report template, notices where a Pod 3 or 4 differs, and what going back to Eight Sleep involves. |
| [#76](https://github.com/jalen-cheng/free-sleep/pull/76) | Design | Every tab has the same width and its heading in the same place. The schedule's save bar has one Save button; copying a night to other days is the copy button's job, with a tidier day picker. Sliders are drawn like the dial. |
