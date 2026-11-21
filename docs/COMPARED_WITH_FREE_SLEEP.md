# SevenSleep compared with Free Sleep

SevenSleep is built on [Free Sleep](https://github.com/throwaway31265/free-sleep) by
throwaway31265, and keeps everything it does. This page is for someone already running Free
Sleep: what you gain by switching, how to switch, and how to go back if you change your mind.

Switching takes a few minutes over SSH with the hub closed, keeps your settings and schedules,
and is undone with one command.

## In short

| What you get | Free Sleep | SevenSleep |
|---|---|---|
| **Pod 5 side buttons** | Do nothing | Change the temperature, switch a side on or off, stop an alarm |
| **In-bed detection** (Pod 5) | None | Knows when you are in bed; can turn the bed on as you get in |
| **Autopilot** (Pod 5) | None | Cooler early in the night, warmer toward morning, learning from your changes |
| **A record of each night** (Pod 5) | None on a Pod 5 | Sleep and wake times, wake-ups and movement, checked against a watch through Apple Health |
| **Alarms** | Up to 3 minutes | Keep going until dismissed, ramp up, and can warm the bed first |
| **Both sides as one** | Each side set separately | Link them, and everything applies to both |
| **Accurate temperatures** | Evenly spaced levels | What the bed actually aims for, beside what it measures |
| **Getting to the app** | An IP address and port | `http://sevensleep.local`, an app icon on your phone, and Tailscale for away from home |
| **Staying offline** | The block can stop the clock syncing | Time sync keeps working, and the block is restored at every boot |
| **Updates** | Over SSH | From the app, with the old version put back if one fails |
| **Automation** | The general API | A fully documented API, short requests for Shortcuts, and an MCP server for AI agents |

Compared against Free Sleep 3.0.3, the version SevenSleep branched from, which is its latest.

## What is different

### Using the bed

| | Free Sleep | SevenSleep |
|---|---|---|
| Temperatures | Levels spread evenly over 55 to 110°F | What the firmware aims for at each level, measured on a Pod 5 (50 to 108°F), shown beside the temperature the bed measures |
| Units | °F or °C | °F, °C, or Eight Sleep's -10 to +10 |
| Both sides | Set separately | Can be linked: temperature, power, schedules, buttons and shortcuts apply to both |
| A night's schedule | On and off times, temperature changes and an alarm, set separately | One list per night: bed-on time, temperature changes, wake-up time. The bed turns itself off 30 minutes after you wake |
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

### Network and upkeep

| | Free Sleep | SevenSleep |
|---|---|---|
| Internet block | Also blocks DNS, which can stop the clock syncing | DNS, address requests and time sync keep working; restored at every boot; Eight Sleep's updater can be locked out |
| Address | An IP address and port | `http://sevensleep.local` at home |
| Away from home | None built in | Optional Tailscale on the Pod, with the block still on |
| Updates | From its own repository | From SevenSleep's; the app shows when one exists and puts the old version back if an update fails |
| Scripting | The general API | The same API documented in full, short requests for Shortcuts, and an MCP server for AI agents |
| Boot slots | Not handled | The installer confirms the running slot, so the hub does not fall back to its stock slot after a few boots |

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
whichever way it went. First-hand reports are what make this page better.

### Back to Eight Sleep

Leaving both projects is in [the install guide](../INSTALLATION.md#going-back-to-eight-sleep).
On a Pod 5 that path is in software and has not been run either.

## Worth knowing before you switch

- **It has been run on one Pod 5.** Pod 3 and Pod 4 use the original's hardware code, with the
  differences in [POD_MODELS.md](POD_MODELS.md), and are waiting for a first report. Pod 4 taps
  were reworked and have not been tried on a Pod 4.
- **Biometrics on a Pod 3 or 4 is the original's, untouched.** It appears as "Biometrics
  (legacy)". If you rely on it, it should carry on as it does now.
- **The bed turns off 30 minutes after your wake-up time.** There is no separate off time, so a
  schedule that turned off at an unrelated hour will change.
- **Daily priming is on by default,** at 2 PM. Switch it off in Settings if you prefer.
- **The autopilot is experimental** and off by default. Its evidence is one sleeper; its limits
  are in [AUTOPILOT.md](AUTOPILOT.md).
- **The Pod 5 sleep record is sleep and wake times,** judged by stillness. It has no sleep
  stages, heart rate, breathing or HRV.
- **The switch itself is new ground.** SevenSleep updates itself by running the same installer
  over an existing install, which works on a Pod 5, but nobody has yet reported switching from
  Free Sleep or back. Take the copy of your settings first, and say how it went.
- **It is one person's project and changes often.** Support is through
  [issues on GitHub](https://github.com/jalen-cheng/sevensleep/issues); Free Sleep has its Discord.
