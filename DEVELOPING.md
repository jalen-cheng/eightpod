# Developing SevenSleep

This guide covers working on SevenSleep: running the app and server, the checks to run, and what a pull request must contain.

## Layout

- `app/`: the web app (React, MUI, Vite, Zustand, React Query).
- `server/`: the Express/TypeScript server that runs on the Pod. Source in `server/src`, compiled output in `server/dist`, the built app in `server/public`.
- `biometrics/`: Python stream processing, sleep detection and vitals.
- `scripts/`: install, update and maintenance scripts that run on the Pod.
- `tests/`: Node tests for the server's pure modules.

[AGENTS.md](AGENTS.md) lists where scheduling, the firmware socket ("Franken") and other hotspots live. The API is documented in [server/API.md](server/API.md).

## Requirements

- Node 24. `.nvmrc` says `24`; `server/package.json` requires `>=24.11.0`, and the installer puts 24.11.0 on the Pod with Volta. Use npm.
- Python 3 only for the biometrics code, its tests and the script tests. CI runs them on 3.9 and 3.10.

```bash
cd app && npm ci
cd server && npm ci
```

## Running the app

Against a Pod that is running SevenSleep:

```bash
cd app && VITE_POD_IP=<pod-ip> npm run dev
```

Vite serves the app on port 5173 with hot reload, and API calls go to `http://<pod-ip>:3000`.

Without a Pod, the demo runs on mock data. `VITE_ENV=demo` makes the app start a mock service worker (`app/src/mocks`) that answers the API calls in the browser:

```bash
cd app && VITE_ENV=demo VITE_USE_MSW=true npx vite --port 5199 --strictPort
```

This is the `app-demo` entry in `.claude/launch.json`. Use `npx vite` here, because `npm run dev` sets `VITE_ENV=dev`.

## Running the server

On the Pod, with reload on file changes. `fs-dev-server` stops the service and runs `npm run dev` as the `dac` user:

```bash
fs-dev-server
# when done: Ctrl+C, then
systemctl start free-sleep
```

