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

## Change your alarm time

`POST http://<pod-ip>:3000/api/alarm/time` moves the alarm without opening the app.

| What it does | JSON body |
| --- | --- |
| Alarm at 6:30 every day, left side | `{"side": "left", "time": "06:30"}` |
| Alarm at 6:30 every day, both sides | `{"side": "both", "time": "06:30"}` |
| Alarm at 8:00 on the weekend only | `{"side": "left", "time": "08:00", "days": ["saturday", "sunday"]}` |
| Switch the alarm off (the time is still required) | `{"side": "left", "time": "06:30", "enabled": false}` |

- `time` is 24-hour `HH:mm`, a Text field.
- `side` is `left`, `right` or `both`, a Text field.
- `days` is optional (an Array of Text); leave it out for every day.
- Only the time and the on/off state change. Vibration, length, warm-up and the rest stay as set in the app.
- The alarm still only fires if that day's schedule is on and the side is on at that time.

A shortcut that asks for the time each time you run it:

1. Add **Ask for Input**. Set the type to **Time** and the prompt to "Alarm time".
2. Add **Format Date**. Set Date Format to **Custom** and the format string to `HH:mm`.
3. Add **Get Contents of URL** with the URL above, Method `POST`, Request Body `JSON`.
4. Add a Text field `side` with your side, and a Text field `time` whose value is the **Formatted Date** from step 2.
5. Name it "Set bed alarm". You can then say "Hey Siri, set bed alarm" and answer with a time.

To keep it in step with your phone's alarm, make it an Automation instead: Shortcuts → Automation →
**Alarm** (or **Sleep** → Wind Down Begins) → run the shortcut with a fixed time.

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
