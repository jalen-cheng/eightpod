# Autopilot (Pod 5, experimental)

Off by default. Switch it on in **Settings > Autopilot > Adjust the temperature while I sleep**.
While someone is asleep, it moves their side a few degrees around the temperature the schedule
(or they) set. It never moves more than 4°F from that temperature, changes at most once every
10 minutes, and does nothing while the sleeper is awake, the side is off, away mode is on, the
wake-up heat is running, or a temperature set by hand is holding the schedule back.

**Not yet run through a night.** Sleep detection, naps, the temperature changes, the learning
and the fitting to a sleep tracker are covered by tests on made-up nights only.

## What it does

| Part | What happens | Size |
|---|---|---|
| Night curve | Cooler from falling asleep through the first half of the night, back to the set temperature by about 85% of the way to the wake time, then a little warm | -2°F, then 0, then +1°F |
| First sleep cycle | A little cooler from 20 to 90 minutes after falling asleep, where most deep sleep usually falls. Deep sleep itself is not detected | -1°F |
| Your changes | A change you make with the app or the side buttons is kept in full for that third of the night, and half of it is remembered for the same third of later nights | up to ±3°F learned |
| The room | The air at the cover is compared with what it was when you fell asleep: a room that warms cools the bed, and the other way round. A clear drift of the mattress surface adds a degree | ±2°F at most |

The night runs from falling asleep to that night's wake-up time (8 hours if the night has no
schedule). The base temperature is the schedule's: the bed-on temperature, then each scheduled
change as it comes up. A scheduled change is applied straight away, with the offset on top.

## How it tells you are asleep

