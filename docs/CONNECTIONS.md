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

1. On the iPhone, open **[Send sleep to SevenSleep](https://github.com/jalen-cheng/sevensleep/raw/main/docs/shortcuts/Send%20sleep%20to%20SevenSleep.shortcut)**, tap the download in
   Safari, and tap **Add Shortcut**.
2. It asks for your Pod's address: `http://sevensleep.local` at home, or
   `http://sevensleep:3000` if the phone reaches the Pod over Tailscale. Use your Pod's own
   name if it has another.
3. Tap the Shortcut once to run it. The first run asks to read Sleep from Health, to send the
   health samples to your Pod, and to show notifications: allow each (**Always Allow** for
   the samples, or it asks every morning).
4. A notification from SevenSleep says what happened, for example "1 sleep received from Apple
   Health. Matched 1 stay in bed." **Settings > Autopilot** then shows "Apple Health, last
   received" with today's date.
5. In **Automation**, run it when your **Sleep Focus turns off**, or at a set time each
   morning, with **Run Immediately**.

It reads the Sleep samples that began in the last two days and sends each one's start, end and
stage. Sending a night twice changes nothing.

| What you see | What it means |
|---|---|
| "No sleep found in what Apple Health sent" | The Shortcut reached the Pod, and Health has no sleep for the last two days. Look in **Health > Browse > Sleep**: if last night is not there, your tracker's app is not writing sleep to Apple Health |
| "Could not connect to the server", or the address not found | The phone cannot reach the Pod. Be on the same Wi-Fi, allow Shortcuts under **Settings > Privacy & Security > Local Network**, or put the Pod's IP address in the Shortcut's first action |
| "…received… No stay in bed saved on the Pod overlaps it" | The sleep arrived, but the Pod has no saved stay for those hours. It saves stays of 20 minutes or more, and only while a person is on the bed |
| Nothing at all | Notifications for Shortcuts are off: **Settings > Notifications > Shortcuts** |

The file is made by `scripts/build_shortcuts.py`, with every action written the
way working exported shortcuts write it, and signed with `shortcuts sign` on a Mac. It was run
in Xcode's iPhone simulator (iOS 27.2) with two sleep entries added in Health: every action
came in complete, and it sent what the Pod expects. **It has not yet been run on a real phone
with a tracker's data**, and the by-hand version below has not been run at all.

Once set up it runs by itself, with one catch: an iPhone only lets a shortcut read health data
while it is unlocked, so the night arrives when you first use the phone, not at a fixed minute.
That is fine here: it is looked at after the fact.

### Or build it by hand

The same thirteen actions, in order:

1. **Text**: `http://sevensleep.local` (or your Pod's address).
2. **Find Health Samples** where **Type** is **Sleep** and **Start Date** is in the last 2 days.
3. **Repeat with Each** over the Health Samples. Inside it:
   - **Get Details of Health Sample**: **Start Date** of Repeat Item, then **Format Date** on
     it with **ISO 8601** and **Include ISO 8601 Time** on.
   - The same two actions for **End Date**.
   - **Get Details of Health Sample**: **Value** of Repeat Item.
   - **Text**: the first Formatted Date, `|`, the second Formatted Date, `|`, the Value.
4. After **End Repeat**, **Get Contents of URL**: the Text from step 1 followed by
   `/api/autopilot/sleepTimes`, Method **POST**, Request Body **JSON** with two text fields,
   `source` = `Apple Health` and `samples` = **Repeat Results**.
5. **Get Dictionary Value** for `message` in the Contents of URL, and **Show Notification**
   with it.

## Without a tracker

**Data > Sleep > Set when you slept** takes the time you fell asleep and the time you woke for
the stay shown. It is filed the way a tracker's record is, under "You", and counts toward the
same 5 nights. A tracker that reports the same night later replaces it.

## Other Shortcuts

Ready-made, each asking for the Pod's address when added: [Bed temperature](https://github.com/jalen-cheng/sevensleep/raw/main/docs/shortcuts/Bed%20temperature.shortcut),
[Bed alarm](https://github.com/jalen-cheng/sevensleep/raw/main/docs/shortcuts/Bed%20alarm.shortcut), [Bed status](https://github.com/jalen-cheng/sevensleep/raw/main/docs/shortcuts/Bed%20status.shortcut) and [Bed off](https://github.com/jalen-cheng/sevensleep/raw/main/docs/shortcuts/Bed%20off.shortcut). What each does is in
[iPhone Shortcuts](IOS_SHORTCUTS.md#ready-made-shortcuts).

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
