# Control your Pod from iPhone with Apple Shortcuts

Free Sleep exposes a local REST API, so the Shortcuts app can control your Pod without opening a browser.
You do not need an Apple developer account. Shortcuts also work from the Home Screen, the Lock Screen,
Control Center, the Action button, Siri, and Automations (for example "when my Sleep Focus turns on").

Requirements:
- Your iPhone is on the same network as the Pod (or can otherwise reach its local IP).
- You know the Pod's IP address (step 14 of [INSTALLATION.md](../INSTALLATION.md)). Give it a fixed IP in your router so shortcuts keep working.

Both shortcuts below ask you for a value each time you run them. Replace `<pod-ip>` with your Pod's address.
Both apply to both sides unless you add a side (see [One side only](#one-side-only)). The first run asks for permission to connect to
devices on your local network; allow it.

## 1. Set the temperature (-10 to +10)

Asks for a number on the same scale as the Pod's own app, turns your side on, and sets it.

1. Open **Shortcuts** and tap **+**.
2. Add **Ask for Input**. Set the type to **Number**, the prompt to "Bed temperature, -10 to 10", and
   switch on **Allow Negative Numbers**.
3. Add **Get Contents of URL** and set the URL to `http://<pod-ip>:3000/api/deviceStatus/dial`.
4. Expand it and set **Method** to `POST` and **Request Body** to `JSON`.
5. Add a **Number** field `dial` and pick **Provided Input** (the answer from step 2) as its value.
6. Name it "Bed temperature".

-10 is coldest, 0 is neutral, +10 is hottest. Halves such as 2.5 work. Anything outside -10 to 10 is refused.

## 2. Set an alarm

Asks for a time and sets a one-time alarm. Your weekly schedule is not changed.

1. Open **Shortcuts** and tap **+**.
2. Add **Ask for Input**. Set the type to **Time** and the prompt to "Alarm time".
3. Add **Format Date**. Set **Date Format** to **Custom** and the format string to `HH:mm`.
4. Add **Get Contents of URL** and set the URL to `http://<pod-ip>:3000/api/alarm/time`.
5. Expand it and set **Method** to `POST` and **Request Body** to `JSON`.
6. Add a **Text** field `time` and pick **Formatted Date** (from step 3) as its value.
7. Name it "Bed alarm".

How the time is understood:
- **AM and PM** come from the time picker (or from what you tell Siri, such as "ten AM"). Step 3 turns
  it into 24-hour time for the Pod, so 10 PM is sent as `22:00`.
- **The day is worked out for you**: the alarm goes off the next time the clock shows that time. Ask
  for 10 AM at 1 AM and it goes off that same morning. Ask for 6:30 AM at 11 PM and it goes off tomorrow.
- Running it again replaces the alarm you set before.
- A scheduled alarm that would have gone off before it is skipped.
- The side has to be on at that time, or the alarm is skipped.
- The app shows the waiting alarm, and can cancel it, under **Schedules > One-time alarm**.

## One side only

Add a **Text** field `side` with the value `left` or `right` to either shortcut. If the sides are
linked in the app, both sides change anyway.

## Troubleshooting

- **The shortcut times out**: check that the phone is on the same network and that `http://<pod-ip>:3000` opens in Safari.
- **"Invalid request data" (HTTP 400)**: a field has the wrong type or value. `dial` must be a Number
  field from -10 to 10; `side` and `time` must be Text fields.
- **It stopped working after a while**: the Pod's IP address changed. Reserve an IP for it in your router.

Other requests (turning a side off, dismissing an alarm, moving an alarm by minutes, changing the
weekly alarm) are in [server/API.md](../server/API.md).