By stillness alone, the way a wrist tracker's movement sensor does. The cover's piezo sensor
(500 readings a second per side, on the firmware's sensor bus) feels movement; each minute is
summed up as a count of seconds with movement, and two rules decide the state
(`server/src/autopilot/sleepTracker.ts`):

- **Asleep:** in bed and still for 15 minutes in a row. Sleep is counted from when the
  stillness began, not from when it was believed.
- **Awake again:** 3 minutes out of 5 with 12 or more moving seconds each. A turn in bed, or
  two, is not waking.

A heart rate is still read from the same sensor and shown, but decides nothing: its error of a
few beats a minute is as large as the drop that falling asleep causes. Deep sleep is not
detected either; the extra degree of cooling goes by the clock, over the first sleep cycle.
Lying awake and still reads as asleep, which is the known weak point of judging by movement.

**Breathing.** Each breath is a slow swell in the piezo signal, far larger than a heartbeat.
Every 10 seconds the last 30 are averaged down to 10 readings a second, drift and heartbeats
are taken out (which leaves roughly 0.13 to 0.5 Hz), and the rate is the shift at which that
slow signal best matches itself, between 8 and 30 breaths a minute
(`server/src/autopilot/breathingRate.ts`). Each minute's rate and how far its readings were
apart are saved with the night and shown. The method follows the published recipe for an
under-mattress piezo sensor (band-pass about 0.1 to 0.7 Hz, then count the breaths: Dozee,
Sci Rep 2026;16:4340, 1.3 breaths a minute average error against capnography over a 120-second
window) with a shorter window. On two minutes of real signal from this Pod it settled at 17 to
18 breaths a minute once the sleeper lay still; that is a plausible figure, not a checked one,
as nothing measured the true rate.

Breathing is steadier asleep than awake (in a lab, its variation in deep sleep is about half
that in REM, and higher again awake: Rostig et al., Sleep 2005), but no paper gives a line
between the two for a bed sensor. So steady breathing is not asked for by default. It is one of
the things calibration against a sleep tracker tries, and it is switched on only when it brings
the bed's sleep times closer to the tracker's. That is the case it should help with: lying
awake and still.

**Getting up in the night.** Less than 30 minutes out of bed is the same night: the curve
carries on from where it was when you return and are asleep again.

**Naps.** A sleep of under 3 hours is a nap; that is how saved sleeps are sorted. But nobody
knows how long a sleep will last when it begins, and the autopilot should not start a night's
curve on a nap. So at the start it goes by when the sleep began:

1. against when you have actually been falling asleep and waking, from your newest 14 saved
   nights (once there are 3). The schedule's times are when the bed runs, not when you sleep;
2. with too few saved nights, against the schedule's bedtime and wake-up time;
3. with neither, by the hour: between 9:00 and 19:00 looks like a nap.

A sleep that begins up to 3 hours before your usual time, or any time until your usual waking,
is steered from the start. Any other is left alone, and if it is still going after 3 hours it
was not a nap after all and the autopilot takes over from there. Naps are saved like nights.

**Two people in the bed.** A side is only followed while its in-bed sensor says someone is
there. Whether one sleeper's turning or breathing reads on the other side has not been checked.

## Linking a sleep tracker

The bed's numbers (15 still minutes, 12 moving seconds, breathing not asked for) are guesses. A
watch or band knows better when you slept, so its times can be sent each morning and the bed
fits its numbers to them.

**iPhone only.** Apple Watch and Whoop write sleep to Apple Health, and Fitbit devices
(including the Fitbit Air) do through the Google Health app's Apple Health connection. Apple
Health has no web address a Pod could ask: only something on the phone can read it. Once set
up, either of these then runs by itself every day:

- **An app, no Shortcut.** The paid iPhone app Health Auto Export posts Apple Health data on a
  schedule. Add a REST API automation for Sleep Analysis, with the address
  `http://eightpod.local/api/autopilot/sleepTimes?side=left` (or `right`). The bed reads the
  app's own format. iOS decides when background apps run, so the time it arrives varies.
- **A Shortcut with an automation.** **Settings > Autopilot > Sleep tracker > Link** has the
  steps. Set the automation to run when your Sleep Focus turns off, or at a set time.

**Android is not supported.** Health Connect has no route built here. Apps that post Health
Connect data to an address exist (HC Webhook, HCGateway) but the bed does not read their
formats; a script that sends the request below would work.

```bash
curl -X POST http://eightpod.local/api/autopilot/sleepTimes -H 'Content-Type: application/json' \
  -d '{"side":"left","source":"Whoop","asleepAt":"2026-11-18T23:12:00-08:00","awakeAt":"2026-11-19T06:48:00-08:00"}'
```

Each sleep sent is filed with the saved stay in bed it overlaps. Once 3 nights have tracker
times, the bed replays its saved minutes for the newest 14 such nights under each candidate set
of numbers and keeps the set whose sleep and wake times land closest. It does this again every
time new times arrive. **Data > Nights** shows each night's times beside the tracker's and the
numbers in use. Naps are filed but not used for fitting. Only sleep and wake times are used,
not sleep stages.

There is no direct Whoop or Fitbit link. Their data is only on their servers, so the Pod would
need a developer app registered with each company, a sign-in, and a hole in its internet block.
The phone already has the data, so the phone sends it.

Not yet run with a real tracker or phone: both routes and the fitting were checked only by
tests, the app's format from its documentation.

## Where nights are kept

Every stay in bed of 20 minutes or more is saved on the Pod, whether or not the autopilot is
switched on, as one file in `/persistent/free-sleep-data/autopilot_nights/`: a row per minute
(moving seconds, heart rate, breathing rate and spread, state, the autopilot's offset, room
temperature), the bed's sleep and wake times, and the tracker's if any were sent. A night is
about 40 KB. The newest 180 files are kept (three months for two sleepers), about 7 MB of the
Pod's 14 GB free. An open stay is written every 10 minutes, so a restart loses at most that,
and starts a new file.

**Data > Nights** lists them with the tuning for each side, and **Export** downloads everything
(every night with its minute rows, the sleep rules, what was learned) as one JSON file.
`GET /api/autopilot/nights` and `GET /api/autopilot/nights/export` return the same. The
biometrics service keeps its own sleep records in its database; these files are separate and do
not need it.

## Why the curve has this shape

- **Cooler early.** Taking heat from the body by conduction raised deep sleep in crossover
  trials: Kräuchi et al. 2018 (Physiol Behav 185:23, +16% slow-wave sleep) and Herberger et al.
  2024 (Sci Rep, +7.5 minutes of N3 and a 2.4 bpm lower heart rate). A trial paid for by Eight
  Sleep found the same with a cooler first half of the night (Moyen et al. 2024, Bioengineering
  11:352).
- **Back to the set temperature late.** The body regulates its temperature poorly in REM sleep,
  which fills the late night, and both heat and cold then cost sleep (Okamoto-Mizuno and Mizuno
  2012, J Physiol Anthropol 31:14).
- **A degree warm at the end.** Mild skin warming cut early-morning waking (Raymann, Swaab and
  Van Someren 2008, Brain 131:500).

None of these papers gives a setting in degrees for a water-cooled cover. The sizes are small on
purpose, and your own changes reshape them.

## Seeing what it does

Settings > Autopilot shows each side's state beside the heading and, while someone is in bed,
their heart rate and the last change with its reasons, and which sleep tracker is linked. `GET /api/autopilot` returns the same
(see [server/API.md](../server/API.md#autopilot)), and the server log has a line for every
change. What it has learned is kept in `/persistent/free-sleep-data/autopilot_state.json`;
delete the file and restart EightPod to forget it.

## Code

`server/src/autopilot/`: `heartRate.ts` and `breathingRate.ts` (the estimates), `sleepTracker.ts`
(the rules, and fitting them to a tracker), `nightPlan.ts` (curve, learning, room, limits), `scheduledBase.ts`
(the schedule's temperature at a time; night or nap), `nightLog.ts` (the saved nights),
`autopilotMonitor.ts` (state, and the only file that touches the Pod). The first five are pure
and tested in `tests/autopilot.test.mjs`.
