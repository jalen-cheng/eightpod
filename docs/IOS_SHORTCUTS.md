# Control your Pod from iPhone with Apple Shortcuts

Free Sleep exposes a local REST API, so the Shortcuts app can control your Pod without opening a browser.
You do not need an Apple developer account. Shortcuts also work from the Home Screen, the Lock Screen,
Control Center, the Action button, Siri, and Automations (for example "when my Sleep Focus turns on").

Requirements:
- Your iPhone is on the same network as the Pod (or can otherwise reach its local IP).
- You know the Pod's IP address (step 14 of [INSTALLATION.md](../INSTALLATION.md)). Give it a fixed IP in your router so shortcuts keep working.

The first two shortcuts below ask you for a value each time you run them; the third reads the bed back. Replace `<pod-ip>` with your Pod's address.
The first two apply to both sides unless you add a side (see [One side only](#one-side-only)). The first run asks for permission to connect to
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
3. Add **Get Contents of URL** and set the URL to `http://<pod-ip>:3000/api/alarm/time`.
4. Expand it and set **Method** to `POST` and **Request Body** to `JSON`.
5. Add a **Text** field `time` and pick **Provided Input** (the answer from step 2) as its value.
6. Name it "Bed alarm".

How the time is understood:
- **AM and PM** come from the time picker (or from what you tell Siri, such as "ten AM"). The Pod
  reads the time however the phone writes it: `22:00`, `10:00 PM`, or a full date containing either.
- **The day is worked out for you**: the alarm goes off the next time the clock shows that time. Ask
  for 10 AM at 1 AM and it goes off that same morning. Ask for 6:30 AM at 11 PM and it goes off tomorrow.
- Running it again replaces the alarm you set before.
- A scheduled alarm that would have gone off before it is skipped.
- If it is later than your schedule's off time (by up to 6 hours), the bed stays on until it has
  gone off. It goes off even if the side is off.
- The app shows the waiting alarm, and can cancel it, under **Schedules > One-time alarm**.

## 3. Check the temperature

Shows what the bed is set to and what it has reached, on the same -10 to +10 scale.

1. Open **Shortcuts** and tap **+**.
2. Add **Get Contents of URL** and set the URL to `http://<pod-ip>:3000/api/deviceStatus/dial`.
   Leave the method as `GET`.
3. Add **Get Dictionary Value** and set it to get the value for `summary`.
4. Add **Show Result** (or **Speak Text** for Siri).
5. Name it "Bed status".

It answers with a sentence such as "Left set to +5, now at +4. Right off."

## One side only

Add a **Text** field `side` with the value `left` or `right` to shortcut 1 or 2. If the sides are
linked in the app, both sides change anyway.

## Troubleshooting

- **The shortcut times out**: check that the phone is on the same network and that `http://<pod-ip>:3000` opens in Safari.
- **"Invalid request data" (HTTP 400)**: a field has the wrong type or value. `dial` must be a Number
  field from -10 to 10; `side` and `time` must be Text fields, and `time` must contain a time of day.
- **It stopped working after a while**: the Pod's IP address changed. Reserve an IP for it in your router.

Other requests (turning a side off, dismissing an alarm, moving an alarm by minutes, changing the
weekly alarm) are in [server/API.md](../server/API.md).
