#!/bin/sh
# Gives the Pod a short name and makes it answer to "<name>.local" on the home network (for
# example http://bed.local), so the app and phone shortcuts keep working when the router hands
# the Pod a different address.
#
# The name is the Pod's hostname. A Pod that still has its factory name ("eight-pod") is renamed
# to "bed"; a name someone chose is left alone. Tailscale, when set up, takes the same name.
#
# The .local part switches on the mDNS responder in systemd-resolved, which the Pod already runs.
# Nothing is installed and the Wi-Fi connection is not restarted. The internet block allows the
# traffic (link-local multicast on UDP 5353, which routers do not forward).
#
# Eight Sleep ships the Pod with this responder switched off to reduce what listens on the
# network (/etc/systemd/resolved.conf.d/10-eight-hardening.conf). This adds a later drop-in that
# switches it back on, for the home network only. The installer does that by default; "disable"
# switches it off and is remembered, so updates leave it off.
#
# Usage:
#   sh setup_local_name.sh              Switch the name on (renaming a factory-named Pod to "bed")
#   sh setup_local_name.sh name <name>  Rename the Pod and switch the name on
#   sh setup_local_name.sh disable      Switch it off, and keep it off across updates
#   sh setup_local_name.sh auto         Switch it on unless it was disabled (used by install.sh)
set -eu

ACTION="${1:-enable}"
REQUESTED_NAME="${2:-}"
# The name a factory-named Pod is given
DEFAULT_POD_NAME="bed"
# Overridable so the script can be tested away from a Pod
RESOLVED_DROP_IN_DIR="${RESOLVED_DROP_IN_DIR:-/etc/systemd/resolved.conf.d}"
DROP_IN_FILE="$RESOLVED_DROP_IN_DIR/free-sleep-mdns.conf"
HOSTNAME_FILE="${HOSTNAME_FILE:-/etc/hostname}"
HOSTS_FILE="${HOSTS_FILE:-/etc/hosts}"
TAILSCALE_PROGRAM="${TAILSCALE_PROGRAM:-/persistent/tailscale/bin/tailscale}"
# Present when someone chose to switch the name off
OPT_OUT_FILE="${LOCAL_NAME_OPT_OUT_FILE:-/etc/free-sleep/local_name_disabled}"
NAME_CHANGED=false

# Changes the Pod's hostname, which is the name it answers to at home and in Tailscale
rename_pod() {
  new_name="$1"
  case "$new_name" in
    ''|-*|*-|*[!a-z0-9-]*)
      echo "A name may only have lowercase letters, digits and dashes, for example: bed" >&2
      exit 1
      ;;
  esac
  old_name="$(hostname)"
  if [ "$old_name" = "$new_name" ]; then
    return 0
  fi
  echo "$new_name" > "$HOSTNAME_FILE"
  hostname "$new_name"
  # The hosts file maps the name to this machine; programs such as sudo look it up there
  if grep -q "[[:space:]]$old_name\$" "$HOSTS_FILE"; then
    sed -i "s/\([[:space:]]\)$old_name\$/\1$new_name/" "$HOSTS_FILE"
  elif ! grep -q "[[:space:]]$new_name\$" "$HOSTS_FILE"; then
    printf '127.0.1.1 %s\n' "$new_name" >> "$HOSTS_FILE"
  fi
  if [ -x "$TAILSCALE_PROGRAM" ]; then
    "$TAILSCALE_PROGRAM" set --hostname="$new_name" \
      || echo "WARNING: Tailscale kept the old name; rename the machine on its admin page" >&2
  fi
  NAME_CHANGED=true
  echo "The Pod was renamed from $old_name to $new_name."
}

# A Pod still carrying Eight Sleep's name gets the short one
rename_factory_named_pod() {
  case "$(hostname)" in
    eight-pod*) rename_pod "$DEFAULT_POD_NAME" ;;
  esac
}

if [ "$ACTION" = "auto" ]; then
  if [ -f "$OPT_OUT_FILE" ]; then
    echo "The .local name was switched off earlier; leaving it off."
    exit 0
  fi
  rename_factory_named_pod
  # Already on under this name: skip the restart of the name service that switching it on needs
  if [ -f "$DROP_IN_FILE" ] && [ "$NAME_CHANGED" = "false" ]; then
    exit 0
  fi
  ACTION="enable"
elif [ "$ACTION" = "name" ]; then
  rename_pod "$REQUESTED_NAME"
  ACTION="enable"
elif [ "$ACTION" = "enable" ]; then
  rename_factory_named_pod
fi

# Remembered first, so "disable" sticks even where there is no name service to switch off
if [ "$ACTION" = "disable" ]; then
  mkdir -p "$(dirname "$OPT_OUT_FILE")"
  touch "$OPT_OUT_FILE"
fi

if ! systemctl is-active --quiet systemd-resolved; then
  echo "systemd-resolved is not running on this Pod, so a .local name cannot be set up this way." >&2
  exit 0
fi

if [ "$ACTION" = "disable" ]; then
  MDNS_SETTING="no"
  rm -f "$DROP_IN_FILE"
else
  MDNS_SETTING="yes"
  rm -f "$OPT_OUT_FILE"
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
  echo "The Pod now answers at http://$(hostname).local on your home network."
fi
