# SevenSleep MCP server

Lets an AI agent (Claude, or any client that speaks the Model Context Protocol) read and control
a Pod running SevenSleep. It runs on your computer, not on the Pod: your client starts it, and
it turns each tool call into one request to the Pod's own API on your network.

**It can change the bed.** Eight of its tools set temperatures, power, alarms, the schedule, the
autopilot and away mode. The Pod's API has no login, so anything that can start this server can
do the same. Most clients ask before running a tool; leave that on. To give an agent the four
reading tools only, set `SEVENSLEEP_READ_ONLY=1`.

## Set it up

You need Node 20 or later, and the computer on the same network as the Pod (or on Tailscale
with it).

```bash
git clone https://github.com/jalen-cheng/sevensleep.git
cd sevensleep/mcp && npm install
```

Then add it to your client. For Claude Code:

```bash
claude mcp add sevensleep -- node /full/path/to/sevensleep/mcp/server.mjs
```

For a client configured with a JSON file (Claude Desktop, Cursor and others):

```json
{
  "mcpServers": {
    "sevensleep": {
      "command": "node",
      "args": ["/full/path/to/sevensleep/mcp/server.mjs"],
      "env": { "SEVENSLEEP_URL": "http://sevensleep.local" }
    }
  }
}
```

| Setting | What it is | When unset |
|---|---|---|
| `SEVENSLEEP_URL` | Where the Pod is. Over Tailscale the port is needed: `http://sevensleep:3000` | `http://sevensleep.local` |
| `SEVENSLEEP_READ_ONLY` | `1` leaves out every tool that changes the bed | All twelve tools |

## Tools

| Tool | What it does | Changes the bed |
|---|---|---|
| `get_bed_status` | On or off, set and measured temperature, alarm going off, for each side | No |
| `get_schedule` | The weekly schedule for a side, or one night of it | No |
| `get_recent_sleep` | The stays in bed the Pod has saved, with its sleep and wake times (Pod 5) | No |
| `get_autopilot` | Whether the autopilot is on, who is asleep, its last change and why (Pod 5) | No |
| `set_temperature` | The temperature a side aims for, 50 to 110°F | Yes |
| `set_power` | A side on or off | Yes |
| `set_one_time_alarm` | An alarm the next time the clock shows a time | Yes |
| `cancel_one_time_alarm` | Drops a waiting one-time alarm | Yes |
| `dismiss_alarm` | Stops an alarm that is vibrating | Yes |
| `set_night_schedule` | One night's bed-on time, starting temperature, wake-up time and alarm | Yes |
| `set_autopilot` | The autopilot on or off, and its base temperature (Pod 5) | Yes |
| `set_away_mode` | Away mode for a side | Yes |

Each takes `side` as `left`, `right` or `both` where a side makes sense. Everything else the API
can do is in [server/API.md](../server/API.md); an agent that can make web requests can use that
directly.

## What was checked

The tools' requests are covered by `tests/mcp.test.mjs`. The server was run through an MCP
client against a stand-in for the Pod (reads, a change, a refused value, a refusal from the Pod,
and a Pod that cannot be reached), and its four reading tools against one real Pod 5. The eight
changing tools have not been run against a real bed through this server; each sends the same
request the app sends.
