# Autopilot (Pod 5, experimental)

Off by default. Switch it on in **Settings > Autopilot > Adjust the temperature while I sleep**.
While someone is asleep, it moves their side a few degrees around the temperature the schedule
(or they) set. It never moves more than 4°F from that temperature, changes at most once every
10 minutes, and does nothing while the sleeper is awake, the side is off, away mode is on, the
wake-up heat is running, or a temperature set by hand is holding the schedule back.

**Not yet run through a night.** The heart-rate reading was checked against two minutes of real
sensor data from one person on one Pod 5. Sleep detection, the temperature changes and the
learning are covered by tests on made-up nights only.

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

The cover's piezo sensor (500 readings a second per side, on the firmware's sensor bus) feels
heartbeats and movement. Every 5 seconds the last 15 seconds are cleaned the way the biometrics
code in this repo does it (outliers clipped, a 4 to 11 Hz band kept) and the beat spacing is
read from how the signal repeats. Windows with movement in them, and weak readings, are dropped.
Each minute is then summed up as a heart rate and a count of seconds with movement, and plain
rules decide the state (`server/src/autopilot/sleepTracker.ts`):

- **Asleep:** in bed more than 10 minutes, still for 10, and the heart at least 3 beats a minute
  slower than while settling. With no heart rate, still for 20 minutes.
- **Awake again:** 3 restless minutes in 5.

These are cues, not a sleep lab. Deep sleep is not detected at all: heart-rate-only staging
agrees only moderately with lab scoring even with a trained model (Radha et al. 2019, Sci Rep
9:14149, kappa 0.61), and deep sleep is the hardest stage to tell. The extra degree of cooling
goes by the clock instead, over the first sleep cycle.

**Two people in the bed.** An empty side picks up the other person's pulse faintly. A side is
only followed while its in-bed sensor says someone is there, and weak readings are dropped, but
with two sleepers each side's heart rate can be pulled toward the other's. Treat it as working
for one person in the bed until it has been checked with two.

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
their heart rate and the last change with its reasons. `GET /api/autopilot` returns the same
(see [server/API.md](../server/API.md#autopilot)), and the server log has a line for every
change. What it has learned is kept in `/persistent/free-sleep-data/autopilot_state.json`;
delete the file and restart EightPod to forget it.

## Code

`server/src/autopilot/`: `heartRate.ts` (the estimate), `sleepTracker.ts` (the rules),
`nightPlan.ts` (curve, learning, room, limits), `scheduledBase.ts` (the schedule's temperature
at a time), `autopilotMonitor.ts` (state, and the only file that touches the Pod). All but the
last are pure and tested in `tests/autopilot.test.mjs`.
