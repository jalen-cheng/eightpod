## What this changes

<!-- One change per pull request. Say what it does and why. -->

## How it was tested

<!-- Which Pod model it ran on, or "not run on a Pod". What you did and what happened. -->

## Checklist

- [ ] `node --test tests/*.test.mjs` passes, with a new test where the code can be tested
- [ ] Server and app typecheck and lint
- [ ] `server/dist` and `server/public` are rebuilt if `server/` or `app/` changed
- [ ] Version raised in `server/src/serverInfo.json` and a row added to `CHANGELOG.md`, if people should update for this
- [ ] Nothing here sends data off the Pod or needs the internet to work
