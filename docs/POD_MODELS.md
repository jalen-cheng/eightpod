# Pod 3, Pod 4 and Pod 5

Free Pod was built and tested on **one Pod 5**. It runs the same code on a Pod 3 and a Pod 4, and
it has **not been run on either**. This page is what a code review against the original project
([throwaway31265/free-sleep](https://github.com/throwaway31265/free-sleep)) found on 17 Nov 2026:
what should behave as it did there, what was changed on purpose, and what nobody has checked.

If you try it on a Pod 3 or 4, the installer keeps your previous install and puts it back if the
new one fails, and `FREE_SLEEP_REPO=throwaway31265/free-sleep sh /home/dac/free-sleep/scripts/update.sh`
takes you back to the original. Like every update, that ends with the internet block switched on.
Two limits: the app's "update available" notice always compares with Free Pod's own repository,
so after going back it is not meaningful, and the original project's installer does not keep the
saved-source file, so its own update script then decides where updates come from.

## What works on which Pod

| Feature | Pod 3 | Pod 4 | Pod 5 |
|---|---|---|---|
| Install, start-up, talking to the firmware | Same code as the original | Same code as the original | Tested |
| Setting temperature and power | Same commands as the original; the °F and °C shown differ (below) | Same | Tested |
| Weekly schedule | Changed for every model (below) | Same | Tested |
| Alarm, vibration | The firmware's own patterns, as the original sent them; can now run up to 30 minutes | Same | Tested, with a stepped ramp-up |
| Dismissing an alarm | From the app or a shortcut | App, shortcut, or four taps | App, shortcut, or any button |
| Taps (Pod 4) / buttons (Pod 5) | None: a Pod 3 has no tap sensors | Double and triple tap: cooler and warmer. Four taps: changed (below) | -, + and middle buttons |
| Linked sides, one-time alarm, warm-up, shortcuts | Not model-specific | Not model-specific | Tested |
| In-bed detection and its actions | Not available: needs sensor data only a Pod 5 was seen to publish. The section is hidden | Same | Detects one person on the test Pod; the actions have not fired there yet |
| Sleep tracking (Biometrics) | Code unchanged from the original | Code unchanged from the original | Does not work: this firmware publishes sensor data elsewhere |
| Internet block, updater lock-out | Not tested on this model | Not tested on this model | Tested |
| `.local` name, Tailscale on the Pod | Not tested; both need parts of the system a Pod 3 or 4 may lack | Same | Tested |

"Same code as the original" means the review found no change in that path. It is not a test.

## Differences from the original that affect a Pod 3 or 4

### Things to know before updating from the original

- **Temperatures are shown on a curve measured on a Pod 5.** Level 0 shows as 81°F instead of
  83°F, and the range is 50 to 108°F instead of 55 to 110°F. The command sent to the bed is still
  a level from -100 to 100. Whether a Pod 3 or 4 aims for the same temperatures at each level is
  not known; running `biometrics/temperature_calibration/collect_temperature_calibration.py` on
  one would show it (that script needs the firmware to publish its targets, as the Pod 5's does).
- **Saved schedules are converted once** so each temperature keeps meaning the same level. Because
  temperatures are stored as whole degrees, a few move by up to 2 levels out of 200. The original
  file is kept as `schedulesDB.before-measured-temperatures.json`.
- **The off time is no longer chosen.** The bed turns off 30 minutes after the wake-up time (the
  alarm's time). On the first start, a night with an alarm gets a new off time from its alarm, and
  a night without one keeps its off time. Sleep analysis runs at the off time, so it moves too.
- **A night's schedule switch now covers its temperature changes.** In the original, temperature
  changes still ran with the power schedule off.
- **The daily reboot follows its own switch.** In the original it only ran while daily priming
  was on. If "Reboot once a day" is on and priming is off, the Pod now reboots daily, an hour
  before the priming time.
- **Error reporting is off.** The original sent reports to its own Sentry project when enabled; Free Pod has no destination built in.

### Pod 4 taps

- **Double and triple tap** change the temperature as before. Several taps in a row now each
  count (up to three per half second); the original acted once however many there were.
- **Four taps are new behaviour.** The original ignored them. Here they dismiss a vibrating alarm,
  and at other times switch the side on or off. Settings > Tap gestures can set "at other times"
  to do nothing.
- **Tap settings are one set for both sides**, where the original kept them per side.
- **The firmware is asked for its status every half second** instead of every two seconds, so taps
  feel immediate. If a Pod 4 misbehaves, set `GESTURE_POLL_INTERVAL_MS=2000` in the service's
  environment to get the original rate back.
- Snooze is gone. The original stored a snooze setting and never acted on it.

### Alarms on a Pod 3 or 4

- A "Ramp up" alarm sends the firmware's own `rise` pattern at the strength you set, exactly as
  the original did. **The stepped ramp (20, 40, 60, 80%, then full) is used on a Pod 5 only**,
  where the firmware's `rise` was felt to be flat. Whether a Pod 3 or 4's `rise` ramps by itself
  is not known.
- An alarm longer than three minutes is sent as several three-minute stretches, one after another.
  This has only been felt on a Pod 5.
- Dismissing assumes the firmware's stop command stops both sides, as it does on a Pod 5: with
  the sides not linked, the other side's alarm is started again. If a Pod 3 or 4 only stops the
  one side, the other side's alarm simply restarts.

### Installer and scripts

- The installer gives the server permission to read the firmware's log (how Pod 5 buttons are
  read) only where the system has the group that allows it. On a system without it, nothing else
  is affected.
- The internet block treats the IPv6 rules as best-effort: if a Pod has no IPv6 firewall, the IPv4
  block is still saved and restored at boot, and a warning is printed.
- The `.local` name is switched on only if the system runs `systemd-resolved`; otherwise the
  installer skips it.

## Not known

- Whether the Pod 5 temperature curve matches a Pod 3 or 4.
- How a Pod 3 or 4's firmware behaves when a new stretch of an alarm is sent as the previous one ends.
- Whether the half-second status polling suits a Pod 4's firmware.
- Whether a Pod 3 or 4's system image has the IPv6 firewall, `systemd-resolved` and NetworkManager.

Reports from a Pod 3 or 4 are welcome as issues on [this repository](https://github.com/jalen-cheng/free-sleep/issues).
