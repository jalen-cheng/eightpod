# Connections

What can be linked to the bed from outside. For now that is one thing: last night's sleep from
a watch or band, by way of Apple Health, which the [autopilot](AUTOPILOT.md) uses to tune how
it judges sleep. Controlling the bed from Shortcuts, Home Assistant or a script is covered in
[iPhone Shortcuts](IOS_SHORTCUTS.md) and the [API](../server/API.md).

## Link Apple Health

**iPhone only.** Apple Watch and Whoop write sleep to Apple Health, and Fitbit devices
(including the Fitbit Air) do through the Google Health app's Apple Health connection, which
lists sleep sessions and stages among what it writes. Apple Health has no web address a Pod
could ask: only something on the phone can read it. So the link is an iPhone Shortcut, run by
an automation each morning.

### Add the ready-made Shortcut

1. On the iPhone, open **[Send sleep to SevenSleep](https://github.com/jalen-cheng/sevensleep/raw/main/docs/shortcuts/Send%20sleep%20to%20SevenSleep.shortcut)**, tap the download in Safari, and
   tap **Add Shortcut**.
2. It asks two things: your Pod's address at home (leave `http://sevensleep.local` unless your
   Pod has another name), and the name of your home Wi-Fi, exactly as the phone shows it.
3. At home, tap the Shortcut once to run it. The first run asks to read Sleep from Health, to
   send the health samples to your Pod, and to show notifications: allow each (**Always Allow**
   for the samples, or it asks every time).
4. A notification from SevenSleep says what happened, for example "1 sleep received from Apple
   Health. Matched 1 stay in bed." **Data > Sleep** then shows the tracker's times on that night.

