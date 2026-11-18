# Autopilot: a draft

**Status: a design draft. Nothing here is built.** It says what an autopilot for EightPod could
be, what the Pod gives it to work with, and the order to build it in. Sections marked *measured*
come from the test Pod 5 on 18 Nov 2026; everything else is a proposal.

## What it is

Today a night is a list of times and temperatures. An autopilot changes the temperature from
what the bed senses instead of from the clock: it waits until you are asleep to cool the bed,
reacts when you are restless or too warm, and learns from the corrections you make by hand.

It is not a copy of Eight Sleep's Autopilot. Theirs is closed, runs in their cloud and is trained
on many sleepers. This one runs on the Pod, uses rules a person can read, and adjusts within
limits you set.

**Not in scope:** sleep-stage reports, snoring, health scores, anything that needs the cloud.

## What the Pod 5 publishes (measured)

A 12-second listen to the firmware's NATS bus on the test Pod 5 found these subjects. The server
reads the first two today; the rest are unused.

| Subject | Rate | What is in it | Used today |
|---|---|---|---|
| `rawmem.sens.capsense` | 2 a second | Three capacitance zones per side | Yes: in-bed detection |
| `rawmem.frz.temp` | about every 10 s | Water temperature per side, plus `amb` (hub ambient) and `hs` (heatsink) | Water only |
| `rawmem.sens.piezo` | 1 a second | `piezo-dual`, 500 Hz, one channel per side (`left1`, `right1`), 2000 bytes each | **No** |
| `rawmem.sens.bedtemp` | about every 10 s | `amb` (cover ambient), `hu` (humidity), and four surface temperatures per side (`side`, `out`, `cen`, `in`) | No |
| `rawmem.frz.therm` | about every 10 s | Per side: target in °C, heating/cooling `power`, `enabled` | No |
| `rawmem.frz.health`, `rawmem.frz.water`, `rawmem.sens.health`, `rawmem.sens.blanket` | slower | Pump, water level, sensor and blanket state | No |

**The piezo stream is the finding that matters.** The docs say sleep tracking produces nothing on
a Pod 5 because the firmware publishes "where the analysis does not read". The data is there: the
analysis listens on `raw.sens.piezo` through JetStream, and a Pod 5 publishes the same kind of
record on `rawmem.sens.piezo` as plain messages. Heart rate on a Pod 5 is therefore a matter of
pointing the existing code at the right subject, and coping with one channel per side where older
Pods have two.

Humidity (`hu`) and ambient temperature were not known to be available before this listen.
The values read like hundredths of a unit (`amb` 2136, `hu` 5973), which would be 21.4 °C and
59.7%; that reading is a guess until checked against a thermometer.

## The signals an autopilot needs

| Signal | From | State |
|---|---|---|
| In bed, per side | capacitance | Built. Checked with one person on one Pod |
| Movement | change in capacitance while in bed | Not built. The batch analysis already does this after the night; it needs doing live |
| Heart rate, breathing rate | piezo, 500 Hz | Code exists in `biometrics/` for older Pods. Not yet run on a Pod 5's stream |
| Asleep or awake | heart rate against your own resting level, plus stillness | Not built. This is the new part |
| Bed surface temperature | `bedtemp` zones | Not read yet |
| Room temperature and humidity | `amb`, `hu` | Not read yet |

## Stages

Each stage is useful by itself and proves the next one is possible.

**1. Read what is there.** Subscribe to `rawmem.sens.piezo`, `rawmem.sens.bedtemp` and
`rawmem.frz.therm` in `bedSensorMonitor.ts`. Show room temperature and humidity on the Status
page. Record one full night of raw piezo and capacitance to a file, with a button press whenever
the sleeper is awake, to have ground truth. No behaviour changes.

**2. Heart rate on a Pod 5.** Feed the Pod 5 piezo stream to the existing heart-rate code. Two
routes:
- *Reuse the Python streamer:* add `rawmem.sens.piezo` as a source in `biometrics/stream/stream.py`.
  Least new code, and it brings the Data page's vitals to life on a Pod 5. It needs the biometrics
  install (a Python environment on the Pod).
- *Port the heart-rate step to the server:* a band-pass filter and peak count over a few seconds
  in TypeScript. No Python on the Pod, and the autopilot gets the value in memory with no
  database in between. More work, and it must be checked against the Python result.

Start with the first to learn whether the signal is good; decide on the second once it is.