Copy your changes to `/home/dac/free-sleep/server` on the Pod (an editor's deploy-on-save over SSH works) and point the app at it as above.

On a computer:

```bash
cd server && npm run generate:local && npm run dev:local
```

`dev:local` reads `server/.env.local`. `server/src/config.ts` requires `ENV` and `DATA_FOLDER`; Prisma reads `DATABASE_URL`. The committed `.env.local` holds another machine's absolute paths, so change `DATA_FOLDER` (it must end with `/`) and `DATABASE_URL` to your checkout's `server/free-sleep-data/` first. The `migrate:local` script runs `prisma migrate dev` against that database; it ends in `--name `, so pass a migration name after it. With `ENV=local` the server does not connect to the firmware, so anything that reads or changes the hardware needs a Pod.

## Checks before a pull request

```bash
cd app && npx tsc -b
cd app && npm run lint
cd server && npx tsc --noEmit
cd server && npm run lint
node --test tests/*.test.mjs
python3 -m unittest discover -s scripts/tests
python3 -m unittest biometrics/tests/test_temperature_calibration.py
```

Run the last three from the repository root. The Node tests need Node 24 or later: they import the TypeScript sources in `server/src` directly, with no build step. That only works for files that Node can load on their own, which is why the pure modules they cover must not have runtime imports.

CI (`.github/workflows/ci.yaml`) runs on pull requests:

- Lint for `app` and `server`.
- `npm run build:pr` for both, which includes the TypeScript compile, then fails if the working tree changed (see the next section).
- All of `biometrics/tests` and `scripts/tests`, on Python 3.9 and 3.10.

CI also runs the Node tests in `tests/`.

## Build output is committed

The Pod runs `server/dist` and `server/public` as downloaded. It builds nothing. So every pull request that changes source must include the rebuilt output:

```bash
cd server && npm run build:pr
cd app && npm run build:pr
```

- Server: compiles `src` to `server/dist` and injects source-map debug IDs locally. Nothing is uploaded.
- App: type-checks, then builds into `server/public`.

Commit the result. CI rebuilds and fails if its output differs from what is committed. After changing dependencies or `server/prisma`, run `npm run generate` in `server/` first.

## Shared schemas

The app imports the server's schemas and a few pure helpers straight from `server/src`. The files in `app/src/api` named `*Schema.ts`, `automaticOffTime.ts` and `temperatureCurve.ts` are re-exports. Those server files are compiled by both TypeScript configurations and bundled into the app, so keep them free of server-only imports (Node built-ins, the database, the logger). Both packages stay on Zod 3 for the same reason.

## Releasing

Raise `version` in `server/src/serverInfo.json` when people should update. The app compares its own copy with the one on `main` of this repository and offers the update when `main` is higher. Rebuild after changing it.

## Useful tools

- `biometrics/temperature_calibration/collect_temperature_calibration.py`: records the temperature the firmware aims for at each level, to check the curve in `server/src/db/temperatureCurve.ts`. It sets both sides, so run it when no schedule will fire. `--dry-run` changes nothing. With `--measure` it also waits for the water to settle at each level, and the bed must be empty. Options are in the file's docstring.

  ```bash
  cd /home/dac/free-sleep/biometrics/temperature_calibration && \
  /home/dac/venv/bin/python collect_temperature_calibration.py
  ```

- `scripts/probe_nats_taps.py`: prints what the Pod's local NATS server publishes, to find tap or button events.

  ```bash
  /home/dac/venv/bin/python /home/dac/free-sleep/scripts/probe_nats_taps.py
  ```

- [scripts/SQLITE_MAINTENANCE.md](scripts/SQLITE_MAINTENANCE.md): backing up and recovering the SQLite database.

## Contributing

Issues and pull requests go to https://github.com/jalen-cheng/sevensleep.

- SevenSleep is tested on one Pod 5. Say in the pull request what you tested on hardware, on which Pod, and what you did not test.
- Keep a pull request to one purpose, and include the rebuilt output.
- The scripts in `scripts/` run as root on people's beds. Change them when needed, run `scripts/tests`, and say how you tried the change.
- Code style, from AGENTS.md:
  - Give any complicated function a short comment saying what it does.
  - No abbreviated variable names of two characters or fewer.
  - No one-off hacks. Put new files and code where they belong.

## Docs site

The documentation website at https://jalen-cheng.github.io/sevensleep/ is built with [VitePress](https://vitepress.dev) from the Markdown files in this repository, so edit those files, not the site. `site/` holds only the config, the theme, the Getting started page (`site/pages/`) and the sync script.

`npm run build` first runs `site/scripts/syncDocs.mjs`. It copies each page listed in `site/scripts/docsManifest.mjs` into `site/content/` (not committed) with a title, rewrites links between pages and to image paths, copies only the images the pages embed, and turns links to other repository files into GitHub links. It stops if a link points at a file that does not exist. To add a page, add it to the manifest, which also sets the sidebar.

```bash
cd site
npm install
npm run dev       # local server with reload; re-run it after editing a source Markdown file
npm run build     # the same build GitHub Actions runs
npm run preview   # serve the build at http://localhost:4173/sevensleep/
```

`.github/workflows/docs.yaml` builds and publishes the site to GitHub Pages when a docs source or `site/` changes on `main`. Pages must be set to deploy from GitHub Actions in the repository settings.

## Demo and screenshots

The demo at [sevensleep.vercel.app](https://sevensleep.vercel.app) is the app built with made-up data
(`npm run build:demo` in `app/`, settings in `vercel.json`). Deploy it with `npx vercel --prod`
from the repository root.

The screenshots in `docs/screenshots/` are taken from the demo, all at one phone size, and put in
phone frames by the scripts in `docs/screenshots/tools/`:

1. Run the demo locally (`VITE_ENV=demo VITE_USE_MSW=true npx vite --port 5199` in `app/`).
2. Start Chrome with `--headless=new --remote-debugging-port=9333`.
3. In `docs/screenshots/tools/`, run `CAPTURE_HEIGHT=800 node capture.mjs 9333 raw '<list of pages>'`
   (the list format is at the top of the script; name the pages `temperature`, `schedule`,
   `alarm_options`, `nights`, `settings` and `autopilot` (Settings with only its Autopilot section
   open)), then `node frame.mjs 9333 ..`.
4. The pictures for a post in `docs/demo/post/` are `post.html` in the same folder, one card a
   picture, built from the framed screenshots: `CAPTURE_WIDTH=1600 CAPTURE_HEIGHT=900 node
   capture.mjs 9333 ../../demo/post '<one entry a card>'`, each entry's `url` being the file's
   address with `?card=hero`, `phones`, `autopilot` or `api`.

