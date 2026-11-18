# Contributing to EightPod

EightPod was built and tested on one Pod 5. The most useful thing you can contribute is a report
of what happens on hardware it has not seen. Code is welcome too.

- [Test it and say what happened](#test-it-and-say-what-happened)
- [Report a bug or ask for a feature](#report-a-bug-or-ask-for-a-feature)
- [Change the code](#change-the-code)
- [What gets merged, and what does not](#what-gets-merged-and-what-does-not)
- [How the code is written](#how-the-code-is-written)
- [The checks](#the-checks)

## Test it and say what happened

Open issues labelled [needs testing](https://github.com/jalen-cheng/eightpod/issues?q=is%3Aissue+is%3Aopen+label%3A%22needs+testing%22)
list what nobody has checked yet: installing on a Pod 3 or Pod 4, taps on a Pod 4, features that
have not fired on a real bed, and so on. Pick one, try it, and comment with:

- Your Pod model and, for a Pod 3, whether it has an SD card.
- What you did and what happened, including when it worked. "Works" is a useful report.
- The output of `fs-debug` (run it over SSH) if something failed.

Found something that is not on the list? Open a new issue with the **Test report** template.

## Report a bug or ask for a feature

Open an issue. For a bug, say what you expected, what happened, your Pod model, the version from
**Settings > Device**, and the `fs-debug` output if the server is involved. For a feature, say
what you are trying to do before how you would build it.

## Change the code

1. [DEVELOPING.md](DEVELOPING.md) covers setup and running the app on made-up data, with no Pod.
2. For anything larger than a fix, open an issue first so the approach can be agreed before you
   build it.
3. Keep a pull request to one change, and fill in the template: what it does, what you tested and
   on which Pod (or that it was not run on one).
4. Run [the checks](#the-checks). They also run on every pull request.

## What gets merged, and what does not

**Welcome**

- Fixes, with a test that fails without them where the code can be tested.
- Reports and fixes from a Pod 3, Pod 4 or a newer Pod 5.
- Anything that gets biometrics working on a Pod 5.
- Clearer docs, and corrections where the docs and the app disagree.
- Features that work with the internet block on and keep the app simple to use on a phone.

**Not accepted**

- **Anything that phones home.** No analytics, telemetry, crash reporting with a built-in
  destination, or remote configuration. Nothing may be sent off the Pod unless the user set it up.
- **Anything that needs the cloud to work.** No accounts, logins against an outside service, or
  features that stop working when the Pod is offline. Fonts, scripts and other assets are bundled,
  never loaded from a CDN.
- **Weakening the internet block or opening the app to the internet.** The app has no login, so
  nothing may make it reachable from outside the home network except through the user's own VPN.
- **Changes to Eight Sleep's firmware**, or code taken from it. EightPod talks to the firmware and
  leaves it as it is.
- **Code under a licence that does not fit.** Do not paste from GPL projects (opensleep is GPL-3.0);
  ideas are fine, code is not. Say where borrowed code comes from.
- **Personal details in the repository**: real addresses, hostnames, Wi-Fi names, keys or tokens,
  including in tests and screenshots.
- **Behaviour that is true on one Pod presented as true on all.** If you ran it on a Pod 4, say
  Pod 4. Docs say "tested" only for what was run.
- **Unrelated changes in one pull request**, drive-by reformatting, or new dependencies without a
  reason given.
- **A source change without its build output** (see below).

Pull requests written with an AI assistant are fine. You are responsible for the result: run it,
read it, and say honestly what you tested.

## How the code is written

- **Names say what a thing is.** No abbreviations of two letters or fewer. A time is `wakeTime`,
  not `wt`.
- **A complicated function gets a short comment** saying what it does and why, not how.
- **No one-off hacks.** A fix goes where the problem is, in the file that owns that behaviour.
  [AGENTS.md](AGENTS.md) maps the code.
- **Timing code is tested before it changes.** Schedules, alarms and in-bed detection each have a
  small module with no runtime imports (for example `server/src/jobs/scheduleTiming.ts`) so
  `tests/` can load it without a Pod. Put new logic in one of those, or a new one like them, and
  test it there.
- **Temperatures are whole °F** in storage and in the API; the app converts for display.
- **The app shows less, not more.** One line per setting; explanation goes behind an "i". Check a
  change at phone width.
- **Docs are plain.** Short sentences, no marketing words, and "not tested" where that is the case.
- **Build output is committed.** The Pod runs `server/dist` and `server/public` as downloaded, so
  a change to `server/` or `app/` ships with both rebuilt (`npm run build:pr` in each).
- **Raise the version** in `server/src/serverInfo.json` when people should update for the change,
  and add a row to [CHANGELOG.md](CHANGELOG.md).

## The checks

Run these before opening a pull request. GitHub runs the same ones on it.

| What | Command | From |
|---|---|---|
| Schedule, alarm and in-bed tests | `node --test tests/*.test.mjs` | repository root |
| Script tests | `python3 -m unittest discover -s scripts/tests` | repository root |
| Server types and lint | `npx tsc --noEmit && npm run lint` | `server/` |
| App types and lint | `npx tsc -b && npm run lint` | `app/` |
| Build output is current | `npm run build:pr` in `server/` then `app/`; `git status` shows nothing new | both |

Node 24 is needed: the tests import the TypeScript sources directly.

## Credit

EightPod builds on [Free Sleep](https://github.com/throwaway31265/free-sleep). Fixes that also
apply there are worth offering to that project as well.
