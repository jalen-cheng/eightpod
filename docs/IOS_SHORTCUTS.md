# Control your Pod from iPhone with Apple Shortcuts

Free Sleep exposes a local REST API, so the Shortcuts app can control your Pod without opening a browser.
You do not need an Apple developer account. Shortcuts also work from the Home Screen, the Lock Screen,
Control Center, the Action button, Siri, and Automations (for example "when my Sleep Focus turns on").

Requirements:
- Your iPhone is on the same network as the Pod (or can otherwise reach its local IP).
- You know the Pod's IP address (step 14 of [INSTALLATION.md](../INSTALLATION.md)). Give it a fixed IP in your router so shortcuts keep working.

## Build a shortcut

1. Open **Shortcuts** and tap **+**.
2. Add the action **Get Contents of URL**.
3. Set the URL to `http://<pod-ip>:3000/api/deviceStatus`.
4. Tap the arrow to expand the action and set:
   - **Method**: `POST`
   - **Request Body**: `JSON`
5. Add the fields from one of the examples below. The side (`left` or `right`) is a **Dictionary** field;
   add the setting inside it with the type shown.
6. Name the shortcut and run it. The first run asks for permission to connect to devices on your local network; allow it.

A successful request returns an empty response (HTTP 204).

## Examples

All of these are `POST http://<pod-ip>:3000/api/deviceStatus`. Replace `left` with `right` for the other side.

| What it does | JSON body | Field type in Shortcuts |
| --- | --- | --- |
| Set the target temperature to 70°F | `{"left": {"targetTemperatureF": 70}}` | Number |
| Turn the side on | `{"left": {"isOn": true}}` | Boolean |
| Turn the side off | `{"left": {"isOn": false}}` | Boolean |
| Dismiss a vibrating alarm | `{"left": {"isAlarmVibrating": false}}` | Boolean |

Notes:
- `targetTemperatureF` is always Fahrenheit, from 55 to 110, whatever temperature format the app shows.
- Setting a temperature does not turn the side on. Send both in one request to do that:
  `{"left": {"isOn": true, "targetTemperatureF": 70}}`
- Turning a side on keeps it on for 12 hours unless a schedule turns it off earlier.
- You can change both sides in one request: `{"left": {"isOn": false}, "right": {"isOn": false}}`
- If one side is in away mode, changes to either side apply to both sides.

## Fixed actions or ones that ask you

A shortcut can do either:

- **A fixed action**: the JSON body is typed in once, and running the shortcut always does that.
  "Dismiss my alarm", "Alarm an hour later" and "Bed off" are like this. Good for the Home Screen,
  the Action button, and Automations.
- **An action with a value you give each time**: put an **Ask for Input** (a number, a time, or text)
  or a **Choose from Menu** action before **Get Contents of URL**, then use its result as the value of
  a JSON field. Run from Siri, it asks you out loud. "Set bed alarm" below and "set my side to
  ... degrees" are like this.

Any field in any example on this page can be filled either way.

## Change your alarm time

`POST http://<pod-ip>:3000/api/alarm/time` sets an alarm without opening the app.

**By default it is a one-off:** the alarm goes off the next time the clock shows that time, tonight
or tomorrow, whichever comes first, and your weekly schedule is left alone. Run it at 11 PM with
`06:30` and it fires at 6:30 tomorrow morning; run it at 11 PM with `01:00` and it fires at 1 AM tonight.

| What it does | JSON body |
| --- | --- |
| One-off alarm at the next 6:30, left side | `{"side": "left", "time": "06:30"}` |
| One-off alarm at the next 6:30, both sides | `{"side": "both", "time": "06:30"}` |
| Move your next alarm an hour later, tonight only | `{"side": "left", "shiftMinutes": 60}` |
| Move your next alarm 30 minutes earlier, tonight only | `{"side": "left", "shiftMinutes": -30}` |
| Change the weekly alarm to 8:00 on the weekend | `{"side": "left", "time": "08:00", "days": ["saturday", "sunday"]}` |
| Switch the weekly alarm off on Mondays | `{"side": "left", "time": "06:30", "days": ["monday"], "enabled": false}` |

- `time` is 24-hour `HH:mm`, a Text field. `side` is `left`, `right` or `both`, a Text field.
- Adding `days` (an Array of Text) changes the weekly schedule for those days instead of setting a one-off.
- `shiftMinutes` is a Number field, used instead of `time`. It moves your next alarm (a one-off you
  already set, otherwise the next scheduled one) and can be run again to move it further. It needs an
  alarm within the next 24 hours, and replies with an error if there is none.
- The reply says what was set, including `firesAt` for each side of a one-off.
- To drop a one-off and go back to the schedule: `POST http://<pod-ip>:3000/api/alarm/time/cancel`
  with `{"side": "left"}`.
- The app shows and sets the same one-off under **Schedules > One-time alarm**.

Things to know about a one-off:
- The side has to be on at that time, or the alarm is skipped.
- It uses that day's vibration settings from the schedule, but not its warm-up.
- A scheduled alarm that would have gone off before it is skipped. One scheduled for later that same
  morning still goes off, unless the one-off was made by moving that alarm earlier with `shiftMinutes`.

A shortcut that asks for the time each time you run it:

1. Add **Ask for Input**. Set the type to **Time** and the prompt to "Alarm time".
2. Add **Format Date**. Set Date Format to **Custom** and the format string to `HH:mm`.
3. Add **Get Contents of URL** with the URL above, Method `POST`, Request Body `JSON`.
4. Add a Text field `side` with your side, and a Text field `time` whose value is the **Formatted Date** from step 2.
5. Name it "Set bed alarm". You can then say "Hey Siri, set bed alarm" and answer with a time.

## Reading the current state

`GET http://<pod-ip>:3000/api/deviceStatus` returns the current state as JSON. In a shortcut, follow
**Get Contents of URL** with **Get Dictionary Value** (for example `left.isOn`) to branch on it,
such as a single "toggle my side" shortcut.

## Troubleshooting

- **The shortcut times out**: check that the phone is on the same network and that `http://<pod-ip>:3000` opens in Safari.
- **"Invalid request data" (HTTP 400)**: a field has the wrong type. Temperatures must be Number fields and
  `isOn` / `isAlarmVibrating` must be Boolean fields, not Text.
- **It stopped working after a while**: the Pod's IP address changed. Reserve an IP for it in your router.

See [server/API.md](../server/API.md) for the rest of the API.
