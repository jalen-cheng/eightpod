#!/bin/sh
# Shared paths for the Tailscale scripts. Source this file after firewall_common.sh, do not execute it.

# On /persistent so the program and its sign-in survive reboots
TAILSCALE_DIR="${TAILSCALE_DIR:-/persistent/tailscale}"
TAILSCALE_BIN_DIR="$TAILSCALE_DIR/bin"
TAILSCALE_STATE_DIR="$TAILSCALE_DIR/state"
# Root-owned copies of the scripts the daily refresh runs: the checkout in /home/dac is
# writable by the dac user, and a root timer must not run files that user can change.
TAILSCALE_SCRIPTS_DIR="$TAILSCALE_DIR/scripts"
TAILSCALE_REFRESH_SCRIPTS="firewall_common.sh tailscale_common.sh block_internet_access.sh setup_firewall_service.sh refresh_tailscale_relays.sh tailscale_relay_addresses.py"
# Codes of the relay regions the Pod may use, space separated on one line (for example "sfo sea")
TAILSCALE_REGIONS_FILE="${TAILSCALE_REGIONS_FILE:-/etc/free-sleep/tailscale_relay_regions}"
# Served from Tailscale's fixed sign-in range, so the Pod can fetch it with the internet block on
TAILSCALE_RELAY_MAP_URL="${TAILSCALE_RELAY_MAP_URL:-https://login.tailscale.com/derpmap/default}"
TAILSCALE_SERVICE_NAME="free-sleep-tailscale.service"
TAILSCALE_REFRESH_SERVICE_NAME="free-sleep-tailscale-relays.service"
TAILSCALE_REFRESH_TIMER_NAME="free-sleep-tailscale-relays.timer"
TAILSCALE_UNIT_DIR="${SYSTEMD_UNIT_DIR:-/etc/systemd/system}"
