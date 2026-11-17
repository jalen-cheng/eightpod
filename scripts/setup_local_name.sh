#!/bin/sh
# Makes the Pod answer to "<hostname>.local" on the home network (for example
# http://eight-pod.local:3000), so the app and phone shortcuts keep working when the router
# hands the Pod a different address.
#
# It switches on the mDNS responder in systemd-resolved, which the Pod already runs. Nothing is
# installed and the Wi-Fi connection is not restarted. The internet block allows the traffic
# (link-local multicast on UDP 5353, which routers do not forward).
#
# Not run by the installer: Eight Sleep ships the Pod with this responder switched off to reduce
# what listens on the network (/etc/systemd/resolved.conf.d/10-eight-hardening.conf). This adds a
# later drop-in that switches it back on, for the home network only. Run it if you want the name.
#
# Usage:
#   sh setup_local_name.sh            Switch the name on
#   sh setup_local_name.sh disable    Switch it off again
set -eu

ACTION="${1:-enable}"
# Overridable so the script can be tested away from a Pod
RESOLVED_DROP_IN_DIR="${RESOLVED_DROP_IN_DIR:-/etc/systemd/resolved.conf.d}"
DROP_IN_FILE="$RESOLVED_DROP_IN_DIR/free-sleep-mdns.conf"

if ! systemctl is-active --quiet systemd-resolved; then
  echo "systemd-resolved is not running on this Pod, so a .local name cannot be set up this way." >&2
  exit 0
fi

if [ "$ACTION" = "disable" ]; then
  MDNS_SETTING="no"
  rm -f "$DROP_IN_FILE"
else
  MDNS_SETTING="yes"
  mkdir -p "$RESOLVED_DROP_IN_DIR"
  printf '[Resolve]\nMulticastDNS=yes\n' > "$DROP_IN_FILE"
fi
systemctl restart systemd-resolved

# The responder also has to be switched on per network link. NetworkManager remembers the setting
# for each saved connection (applied whenever it connects), and resolvectl applies it to the
# link that is up now, so the connection does not have to be restarted.
nmcli -t -f NAME,DEVICE,TYPE connection show --active | while IFS=: read -r connection_name device connection_type; do
  case "$connection_type" in
    802-11-wireless|802-3-ethernet)
      nmcli connection modify "$connection_name" connection.mdns "$MDNS_SETTING" \
        || echo "WARNING: could not save the setting for connection '$connection_name'" >&2
      resolvectl mdns "$device" "$MDNS_SETTING" \
        || echo "WARNING: could not apply the setting to $device" >&2
      ;;
  esac
done

if [ "$ACTION" = "disable" ]; then
  echo "The Pod no longer answers to a .local name."
else
  echo "The Pod now answers at http://$(hostname).local:3000 on your home network."
  echo "If the internet block is on, re-run block_internet_access.sh once so it allows the name lookups."
fi