**3. Asleep or awake.** A small pure module (`server/src/autopilot/sleepState.ts`, tested like
`presenceDetector.ts`) that takes heart rate, movement and in-bed, and gives one of: out of bed,
awake in bed, asleep, restless. A first rule set:
- *Asleep:* in bed, still for 10 minutes, and heart rate at least 8% under the average of the
  first 10 minutes in bed.
- *Restless:* asleep, then movement above a threshold in 2 of the last 5 minutes.
- *Awake:* restless for 10 minutes, or heart rate back near the in-bed starting level.

The numbers are placeholders. Stage 1's recorded night is what they are tuned on.

**4. The controller.** A second pure module (`controller.ts`) that turns the state into a
temperature change. Rules, each of which can be switched off:

| When | It does | Why |
|---|---|---|
| You fall asleep | Moves from the bedtime temperature to the sleep temperature | Replaces guessing a clock time for the first change |
| Restless, and the bed surface is warmer than when you fell asleep | One step cooler | Overheating is the common cause |
| Restless, and the surface is cooler | One step warmer | |
| The room warms or cools by 2 °F | Half a step the other way | Holds what you feel steady |
| Awake before the alarm, in the last hour | Starts the wake-up warm-up early | You are getting up anyway |
| You change the temperature by hand | Holds your value until the next phase, and remembers it | See "Learning" |

**5. Learning.** Each manual correction is stored with the phase of the night it happened in
(first hour asleep, middle, last two hours). After three corrections the same way in the same
phase, the autopilot shifts its own target for that phase by one degree. It only learns from
what you do; it never infers a preference from the sensors alone.

## How it fits the code

- **Settings:** per side, `autopilot: { enabled, maxOffsetF, learn }` in `settingsSchema.ts`.
  Off by default.
- **The schedule stays the base.** The autopilot adjusts relative to the scheduled temperature
  for the current phase, never by more than `maxOffsetF` (3 °F to start). With sensors stale or
  the module failing, the night runs exactly as scheduled.
- **Who wins:** a manual change beats the autopilot until the next phase. The existing manual
  hold and the alarm's warm-up beat it outright, as they beat scheduled changes today. Away mode
  switches it off.
- **Rate limit:** at most one change every 15 minutes, one step at a time. The water takes
  minutes to follow, and a bed that hunts is worse than one that does nothing.
- **State on disk:** learned offsets and the night's log go in a file outside the folder the job
  scheduler watches, as `presence_state.json` does, so writing them does not rebuild every job.
- **Tests:** `sleepState.ts` and `controller.ts` take plain numbers and return decisions, with no
  runtime imports, so `tests/` can replay a recorded night through them.
- **The app:** one switch per side on the schedule page ("Autopilot"), the limit, and a line on
  the Temperature page saying what it last did and why ("Cooled 1° at 2:14, restless").

## Risks and unknowns

- **Signal quality.** Heart rate from one piezo channel on a Pod 5 has not been seen. If it is
  too noisy, the autopilot falls back to movement and bed temperature only, which still gives
  sleep onset and restlessness.
- **Two sleepers.** A partner's movement and pulse reach the other side's sensors. In-bed
  detection already filters this for capacitance; piezo needs the same treatment.
- **One test bed.** Every threshold will be tuned on one person and one Pod.
- **What the fields mean.** The units of `amb`, `hu` and the `bedtemp` zones, and whether the
  surface sensors follow body heat or mostly the water, need a night of readings to settle.
- **Comfort is personal.** The rules above encode common advice (cooler once asleep, warmer
  before waking). They will be wrong for some people, which is why every rule has a switch and
  the offset has a limit.
- **Pod 3 and Pod 4** do not report the capacitance stream this builds on in the same way.
  Stage 2 would work for them; stages 3 to 5 are Pod 5 only until someone with one tests.

## Effort

| Stage | Size | Needs the bed |
|---|---|---|
| 1. Read and record | Small | One night of recording |
| 2. Heart rate on a Pod 5 (reusing Python) | Small to medium | Two or three nights to compare with a watch |
| 3. Asleep or awake | Medium | The recorded night, then a week of checking |
| 4. Controller | Medium | A week, one rule at a time |
| 5. Learning | Small | Weeks |

Stages 1 and 2 are worth doing whether or not the autopilot follows: they make sleep tracking
work on a Pod 5 and put room temperature and humidity in the app.
