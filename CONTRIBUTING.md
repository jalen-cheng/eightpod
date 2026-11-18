# Contributing

Contributions are welcome, including big ones. EightPod was built and tested on one Pod 5, so
there is a lot of room: other Pods, new features, and different ideas about how the app should
look and work.

## 1. Direction is open

- Propose features, a different product direction or a full UI rewrite. Open an issue or a draft
  pull request with a mockup or a sketch of the idea; nothing needs approval before you start.
- Small fixes need no discussion at all.
- If two ideas pull in different directions, the one that was tried on a real bed wins.

## 2. Test reports count as much as code

Issues labelled [needs testing](https://github.com/jalen-cheng/eightpod/issues?q=is%3Aissue+is%3Aopen+label%3A%22needs+testing%22)
list what nobody has checked: a Pod 3 or Pod 4, taps, features not yet seen on a bed. Try one and
comment with your Pod model, what you did and what happened. "Works" is a useful report.

## 3. The few fixed rules

- **Stays local.** Nothing phones home, needs an account or the cloud, or weakens the internet block.
- **Eight Sleep's firmware is left as it is.** No modified firmware, and no code copied from it.
- **Licences fit MIT.** Ideas from GPL projects are fine; their code is not.
- **No personal details** in code, tests or screenshots: addresses, Wi-Fi names, keys.

## 4. Pull requests

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
- Raise the version in `server/src/serverInfo.json` and add a row to [CHANGELOG.md](CHANGELOG.md)
  when people should update for the change.

[DEVELOPING.md](DEVELOPING.md) covers setup, and running the app on made-up data with no Pod.

## Credit

EightPod builds on [Free Sleep](https://github.com/throwaway31265/free-sleep). Fixes that also
apply there are worth offering to that project as well.
