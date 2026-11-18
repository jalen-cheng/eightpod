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

**Getting up in the night.** Less than 30 minutes out of bed is the same night: the curve
carries on from where it was when you return and are asleep again.

**Naps.** A sleep that begins outside the scheduled night (more than 3 hours before bedtime, or
after the wake-up time; between 9:00 and 19:00 when that day has no schedule) is a nap. It is
followed and saved, and the autopilot leaves the temperature alone for it.

**Two people in the bed.** A side is only followed while its in-bed sensor says someone is
there. Whether one sleeper's turning reads as movement on the other side has not been checked.

## Linking a sleep tracker

The bed's two numbers (15 still minutes, 12 moving seconds) are guesses. A watch or band knows
better when you slept, so you can send its times each morning and the bed fits its numbers to
them. **Settings > Autopilot > Sleep tracker > Link** has the steps for an iPhone Shortcut that
reads last night's sleep from Apple Health and posts it; Apple Watch and Whoop write their sleep
there, and Fitbit does through a sync app. Anything else can post the same request:

```bash
curl -X POST http://eightpod.local/api/autopilot/sleepTimes -H 'Content-Type: application/json' \
  -d '{"side":"left","source":"Whoop","asleepAt":"2026-11-18T23:12:00-08:00","awakeAt":"2026-11-19T06:48:00-08:00"}'
```

Each sleep sent is filed with the saved stay in bed it overlaps. Once 3 nights have tracker
times, the bed replays its saved minutes for the newest 14 such nights under each candidate pair
of numbers and keeps the pair whose sleep and wake times land closest. It does this again every
time new times arrive. Settings shows how far off the bed is, in minutes. Naps are filed but not
used for fitting. Only sleep and wake times are used, not sleep stages.

There is no direct Whoop or Fitbit link. Their data is only on their servers, so the Pod would
need a developer app registered with each company, a sign-in, and a hole in its internet block.
The phone already has the data, so the phone sends it.

Not yet run with a real tracker: the Shortcut steps and the fitting were checked only by tests
on made-up nights.

## Where nights are kept

Every stay in bed of 20 minutes or more is saved on the Pod, whether or not the autopilot is
switched on, as one file in `/persistent/free-sleep-data/autopilot_nights/`: a row per minute
(moving seconds, heart rate, state, the autopilot's offset, room temperature), the bed's sleep
and wake times, and the tracker's if any were sent. A night is about 30 KB. The newest 160 files
are kept (about two months for two sleepers), under 5 MB of the Pod's 14 GB free. An open stay
is written every 10 minutes, so a restart loses at most that, and starts a new file.
`GET /api/autopilot/nights` lists them. The biometrics service keeps its own sleep records in
its database; these files are separate and do not need it.

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

`server/src/autopilot/`: `heartRate.ts` (the estimate), `sleepTracker.ts` (the rules, and
fitting them to a tracker), `nightPlan.ts` (curve, learning, room, limits), `scheduledBase.ts`
(the schedule's temperature at a time; night or nap), `nightLog.ts` (the saved nights),
`autopilotMonitor.ts` (state, and the only file that touches the Pod). The first four are pure
and tested in `tests/autopilot.test.mjs`.
