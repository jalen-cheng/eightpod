# Contributing to Free Pod

Free Pod was built and tested on one Pod 5. The most useful thing you can contribute is a report
of what happens on hardware it has not seen. Code is welcome too.

## Test it and say what happened

Open issues labelled [needs testing](https://github.com/jalen-cheng/free-sleep/issues?q=is%3Aissue+is%3Aopen+label%3A%22needs+testing%22)
list what nobody has checked yet: installing on a Pod 3 or Pod 4, taps on a Pod 4, features that
have not fired on a real bed, and so on. Pick one, try it, and comment with:

- Your Pod model and, for a Pod 3, whether it has an SD card.
- What you did and what happened, including when it worked. "Works" is a useful report.
- The output of `fs-debug` (run it over SSH) if something failed.

Found something that is not on the list? Open a new issue with the **Test report** template.

## Report a bug or ask for a feature

Open an issue. For a bug, say what you expected, what happened, your Pod model, the version from
**Settings > Device**, and the `fs-debug` output if the server is involved.

## Change the code

1. [DEVELOPING.md](DEVELOPING.md) covers setup, running the app on made-up data, and the checks.
2. Keep a pull request to one change. Say what you tested and on which Pod, or that it was not
   run on one.
3. A change to `server/` or `app/` ships with the rebuilt `server/dist` and `server/public`: the
   Pod runs them as downloaded.
4. Raise the version in `server/src/serverInfo.json` when people should update for the change.
5. Timing code (schedules, alarms) gets a test in `tests/` before it changes.

Areas where help is most wanted:

- **Biometrics on a Pod 5.** Its firmware publishes sensor data where the analysis does not read.
- **Pod 3 and Pod 4.** Anything that turns "same code as the original" into "tested".
- **A reset procedure for a Pod 5** (see "Going back to Eight Sleep" in [INSTALLATION.md](INSTALLATION.md)).

## Credit

Free Pod builds on [Free Sleep](https://github.com/throwaway31265/free-sleep). Fixes that also
apply there are worth offering to that project as well.
