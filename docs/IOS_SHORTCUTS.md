# Control your Pod from iPhone with Apple Shortcuts

Free Pod has a local API, so the Shortcuts app can control the bed without opening a browser.
You do not need an Apple developer account. Shortcuts also run from the Home Screen, the Lock
Screen, Control Center, the Action button, Siri, and Automations (for example "when my Sleep Focus
turns on").

## Which address to put in a shortcut

Every shortcut below uses `<pod>`. Replace it with one of these, most stable first:

| Use | Works | Keeps working when |
|---|---|---|
| `bed` | Anywhere, while Tailscale is connected on the phone | The Pod's address, your router or your network changes |
| `bed.local` | At home | The Pod's address or your router changes. Shortcuts run by a Home automation have been reported to fail on `.local` names; if yours does, use one of the others |
| The Pod's home address, for example `192.168.1.50` | At home; anywhere with Tailscale if you set up the one-link route | Only while that address stays the same, so reserve it in the router |

`bed` is the name the installer gives the Pod; run `hostname` on the Pod to check yours. Setting up Tailscale, the
one-link route and a reserved address is in [REMOTE_ACCESS.md](REMOTE_ACCESS.md).

The first run of a shortcut asks for permission to connect to devices on your local network; allow it.

## 1. Set the temperature (-10 to +10)

Asks for a number on the same scale as Eight Sleep's own app, turns the bed on, and sets it.

1. Open **Shortcuts** and tap **+**.
2. Add **Ask for Input**. Set the type to **Number**, the prompt to "Bed temperature, -10 to 10", and
   switch on **Allow Negative Numbers**.
3. Add **Get Contents of URL** and set the URL to `http://<pod>/api/deviceStatus/dial`.
4. Expand it and set **Method** to `POST` and **Request Body** to `JSON`.
5. Add a **Number** field `dial` and pick **Provided Input** (the answer from step 2) as its value.
6. Name it "Bed temperature".

-10 is coldest, 0 is neutral, +10 is hottest. Halves such as 2.5 work. Anything outside -10 to 10
is refused. The bed stays on for the time set in Settings > Device settings ("When turned on by
hand"): 3, 6 or 12 hours.

## 2. Set an alarm

Asks for a time and sets a one-time alarm. Your weekly schedule is not changed.

1. Open **Shortcuts** and tap **+**.
2. Add **Ask for Input**. Set the type to **Time** and the prompt to "Alarm time".
3. Add **Get Contents of URL** and set the URL to `http://<pod>/api/alarm/time`.
4. Expand it and set **Method** to `POST` and **Request Body** to `JSON`.
5. Add a **Text** field `time` and pick **Provided Input** (the answer from step 2) as its value.
6. Name it "Bed alarm".

How the time is understood:

- **AM and PM** come from the time picker (or from what you tell Siri, such as "ten AM"). The Pod
  reads the time however the phone writes it: `22:00`, `10:00 PM`, or a full date containing either.
- **The day is worked out for you**: the alarm goes off the next time the clock shows that time. Ask
  for 10 AM at 1 AM and it goes off that same morning. Ask for 6:30 AM at 11 PM and it goes off tomorrow.
- Running it again replaces the alarm you set before.
- The scheduled alarm of that same morning is skipped, whether it is earlier or up to 6 hours
  later, and its warm-up moves to the new time.
- It goes off even if the bed is off. If the bed is on, it stays on for the alarm and turns off 30
  minutes after it.
- The app shows the waiting alarm on the **Temperature** page. Tap its time there to change it or
  go back to the schedule.

## 3. Check the bed

Says what the bed is set to and what it has reached, on the -10 to +10 scale.

1. Open **Shortcuts** and tap **+**.
2. Add **Get Contents of URL** and set the URL to `http://<pod>/api/deviceStatus/dial`.
   Leave the method as `GET`.
3. Add **Get Dictionary Value** and set it to get the value for `summary`.
4. Add **Show Result** (or **Speak Text** for Siri).
5. Name it "Bed status".

It answers with a sentence such as "Both sides set to -2, now at -3" or "Left set to +5, now at +4. Right off."

## More one-step shortcuts

Each is one **Get Contents of URL** action with **Method** `POST` and **Request Body** `JSON`,
built the same way as shortcut 1 but with fixed values instead of a question.

| Shortcut | URL | JSON fields |
|---|---|---|
| Turn the bed off | `http://<pod>/api/deviceStatus` | Dictionary `left` with Boolean `isOn` = false, and the same for `right` |
| Stop a vibrating alarm | `http://<pod>/api/deviceStatus` | Dictionary `left` with Boolean `isAlarmVibrating` = false |
| Next alarm 30 minutes later | `http://<pod>/api/alarm/time` | Number `shiftMinutes` = 30 (negative for earlier) |
| Cancel the one-time alarm | `http://<pod>/api/alarm/time/cancel` | None |
| Change the weekly wake-up time | `http://<pod>/api/alarm/time` | Text `time`, and Array `days` of Text such as `monday`. The bed's off time moves with it |

Stopping an alarm on one side stops both when the sides are linked. Everything the app can do is
in [server/API.md](../server/API.md), including whether someone is in bed
(`GET /api/metrics/presence/sensors`, Pod 5).

## One side only

Add a **Text** field `side` with the value `left` or `right` to shortcut 1 or 2. If the sides are
linked in the app, both sides change anyway.

## Troubleshooting

- **The shortcut times out**: check that `http://<pod>` opens in Safari on the same phone. A Pod installed before version 3.2.0 needs `:3000` after the name until it is updated. If
  you used `bed`, check Tailscale is connected.
- **"Invalid request data" (HTTP 400)**: a field has the wrong type or value. `dial` must be a Number
  field from -10 to 10; `side` and `time` must be Text fields, and `time` must contain a time of day.
- **It stopped working after a while**: if the shortcut uses a number, the Pod's address changed.
  Switch to a name from the table above, or reserve the address in your router.