**It only sends on your home Wi-Fi.** The Pod's home address works nowhere else, so on any other
network the Shortcut sends nothing and says so ("Not on Home (this phone is on Cafe), so no
sleep was sent."). That makes it safe to run every day without thinking about where you are.

**Make it run by itself.** In **Shortcuts > Automation**, add both of these, each set to **Run
Immediately** and running this Shortcut:

- **Wi-Fi**: when the iPhone joins your home network. This sends the night whenever you come home.
- **Time of Day**: once a day, at a time you are usually up and at home. This covers the days the
  phone never leaves the house.

Sending the same night twice changes nothing. An iPhone only lets a Shortcut read health data
while it is unlocked, so a run that comes while the phone is locked waits until you next use it.

It reads the Sleep samples that began in the last two days and sends each one's start, end and
stage.

| What you see | What it means |
|---|---|
| "No sleep found in what Apple Health sent" | The Shortcut reached the Pod, and Health has no sleep for the last two days. Look in **Health > Browse > Sleep**: if last night is not there, your tracker's app is not writing sleep to Apple Health |
| "Not on …, so no sleep was sent" | The phone is not on the Wi-Fi named when the Shortcut was added. If it is, the name does not match: fix it in the Shortcut's second action |
| "Could not connect to the server", or the address not found | The phone cannot reach the Pod. Allow Shortcuts under **Settings > Privacy & Security > Local Network**, or put the Pod's IP address in the Shortcut's first action |
| "…received… No stay in bed saved on the Pod overlaps it" | The sleep arrived, but the Pod has no saved stay for those hours. It saves stays of 20 minutes or more, and only while a person is on the bed |
| Nothing at all | Notifications for Shortcuts are off: **Settings > Notifications > Shortcuts** |

The file is made by `scripts/build_shortcuts.py`, with every action written the way working
exported shortcuts write it, and signed with `shortcuts sign` on a Mac. It was added and run in
Xcode's iPhone simulator (iOS 27.2) with two sleep entries in Health: every action came in
complete, and both of its paths did what they should (sending what the Pod expects; saying so
and sending nothing). One step could not run there: the simulator has no Wi-Fi, so reading the
Wi-Fi's name was stood in for by hand. **That step has not yet run on a real phone.** The
version before it, without the Wi-Fi check, has run on a real iPhone against a real Pod. The
by-hand version below has not been run at all.

### Or build it by hand

The same actions, in order:

1. **Text**: `http://sevensleep.local` (or your Pod's address at home).
2. **Text**: the name of your home Wi-Fi.
3. **Get Network Details**, left on Wi-Fi and Network Name, then **If** Network Details **is**
   the Text from step 2. Everything in steps 4 to 7 goes inside the If.
4. **Find Health Samples** where **Type** is **Sleep** and **Start Date** is in the last 2 days.
5. **Repeat with Each** over the Health Samples. Inside it:
   - **Get Details of Health Sample**: **Start Date** of Repeat Item, then **Format Date** on
     it with **ISO 8601** and **Include ISO 8601 Time** on.
   - The same two actions for **End Date**.
   - **Get Details of Health Sample**: **Value** of Repeat Item.
   - **Text**: the first Formatted Date, `|`, the second Formatted Date, `|`, the Value.
6. After **End Repeat**, **Get Contents of URL**: the Text from step 1 followed by
   `/api/autopilot/sleepTimes`, Method **POST**, Request Body **JSON** with two text fields,
   `source` = `Apple Health` and `samples` = **Repeat Results**.
7. **Get Dictionary Value** for `message` in the Contents of URL, and **Show Notification**
   with it.
8. Under **Otherwise**, a **Show Notification** saying nothing was sent.

## Without a tracker

**Data > Sleep > Set when you slept** takes the time you fell asleep and the time you woke for
the stay shown. It is filed the way a tracker's record is, under "You", and counts toward the
same 5 nights. A tracker that reports the same night later replaces it.

## Other Shortcuts

Ready-made Shortcuts for the bed itself (its temperature, an alarm, its status, turning it off,
away mode, opening the app) come in two kinds, for use at home and for use anywhere through
Tailscale. They are listed in [iPhone Shortcuts](IOS_SHORTCUTS.md#ready-made-shortcuts).

## Other trackers, Android and scripts

There is no direct Whoop or Fitbit link: their data is on their servers, and the phone already
has it in Apple Health.

**Android is not supported.** Health Connect has no route built here. Apps that post Health
Connect data to an address exist (HC Webhook, HCGateway), but the bed does not read their
formats.

Any script that sends this request works, from any device:

```bash
curl -X POST http://sevensleep.local/api/autopilot/sleepTimes -H 'Content-Type: application/json' \
  -d '{"source":"Whoop","asleepAt":"2026-11-18T23:12:00-08:00","awakeAt":"2026-11-19T06:48:00-08:00"}'
```

Times have to say their zone (`-08:00`, or `Z`); one without is refused.

## What the bed does with it

Each sleep is filed with every saved stay in bed it overlaps (a night split in two by a restart
gets both halves). Sending the same night again, or a corrected version of it, replaces what
was there. Sleeps in the future, older than 100 days or longer than 18 hours are refused.

**Fitting.** The bed's own numbers (15 still minutes, 12 moving seconds, breathing not asked
for) are guesses, and a watch or band is the better judge of when you slept. When the tracker's
record says when you were awake in the night, that is used, not only when you fell asleep and
woke: the bed's saved minutes are replayed under each candidate set of numbers and scored on
how many minutes they disagree with the tracker. That is what lets it learn about lying awake
at 3 am. It needs 5 nights. A fitted set is only taken up if, fitted to all the nights but one
and tried on that one, it does at least a tenth better than the default; otherwise the default
stays. **Data > Sleep** shows the result: "Tuned to Apple Health: 94% match over 6 nights", or
"Default, checked against…" while it is not.

Naps are filed but not used for fitting, and sleep stages are not used at all. A wrist tracker
is treated here as the reference. It is not a sleep lab: in comparisons with one, wrist devices
find sleep well and miss some quiet waking (Fitbit Sense and Charge 5: about 93% of sleep and
48% of waking found; no such test of the Fitbit Air was found).
