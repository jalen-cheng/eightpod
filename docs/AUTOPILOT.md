# Autopilot (Pod 5, experimental)

Off by default. Switch it on in **Settings > Autopilot > Adjust the temperature while I sleep**.
While someone is asleep, it moves the bed a few degrees around the temperature the schedule set.

**Not yet run through a night.** Everything here is covered by tests on made-up nights only.

## The rules it keeps

- **One sleeper, whole bed.** It takes the bed to be one sleeper's. Switching it on links the
  two sides, and unlinking them switches it off. Each side is still sensed and saved on its own.
- **Never more than 4°F** from the schedule's temperature, **one degree at a time**, at most one
  change every 10 minutes. When the schedule itself changes the temperature, the offset moves
  with it at once.
- **Your hand wins.** A temperature you set (app, side buttons, a request to the API) is held
  exactly as you set it, until the schedule's next change or the end of that third of the
  night, whichever comes first. The autopilot then carries on, a degree at a time.
- **It leaves alone** a side that is off (setting a temperature never switches one on), away
  mode, the wake-up heat, and a manual temperature that is holding the schedule back.
- **It cleans up.** When the bed has been empty for 30 minutes, or the autopilot is switched
  off mid-night, it takes its offset back out, unless you have set the temperature since.
- **A restart does not start the night over.** The night under way is saved; after an update
  or reboot it carries on from the same point if someone is still in bed.
- **Once the night has begun it runs by the clock.** Stirring for a few minutes does not send
  the bed back to the set temperature and down again.

## What adds up to the offset

| Part | What happens | Size |
|---|---|---|
| Your changes | How far a temperature you set was from what the autopilot wanted is partly remembered for that third of the night | 0.3 of it each time, up to ±3°F |
| Night curve | Cooler from falling asleep through the first half of the night, back to the set temperature by about 85% of the way to the wake time, then a little warm | -2°F, then 0, then +1°F |
| First sleep cycle | A little cooler from 20 to 90 minutes after falling asleep. Deep sleep itself is not detected | -1°F |
| The room | The air at the cover against what it was when you fell asleep: a room that warms cools the bed | half a degree per degree, ±2°F at most |

When these add up to more than 4°F, they are cut from the bottom of the table up, so what you
taught it is the last to go.

**Learning.** At 0.3, a one-degree change takes two nights that agree before it shows, and one
odd night fades. A change is counted once per hold, not once per button press. Any request that
sets the temperature counts as yours, including one from an automation of your own.

The night runs from falling asleep to that night's wake-up time (8 hours if the night has no
schedule). The base temperature is the schedule's: the bed-on temperature, then each scheduled
change as it comes up. At an hour the schedule does not cover, it is the temperature the bed
was at when you fell asleep.

**If your schedule already cools early and warms late,** the curve adds to that. Your own
changes will pull it back over a few nights, but the simpler fix is a flat schedule.

## How much of this is evidence

Less than the first version of this page claimed. The studies show that taking heat from the
body in sleep can change sleep; none tested this curve, these sizes, or a water-cooled cover
set in degrees.

| Study | What it found | What it does not show |
|---|---|---|
| Kräuchi et al. 2018, Physiol Behav 185:23 | 15 young men, randomised crossover, a passive mattress that draws heat away: 16% more slow-wave sleep, in the second part of the night | An early cooling pulse; anything about a setpoint |
| Herberger et al. 2024, Sci Rep | The same kind of passive mattress: deep sleep up 7.5 minutes a night, give or take 21.6, heart rate down 2.4 bpm, the gain building after about four hours | That cooling early in the night is the part that matters |
| Moyen et al. 2024, Bioengineering 11:352 | Eight Sleep's own study, 54 people, a week off then a week on, not randomised, each choosing their own temperatures: 14 more minutes of deep sleep in men who slept cooler in the first half | That any given curve beats the schedule a sleeper already likes |
| Raymann et al. 2008, Brain 131:500 | Warming the skin by 0.4°C with a thermosuit cut waking in the night | That a degree of water temperature does the same |

So the curve is a starting guess to test against your own nights, and your corrections are the
part most likely to be right. Nothing here measures whether the autopilot improves sleep; the
saved nights record whether it steered, so nights with and without it can be compared later.

