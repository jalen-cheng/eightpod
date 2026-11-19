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

1. In **Shortcuts**, tap **+** and add **Find Health Samples**: Type is **Sleep**, Start Date is
   in the last 1 day.
2. Add **Repeat with Each** over the samples. Inside it add a **Text** action holding
   `{"start":"Start Date","end":"End Date","value":"Value"}`, picking each from **Repeat Item**,
   with the two dates set to **ISO 8601**.
3. After the repeat, add **Combine Text** on the Repeat Results, with a comma as the separator.
4. Add a **Text** action holding `{"source":"Apple Health","samples":[Combined Text]}`, with
   Combined Text picked from the step before.
5. Add **Get Contents of URL** with `http://sevensleep.local/api/autopilot/sleepTimes`, Method
   **POST**, a header `Content-Type: application/json`, Request Body **File**, and that Text as
   the file. If your Pod has another name or you use its IP address, put that in place of
   `sevensleep.local`: it is the address the app opens at.
6. In **Automation**, run it when your **Sleep Focus turns off**, or at a set time each morning.

Run it once by hand to check it: the Shortcut's result shows how many sleeps were read and how
many saved stays in bed they matched, and **Settings > Autopilot** then shows "Apple Health,
last received" with today's date.

Once set up it runs by itself, with one catch: an iPhone only lets a shortcut read health data
while it is unlocked, so the night arrives when you first use the phone, not at a fixed minute.
That is fine here: it is looked at after the fact.

Not yet run with a real tracker or phone.

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
