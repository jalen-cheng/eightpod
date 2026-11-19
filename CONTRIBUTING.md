# Contributing

Contributions are welcome, including big ones. SevenSleep was built and tested on one Pod 5, so
there is a lot of room: other Pods, new features, and different ideas about how the app should
look and work.

## 1. Direction is open

- Propose features, a different product direction or a full UI rewrite. Open an issue or a draft
  pull request with a mockup or a sketch of the idea; nothing needs approval before you start.
- Small fixes need no discussion at all.
- If two ideas pull in different directions, the one that was tried on a real bed wins.

## 2. Test reports count as much as code

Issues labelled [needs testing](https://github.com/jalen-cheng/sevensleep/issues?q=is%3Aissue+is%3Aopen+label%3A%22needs+testing%22)
list what nobody has checked: a Pod 3, Pod 4 or Pod 6, taps, features not yet seen on a bed. Try one and
comment with your Pod model, what you did and what happened. "Works" is a useful report.

## 3. Helping with the autopilot

The autopilot (Pod 5) rests on one sleeper's nights, so its numbers are guesses until more beds
are heard from. Open work is under [autopilot](https://github.com/jalen-cheng/sevensleep/issues?q=is%3Aissue+is%3Aopen+label%3Aautopilot). What helps, most useful first:

- **Nights beside a tracker.** Wear a watch or band, sleep a few nights, and export them from
  **Data > Sleep > Export**. The file has each minute's movement and the bed's own judgement;
  the tracker's record is in it if the Shortcut sent one. Say how far the two agreed and where
  they parted. An export holds your sleep times: share only what you are happy to.
- **Where it is wrong.** A night it called you awake while you slept, or the other way round,
  with that night's export.
- **The rules themselves.** They are in `server/src/autopilot/` and are pure functions with tests in
  `tests/autopilot.test.mjs`. [docs/AUTOPILOT.md](docs/AUTOPILOT.md) says what each rule is and
  what evidence it has. A change to a rule should come with the nights that argue for it.
- **Heart rate and breathing** are switched off because the estimates were not reliable. A
  method checked against a worn reference would be new ground.

It keeps to one principle: when the sensors may be wrong, do little. A change that makes it
act more should say what stops it acting on a bad reading.

## 4. The few fixed rules

- **Stays local.** Nothing phones home, needs an account or the cloud, or weakens the internet block.
- **Eight Sleep's firmware is left as it is.** No modified firmware, and no code copied from it.
- **Licences fit MIT.** Ideas from GPL projects are fine; their code is not.
- **No personal details** in code, tests or screenshots: addresses, Wi-Fi names, keys.

## 5. Pull requests

- Say what you tested and on which Pod, or that it was not run on one.
- Run the checks. GitHub runs the same ones:

  | What | Command | From |
  |---|---|---|
  | Tests | `node --test tests/*.test.mjs` | repository root |
  | Script tests | `python3 -m unittest discover -s scripts/tests` | repository root |
  | Types and lint | `npx tsc --noEmit && npm run lint` | `server/` |
  | Types and lint | `npx tsc -b && npm run lint` | `app/` |
  | Build output | `npm run build:pr` | `server/`, then `app/` |

- The Pod runs the committed `server/dist` and `server/public`, so a change to `server/` or
  `app/` ships with both rebuilt.
- Schedule and alarm timing lives in small tested modules (`server/src/jobs/`); add a test there
  when you change it.
- Raise the version in `server/src/serverInfo.json` and add a bullet under its version in [CHANGELOG.md](CHANGELOG.md)
  when people should update for the change.

[DEVELOPING.md](DEVELOPING.md) covers setup, and running the app on made-up data with no Pod.

## Credit

SevenSleep builds on [Free Sleep](https://github.com/throwaway31265/free-sleep). Fixes that also
apply there are worth offering to that project as well.
