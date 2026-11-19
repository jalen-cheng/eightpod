---
title: Getting started
---

# Getting started

SevenSleep controls an Eight Sleep Pod from your own network. A server on the Pod's built-in Linux computer
serves a web app you open on your phone, with no cloud and no subscription. It is an independent project, not
affiliated with Eight Sleep.

## What you need

- A Pod 3, 4 or 5. Pod 1 and Pod 2 are not compatible. Only a Pod 5 has been tested; see [Compatibility](./pod-models).
- A computer for the one-time install, about two hours, and $20 to $70 of parts: a USB serial adapter, plus either a tag-connect cable or three soldered wires.

## Install

1. Open the Pod's hub and attach the serial adapter to get a root shell.
2. Connect the Pod to Wi-Fi.
3. Run the installer on the Pod.
4. Open `http://sevensleep.local` on a phone on the same Wi-Fi and set your time zone.
5. Block the Pod from the internet, then close the hub.

The [install guide](./install) has photos and the exact commands for each step. If the Pod already runs Free Sleep, you can skip the hardware steps; see [Coming from Free Sleep](./install#coming-from-free-sleep).

## What next

- [Using the app](./using)
- [Autopilot](./autopilot)
- [iPhone Shortcuts](./ios-shortcuts)
- [Remote access](./remote-access)
- [API](./api)
