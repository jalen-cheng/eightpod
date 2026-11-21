# SevenSleep compared with Free Sleep

SevenSleep is a fork of [Free Sleep](https://github.com/throwaway31265/free-sleep) by
throwaway31265. This page is for someone already running Free Sleep who is deciding whether to
switch. It says what is different, what is worse or unproven here, and how to go back.

Compared against Free Sleep 3.0.3 (its `main` as of 4 October 2026), which is the commit
SevenSleep branched from. Free Sleep has not changed since; if it has by the time you read this,
check its repository.

## In short

| | Free Sleep | SevenSleep |
|---|---|---|
| Runs on | Pod 3, Pod 4 and Pod 5, by its README, with a community using it | **One Pod 5**, by one person. Never run on a Pod 3 or 4 |
| Support | An active Discord | Issues on GitHub |
| Sleep data on a Pod 3 or 4 | Biometrics: heart rate, breathing, sleep | The same code, unchanged and untested here, named "Biometrics (legacy)" |
| Pod 5 | Controls work; side buttons and bed sensors unused | Side buttons, in-bed detection, a record of each night, an autopilot |
| Pace | Stable | Changes often |

**Stay on Free Sleep if** you have a Pod 3 or Pod 4 and it works, you rely on its biometrics, or
you want software other people have run on your model.

**Consider SevenSleep if** you have a Pod 5, or you want the changes below and are willing to be
the first to run it on your model and report back.

Switching is done over SSH with the hub closed, keeps your settings and schedules, and is undone
with one command. [Switching and going back](#switching-and-going-back) has both.

## What is different

### Using the bed

| | Free Sleep | SevenSleep |
|---|---|---|
| Temperatures | Levels spread evenly over 55 to 110°F | What the firmware aims for at each level, measured on a Pod 5 (50 to 108°F), shown beside the temperature the bed measures |
| Units | °F or °C | °F, °C, or Eight Sleep's -10 to +10 |
| Both sides | Set separately | Can be linked: temperature, power, schedules, buttons and shortcuts apply to both |
| A night's schedule | On and off times, temperature changes and an alarm, set separately | One list per night: bed-on time, temperature changes, wake-up time. **No off time of your own:** the bed turns off 30 minutes after the wake-up time |
| Turning on by hand | Stays on 12 hours | 3, 6 or 12 hours, and can keep the schedule away meanwhile |
| Left and right | As the firmware has them | Can be flipped in Settings |
| The app | The original design | Redesigned, phone-first, installs to the Home Screen |

### Alarms

| | Free Sleep | SevenSleep |
|---|---|---|
| Length | Up to 3 minutes | Until dismissed, for 10 to 30 minutes |
| Ramp-up on a Pod 5 | One steady strength | A real ramp: 20, 40, 60, 80%, then full |
| Before the alarm | Nothing | Optional warm-up to a chosen temperature, 15 to 45 minutes before |
| One-time alarm | Overrides tonight's alarm | Replaces that morning's alarm, goes off even if the bed is off, and the bed stays on for it |
| Two sleepers | Dismissing one stops both | The other side's alarm starts again |
| Snooze | A setting that was stored and never acted on | Removed |

### Pod 5 only

| | Free Sleep | SevenSleep |
|---|---|---|
| Side buttons | Do nothing | + and - change the temperature, the middle button switches the side, any button stops an alarm |
| In-bed detection | None | Knows when someone is in bed, and tells a body from a thing left on it. Can turn the bed on when you get in and vibrate after a long sleep |
| Sleep record | Biometrics cannot read a Pod 5's sensors | Sleep and wake times, wake-ups and movement for each night, judged by stillness. Checked against a watch on one sleeper (n=1): 73% and 82% of minutes agreed on two nights |
| Autopilot | None | Experimental: cooler early in the night, warmer toward morning, one degree at a time, learning from the changes you make. Off by default |

Not in SevenSleep's sleep record: sleep stages, heart rate, breathing or HRV. The estimates
were unreliable on a Pod 5 and are switched off.

### Network and upkeep

| | Free Sleep | SevenSleep |
|---|---|---|
| Internet block | Also blocks DNS, which can stop the clock syncing | DNS, address requests and time sync keep working; restored at every boot; Eight Sleep's updater can be locked out |
| Address | An IP address and port | `http://sevensleep.local` at home |
| Away from home | None built in | Optional Tailscale on the Pod, with the block still on |
| Updates | From its own repository | From SevenSleep's; the app shows when one exists and puts the old version back if an update fails |
| Scripting | The general API | The same API documented in full, short requests for Shortcuts, and an MCP server for AI agents |
| Boot slots | Not handled | The installer confirms the running slot, so the hub does not fall back to its stock slot after a few boots |

## What is worse or unproven here

- **Nothing has been run on a Pod 3 or Pod 4.** The hardware paths are the original's, with the
  differences listed in [POD_MODELS.md](POD_MODELS.md), but nobody has installed it on one.
- **Pod 4 taps are unverified.** They were reworked here and never tried on a Pod 4.
- **Switching from Free Sleep has not been tested** on any Pod, and neither has going back.
  SevenSleep's own updates run the same installer over an existing install, which is tested on a
  Pod 5.
- **You lose the off time.** If your schedule turns the bed off at a time unrelated to your
  wake-up time, SevenSleep will move it to 30 minutes after wake-up.
- **Daily priming is on by default** at 2 PM. Free Sleep has it off.
- **The autopilot's evidence is one sleeper on one Pod 5.** Its limits are in
  [AUTOPILOT.md](AUTOPILOT.md).
- **It moves fast.** Dozens of versions in a week, by one person. An independent review before
  3.25 found eight real defects in recent changes; they are fixed, but expect more.

Everything known to be rough is listed in
[HOW_IT_WORKS.md](HOW_IT_WORKS.md#16-known-rough-edges).

## Switching and going back

Both directions are done over SSH (`ssh root@<pod-ip> -p 8822`), with no cable and the hub
closed. The folder, the services and the `fs-` commands keep the name `free-sleep` under both
projects, which is what makes it a switch in place.

### Before either

Keep a copy of your settings and schedules. It is small, and it is the way back if a switch goes
wrong:

```
cp -r /persistent/free-sleep-data/lowdb /persistent/free-sleep-data/lowdb.before-switch
```

### From Free Sleep to SevenSleep

Read [what changes for a Pod 3 or 4](POD_MODELS.md#things-to-know-before-updating-from-the-original)
first.

1. Lift the internet block, if you turned it on:
   ```
   sh /home/dac/free-sleep/scripts/unblock_internet_access.sh
   ```
2. Run SevenSleep's installer over the existing install. It takes several minutes and ends with
   `Installation complete!`:
   ```
   /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/jalen-cheng/sevensleep/main/scripts/install.sh)"
   ```
3. Block the internet again:
   ```
   sh /home/dac/free-sleep/scripts/block_internet_access.sh
   ```
4. Open `http://<pod-ip>:3000`. The **Status** page shows the version.

### From SevenSleep back to Free Sleep

1. If you switched on a watchdog, take it out, since its timer points at a script Free Sleep
   does not have:
   ```
   sh /home/dac/free-sleep/scripts/setup_watchdog.sh remove
   ```
2. Lift the internet block:
   ```
   sh /home/dac/free-sleep/scripts/unblock_internet_access.sh
   ```
3. Update from the original project. This also makes it the source of later updates:
   ```
   FREE_SLEEP_REPO=throwaway31265/free-sleep sh /home/dac/free-sleep/scripts/update.sh
   ```
4. Block the internet again, with Free Sleep's own script, now in the same place:
   ```
   sh /home/dac/free-sleep/scripts/block_internet_access.sh
   ```

**What going back leaves behind,** all harmless:

- The Pod's name on your network (`sevensleep.local`), and Tailscale if you set it up. Remove
  Tailscale with `setup_tailscale.sh remove` before step 3 if you do not want it.
- Settings Free Sleep does not know (the autopilot, in-bed detection, linked sides). They stay
  in the file and are not used.
- The saved nights under `/persistent/free-sleep-data/autopilot_nights/`. Delete the folder if
  you want the space.
- The lock on Eight Sleep's updater, if you switched it on. You want that under either project.

If Free Sleep does not start after going back, put your copy of the settings in place and
restart:

```
cp -r /persistent/free-sleep-data/lowdb.before-switch/. /persistent/free-sleep-data/lowdb/
```

```
systemctl restart free-sleep
```

If you make either switch, please [say how it went](https://github.com/jalen-cheng/sevensleep/issues),
whichever way it went. It is the one thing on this page nobody has done yet.

### Back to Eight Sleep

Leaving both projects is in [the install guide](../INSTALLATION.md#going-back-to-eight-sleep).
On a Pod 5 that path is in software and has not been run either.