**The room reading is unproven too.** It comes from the sensor at the cover, which may read the
sleeper as well as the room. Each saved minute also has the air temperature at the hub on the
floor and the mattress surface, so a few nights will show which one follows the room. The
mattress surface is deliberately not acted on: it follows the water, so the autopilot would be
answering its own changes.

## How it tells you are asleep

By stillness, the way a wrist tracker's movement sensor does. The cover's piezo sensor (500
readings a second per side, on the firmware's sensor bus) feels movement; each minute is summed
up as a count of seconds with movement, and two rules decide the state
(`server/src/autopilot/sleepTracker.ts`):

- **Asleep:** in bed and still for 15 minutes in a row. Sleep is counted from when the
  stillness began; the bed can only act on it once the 15 minutes are up.
- **Awake again:** 3 minutes out of 5 with 12 or more moving seconds each. A turn in bed, or
  two, is not waking.

A minute in which the sensor sent too little, or a dead flat line, counts as neither, so a
sensor that stops is not taken for a sleeper lying still. Lying awake and still does read as
asleep, which is the known weak point of judging by movement.

A heart rate is read from the same sensor, saved and shown, and decides nothing yet. Deep sleep
is not detected.

**Breathing.** Each breath is a slow swell in the piezo signal. Every 10 seconds the last 30
are averaged down to 10 readings a second, drift and heartbeats are taken out, and the rate is
the shift at which that slow signal best matches itself, between 8 and 30 breaths a minute
(`server/src/autopilot/breathingRate.ts`). Each minute's rate, and how far apart its readings
were, are saved with the night. On this Pod it read 17 to 18 breaths a minute for a sleeper
lying still and awake, who breathes 14 to 16 asleep by their watch. That fits, and is one
person on one evening.

What breathing can tell, from sleep-lab studies:

- The rate barely moves: 16.8 breaths a minute awake against 15.2 to 15.9 in every sleep stage,
  in 38 adults who differed from each other by 2 to 3 (Gutierrez et al. 2016, Physiol Rep
  4:e12949). No range of rates marks sleep.
- Its steadiness does: variability is highest awake and in REM and falls into deep sleep. So
  the bed measures the spread of its readings, not the rate. That spread is of 30-second
  estimates, which is not the same thing as the breath-to-breath variability the studies
  measured, and has yet to be shown to follow it.
- No published rule turns either into "asleep" or "deep sleep". Systems with figures use a
  trained model on breathing and movement together (93% for asleep against awake by radar,
  about 71% of deep sleep found: Diao et al. 2026, arXiv 2604.16442).

So steady breathing is not asked for by default. It is one of the things calibration against a
sleep tracker tries, and it is only switched on when that makes the bed agree better with the
tracker on nights it was not fitted to.

**Getting up in the night.** Less than 30 minutes out of bed is the same night.

**Naps.** A sleep of under 3 hours is a nap; that is how saved sleeps are sorted. Nobody knows
how long a sleep will last when it begins, so whether the autopilot steers it from the start
goes by when it began:

1. against when you have actually been falling asleep and waking, from your newest 14 saved
   nights (once there are 3). The schedule's times are when the bed runs, not when you sleep;
2. with too few saved nights, against the schedule's bedtime and wake-up time;
3. with neither, by the hour: between 9:00 and 19:00 looks like a nap.

A sleep that begins up to 3 hours before your usual time, or any time until your usual waking,
is steered from the start. Any other is left alone, and if it is still going after 3 hours the
autopilot takes over from there.

## Linking a sleep tracker

The bed's numbers (15 still minutes, 12 moving seconds, breathing not asked for) are guesses.
A watch or band is the better judge of when you slept, so its record can be sent each morning
and the bed fits its numbers to it.

**iPhone only.** Apple Watch and Whoop write sleep to Apple Health, and Fitbit devices
(including the Fitbit Air) do through the Google Health app's Apple Health connection, which
lists sleep sessions and stages among what it writes. Apple Health has no web address a Pod
could ask: only something on the phone can read it.

- **An app, no Shortcut.** The paid iPhone app Health Auto Export posts Apple Health data on a
  schedule. Add a REST API automation for Sleep Analysis with the address
  `http://eightpod.local/api/autopilot/sleepTimes`, and switch **Summarize Data** off so it
  sends each stretch of sleep and waking, not one row a night.
- **A Shortcut with an automation.** **Settings > Autopilot > Sleep tracker > Link** has the
  steps. Set the automation to run when your Sleep Focus turns off, or at a set time.

Either runs by itself once set up, with one catch: an iPhone only lets apps read health data
while it is unlocked, and iOS decides when background work runs. So the night arrives when you
first use the phone, not at a fixed minute. That is fine here: it is looked at after the fact.

**Android is not supported.** Health Connect has no route built here. Apps that post Health
Connect data to an address exist (HC Webhook, HCGateway), but the bed does not read their
formats; a script that sends the request below would work.

```bash
curl -X POST http://eightpod.local/api/autopilot/sleepTimes -H 'Content-Type: application/json' \
  -d '{"source":"Whoop","asleepAt":"2026-11-18T23:12:00-08:00","awakeAt":"2026-11-19T06:48:00-08:00"}'
```

**What is done with it.** Each sleep is filed with every saved stay in bed it overlaps (a night
split in two by a restart gets both halves). Sending the same night again, or a corrected
version of it, replaces what was there. Sleeps in the future, older than 100 days or longer
than 18 hours are refused.

**Fitting.** When the tracker's record says when you were awake in the night, that is used,
not only when you fell asleep and woke: the bed's saved minutes are replayed under each
candidate set of numbers and scored on how many minutes they disagree with the tracker. That is
what lets it learn about lying awake at 3 am. It needs 5 nights. A fitted set is only taken up
if, fitted to all the nights but one and tried on that one, it does at least a tenth better
than the default; otherwise the default stays. **Data > Nights** shows the result: "Tuned to
Apple Health: 94% match over 6 nights", or "Default, checked against…" while it is not.

Naps are filed but not used for fitting, and sleep stages are not used at all. A wrist tracker
is treated here as the reference. It is not a sleep lab: in comparisons with one, wrist devices
find sleep well and miss some quiet waking (Fitbit Sense and Charge 5: about 93% of sleep and
48% of waking found; no such test of the Fitbit Air was found).

There is no direct Whoop or Fitbit link: their data is on their servers, and the phone already
has it.

Not yet run with a real tracker or phone. Health Auto Export's format was written from its
documentation.

## Where nights are kept

Every stay in bed of 20 minutes or more is saved on the Pod, whether or not the autopilot is
switched on, as one file in `/persistent/free-sleep-data/autopilot_nights/`: a row per minute
(moving seconds, heart rate, breathing rate and spread, pressure on the bed, state, the
autopilot's offset, the air at the cover and at the hub, the mattress surface), the bed's sleep
and wake times, whether the autopilot steered, and the tracker's record if one was sent. A
night is about 50 KB. The newest 180 files are kept (three months for two sides), under 10 MB
of the Pod's 14 GB free. An open stay is written every 10 minutes, so a restart loses at most
that, and starts a new file.

**Data > Nights** shows one day at a time, last night first, with arrows and a calendar to move:
bedtime, wake time, duration and wake-ups, then breathing rate, pressure on the bed and the
autopilot's temperature changes against the clock. A night belongs to the morning it ended on.
**Export** downloads the nights of the last week, two weeks, one, two or three months as one
JSON file. `GET /api/autopilot/nights` and `GET /api/autopilot/nights/export` return the same.
The biometrics service keeps its own sleep records in its database; these files are separate
and do not need it.

## Seeing what it does

Settings > Autopilot shows, while someone is in bed, whether they are asleep, their breathing
rate and the last change with its reasons. `GET /api/autopilot` returns the same (see
[server/API.md](../server/API.md#autopilot)), and the server log has a line for every change.
What it has learned is kept in `/persistent/free-sleep-data/autopilot_state.json`; delete the
file and restart EightPod to forget it.

## Code

`server/src/autopilot/`: `heartRate.ts` and `breathingRate.ts` (the estimates), `sleepTracker.ts`
(the sleep rules, and fitting them to a tracker), `nightPlan.ts` (curve, learning, room, limits,
steps), `scheduledBase.ts` (the schedule's temperature at a time; night or nap), `nightLog.ts`
(the saved nights), `autopilotMonitor.ts` (state, and the only file that touches the Pod). The
first five are pure and tested in `tests/autopilot.test.mjs`.

Two other open-source projects informed the rules above: Sleepypod's temperature controller
(manual targets are absolute and held, relative changes are worked out from the schedule and
never from the autopilot's own last setting, a temperature never switches a side on) and
Nightstand (learn slowly from repeated corrections).
