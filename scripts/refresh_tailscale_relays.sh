#!/bin/sh
# Keeps the list of Tailscale relay addresses the internet block allows up to date.
#
# Tailscale moves its relays now and then, so a list typed in once would go stale. Its relay map
# is served from the one address range Tailscale keeps fixed, which the block always allows when
# Tailscale runs on the Pod, so the Pod can fetch the current list itself. Run daily by
# free-sleep-tailscale-relays.timer (see setup_tailscale.sh), and safe to run by hand.
#
# A failed download or an empty answer changes nothing: the last good list stays in place.
set -eu

SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
. "$SCRIPT_DIR/firewall_common.sh"
. "$SCRIPT_DIR/tailscale_common.sh"

if [ ! -f "$TAILSCALE_REGIONS_FILE" ]; then
  echo "No relay regions chosen yet. Run setup_tailscale.sh first." >&2
  exit 1
fi
relay_regions=$(head -n 1 "$TAILSCALE_REGIONS_FILE")

relay_map=$(curl -fsS --max-time 30 "$TAILSCALE_RELAY_MAP_URL") || {
  echo "Could not download the relay map; keeping the current list." >&2
  exit 1
}
# shellcheck disable=SC2086 # the region codes are separate arguments on purpose
new_addresses=$(printf '%s' "$relay_map" | python3 "$SCRIPT_DIR/tailscale_relay_addresses.py" $relay_regions)
if [ -z "$new_addresses" ]; then
  echo "The relay map has no addresses for: $relay_regions. Keeping the current list." >&2
  exit 1
fi

current_addresses=$(cat "$TAILSCALE_RELAY_ADDRESSES_FILE" 2>/dev/null || true)
if [ "$new_addresses" = "$current_addresses" ]; then
  echo "Relay addresses are unchanged."
  exit 0
fi

# Written beside the real file and moved into place, so a half-written list is never read
mkdir -p "$(dirname "$TAILSCALE_RELAY_ADDRESSES_FILE")"
printf '%s\n' "$new_addresses" > "$TAILSCALE_RELAY_ADDRESSES_FILE.new"
chmod 644 "$TAILSCALE_RELAY_ADDRESSES_FILE.new"
mv "$TAILSCALE_RELAY_ADDRESSES_FILE.new" "$TAILSCALE_RELAY_ADDRESSES_FILE"
echo "Relay addresses updated for regions: $relay_regions"

# Only re-apply the block when it is on; refreshing the list must never switch it on.
# setup_tailscale.sh skips this step because it re-applies the block itself.
if [ "${SKIP_FIREWALL_RELOAD:-false}" != "true" ] && [ -f "$FIREWALL_RULES_V4" ]; then
  sh "$SCRIPT_DIR/block_internet_access.sh"
fi
