#!/bin/bash
#
# Run once a minute by the timer setup_watchdog.sh installs. When NetworkManager has said for
# three checks in a row that wlan0 is not connected, asks it to connect, then waits ten minutes
# before asking again. It goes by NetworkManager's own word and not by a ping, so a router that
# does not answer pings, or the internet block, cannot set it off.

COUNT_FILE="/run/free-sleep-wifi-down"
CHECKS_BEFORE_ACTING=3
CHECKS_TO_WAIT_AFTER=10

state="$(nmcli -t -f DEVICE,STATE device 2>/dev/null | sed -n 's/^wlan0://p')"
case "$state" in
  connected*|"")
    # Connected, or nothing known about wlan0: nothing to do
    rm -f "$COUNT_FILE"
    exit 0
    ;;
esac

count="$(cat "$COUNT_FILE" 2>/dev/null || echo 0)"
case "$count" in ''|*[!0-9-]*) count=0 ;; esac
count=$((count + 1))
if [ "$count" -ge "$CHECKS_BEFORE_ACTING" ]; then
  echo "wlan0 is '$state' for the ${count}th check in a row: asking NetworkManager to connect"
  nmcli device connect wlan0 || true
  # Counted back up from below zero, so the next ask is that many checks away
  count=$((CHECKS_BEFORE_ACTING - CHECKS_TO_WAIT_AFTER))
fi
echo "$count" > "$COUNT_FILE"
