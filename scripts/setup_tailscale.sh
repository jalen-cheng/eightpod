#!/bin/sh
# Puts Tailscale on the Pod itself, so the Free Sleep page can be reached away from home from
# your own devices only, with no other always-on device at home. See docs/REMOTE_ACCESS.md.
#
# How it stays locked down:
# - Tailscale runs in userspace mode: it adds no routes or firewall rules of its own, and passes
#   incoming connections from your devices to the Pod's local ports (3000 for the page).
# - The internet block opens only Tailscale's sign-in range and the relays of the chosen regions,
#   on TCP 443. All traffic goes through those relays.
# - A daily timer re-reads Tailscale's relay list (refresh_tailscale_relays.sh), so the allowed
#   addresses follow the relays when they move.
#
# Usage (as root on the Pod):
#   sh setup_tailscale.sh               Install, or repair an existing install
#   sh setup_tailscale.sh upgrade       Download the newest Tailscale and restart it
#   sh setup_tailscale.sh login         Sign the Pod in (prints a link to open on your phone)
#   sh setup_tailscale.sh status        Show the connection, regions and allowed relay addresses
#   sh setup_tailscale.sh regions       List every relay region code
#   sh setup_tailscale.sh home-address  Make the Pod's home address (for example 192.168.1.50) work
#                                       over Tailscale too, so one link works at home and away
#   sh setup_tailscale.sh policy        Print the entry for your Tailscale policy file that makes
#                                       all your devices use the Pod's relay regions
#   sh setup_tailscale.sh sync-scripts  Refresh the root-owned script copies and the units, and install a
#                                       newer Tailscale if one is out (run by install.sh on every update)
#   sh setup_tailscale.sh remove        Sign out and remove everything this script added
#
# Options (environment variables):
#   TAILSCALE_RELAY_REGIONS="sfo sea"   Relay regions to allow. Default: the two that answer
#                                       fastest from the Pod, measured during setup.
#   TAILSCALE_AUTH_KEY=tskey-...        For "login": sign in with a key instead of a link.
set -eu

SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
. "$SCRIPT_DIR/firewall_common.sh"
. "$SCRIPT_DIR/tailscale_common.sh"

ACTION="${1:-install}"
TAILSCALE_PACKAGES_URL="${TAILSCALE_PACKAGES_URL:-https://pkgs.tailscale.com/stable}"
DEFAULT_REGION_COUNT=2
TAILSCALE_COMMAND_LINK="${TAILSCALE_COMMAND_LINK:-/usr/bin/tailscale}"

firewall_is_on() {
  [ -f "$FIREWALL_RULES_V4" ]
}

# Tracks a temporary unblock, so any exit (including a failure) puts the block back
internet_was_opened=false
restore_internet_block() {
  if [ "$internet_was_opened" = "true" ]; then
    internet_was_opened=false
    sh "$SCRIPT_DIR/block_internet_access.sh" > /dev/null || echo "WARNING: could not re-apply the internet block" >&2
  fi
}
trap restore_internet_block EXIT

open_internet_for_setup() {
  if firewall_is_on; then
    echo "Opening the internet block for the download. It is put back when this script ends."
    internet_was_opened=true
    sh "$SCRIPT_DIR/unblock_internet_access.sh" --temporary > /dev/null
  fi
}

# Prints the name Tailscale uses for this processor in its download file names
tailscale_architecture() {
  case "$(uname -m)" in
    aarch64|arm64) echo "arm64" ;;
    x86_64) echo "amd64" ;;
    armv7l) echo "arm" ;;
    *) echo "Unsupported processor: $(uname -m)" >&2; return 1 ;;
  esac
}

# Downloads the newest stable Tailscale, checks it against the published checksum, and puts
# the two programs in $TAILSCALE_BIN_DIR.
download_tailscale() {
  architecture=$(tailscale_architecture)
  download_dir=$(mktemp -d "$TAILSCALE_DIR/download.XXXXXX")
  package_index=$(curl -fsSL --max-time 30 "$TAILSCALE_PACKAGES_URL/?mode=json")
  tarball_name=$(printf '%s' "$package_index" \
    | python3 -c 'import json, sys; print(json.load(sys.stdin)["Tarballs"][sys.argv[1]])' "$architecture")
  if ! echo "$tarball_name" | grep -Eq '^tailscale_[0-9.]+_[a-z0-9]+\.tgz$'; then
    echo "Unexpected download name from Tailscale: $tarball_name" >&2
    rm -rf "$download_dir"
    return 1
  fi

  echo "Downloading $tarball_name..."
  curl -fsSL --max-time 300 -o "$download_dir/$tarball_name" "$TAILSCALE_PACKAGES_URL/$tarball_name"
  expected_checksum=$(curl -fsSL --max-time 30 "$TAILSCALE_PACKAGES_URL/$tarball_name.sha256" | tr -d '[:space:]')
  actual_checksum=$(sha256sum "$download_dir/$tarball_name" | cut -d' ' -f1)
  if [ -z "$expected_checksum" ] || [ "$expected_checksum" != "$actual_checksum" ]; then
    echo "The download does not match Tailscale's published checksum; nothing was installed." >&2
    rm -rf "$download_dir"
    return 1
  fi

  tar -xzf "$download_dir/$tarball_name" -C "$download_dir"
  unpacked_dir="$download_dir/${tarball_name%.tgz}"
  mkdir -p "$TAILSCALE_BIN_DIR"
  for program_name in tailscale tailscaled; do
    # Copied beside the old program and moved over it, since a running program cannot be overwritten
    cp "$unpacked_dir/$program_name" "$TAILSCALE_BIN_DIR/$program_name.new"
    chmod 755 "$TAILSCALE_BIN_DIR/$program_name.new"
    mv "$TAILSCALE_BIN_DIR/$program_name.new" "$TAILSCALE_BIN_DIR/$program_name"
  done
  chown -R root:root "$TAILSCALE_BIN_DIR"
  rm -rf "$download_dir"
}

# Installs a newer Tailscale when one is out. Called while the internet is open (install.sh runs
# during a Free Sleep update), so Tailscale is kept current by the same step that updates Free Sleep.
upgrade_if_newer() {
  installed_version=$("$TAILSCALE_BIN_DIR/tailscale" version | head -n 1)
  latest_version=$(curl -fsSL --max-time 30 "$TAILSCALE_PACKAGES_URL/?mode=json" \
    | python3 -c 'import json, sys; print(json.load(sys.stdin)["TarballsVersion"])') || return 0
  if [ -z "$latest_version" ] || [ "$latest_version" = "$installed_version" ]; then
    echo "Tailscale $installed_version is current."
    return 0
  fi
  echo "Upgrading Tailscale from $installed_version to $latest_version..."
  download_tailscale
  systemctl restart "$TAILSCALE_SERVICE_NAME"
}

# Copies the scripts the daily refresh needs to a root-owned folder
copy_refresh_scripts() {
  mkdir -p "$TAILSCALE_SCRIPTS_DIR"
  for script_name in $TAILSCALE_REFRESH_SCRIPTS; do
    cp "$SCRIPT_DIR/$script_name" "$TAILSCALE_SCRIPTS_DIR/$script_name"
  done
  chown -R root:root "$TAILSCALE_SCRIPTS_DIR"
  chmod 755 "$TAILSCALE_SCRIPTS_DIR"
  chmod 644 "$TAILSCALE_SCRIPTS_DIR"/*
}

# Settles which relay regions to allow: the environment, then the saved choice, then the
# regions that answer fastest from here. Needs the internet open for the measurement.
choose_relay_regions() {
  relay_regions="${TAILSCALE_RELAY_REGIONS:-}"
  if [ -z "$relay_regions" ] && [ -f "$TAILSCALE_REGIONS_FILE" ]; then
    relay_regions=$(head -n 1 "$TAILSCALE_REGIONS_FILE")
  fi
  if [ -z "$relay_regions" ]; then
    echo "Measuring which relay regions are nearest..."
    relay_regions=$(curl -fsS --max-time 30 "$TAILSCALE_RELAY_MAP_URL" \
      | python3 "$SCRIPT_DIR/tailscale_relay_addresses.py" --nearest "$DEFAULT_REGION_COUNT")
  fi
  if ! echo "$relay_regions" | grep -Eq '^[a-z0-9-]+( [a-z0-9-]+)*$'; then
    echo "Relay regions must be codes separated by spaces, for example \"sfo sea\". Got: '$relay_regions'" >&2
    echo "List them with: sh setup_tailscale.sh regions" >&2
    return 1
  fi
  mkdir -p "$(dirname "$TAILSCALE_REGIONS_FILE")"
  echo "$relay_regions" > "$TAILSCALE_REGIONS_FILE"
  chmod 644 "$TAILSCALE_REGIONS_FILE"
  echo "Relay regions: $relay_regions"
}

# Writes the units: Tailscale itself, and the daily refresh of the relay addresses.
# Neither may ask for network-online.target: nothing else on the Pod does, and pulling it in
# makes the boot wait two minutes for a network service the Pod does not use, which holds up
# the bed's own firmware. Tailscale copes with starting before the network is up.
write_units() {
  cat > "$TAILSCALE_UNIT_DIR/$TAILSCALE_SERVICE_NAME" <<EOF
[Unit]
Description=Tailscale for Free Sleep (userspace mode, relays only)
After=network.target free-sleep-firewall.service

[Service]
ExecStart=$TAILSCALE_BIN_DIR/tailscaled --tun=userspace-networking --statedir=$TAILSCALE_STATE_DIR --socket=/run/tailscale/tailscaled.sock --no-logs-no-support
RuntimeDirectory=tailscale
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

  cat > "$TAILSCALE_UNIT_DIR/$TAILSCALE_REFRESH_SERVICE_NAME" <<EOF
[Unit]
Description=Refresh the Tailscale relay addresses the Free Sleep internet block allows

[Service]
Type=oneshot
ExecStart=/bin/sh $TAILSCALE_SCRIPTS_DIR/refresh_tailscale_relays.sh
EOF

  cat > "$TAILSCALE_UNIT_DIR/$TAILSCALE_REFRESH_TIMER_NAME" <<EOF
[Unit]
Description=Daily refresh of the Tailscale relay addresses

[Timer]
OnBootSec=3min
OnUnitActiveSec=1d
RandomizedDelaySec=10min

[Install]
WantedBy=timers.target
EOF
  systemctl daemon-reload
}

install_tailscale() {
  mkdir -p "$TAILSCALE_DIR" "$TAILSCALE_STATE_DIR"
  chmod 700 "$TAILSCALE_STATE_DIR"
  open_internet_for_setup
  if [ "$ACTION" = "upgrade" ] || [ ! -x "$TAILSCALE_BIN_DIR/tailscaled" ]; then
    download_tailscale
  fi
  choose_relay_regions
  copy_refresh_scripts
  ln -sf "$TAILSCALE_BIN_DIR/tailscale" "$TAILSCALE_COMMAND_LINK"

  # The address file marks Tailscale as running on the Pod for the block script; the refresh
  # fills it in. The block is re-applied below, once, whether or not the list changed.
  save_firewall_option ALLOW_TAILSCALE true
  touch "$TAILSCALE_RELAY_ADDRESSES_FILE"
  SKIP_FIREWALL_RELOAD=true sh "$TAILSCALE_SCRIPTS_DIR/refresh_tailscale_relays.sh"
  if firewall_is_on; then
    internet_was_opened=false
    sh "$TAILSCALE_SCRIPTS_DIR/block_internet_access.sh"
  fi

  write_units
  systemctl enable "$TAILSCALE_SERVICE_NAME" "$TAILSCALE_REFRESH_TIMER_NAME"
  systemctl restart "$TAILSCALE_SERVICE_NAME"
  systemctl restart "$TAILSCALE_REFRESH_TIMER_NAME"

  echo ""
  echo "Tailscale $("$TAILSCALE_BIN_DIR/tailscale" version | head -n 1) is installed and running."
  echo "Next: sign the Pod in with 'sh $SCRIPT_DIR/setup_tailscale.sh login'"
}

login_tailscale() {
  if [ -n "${TAILSCALE_AUTH_KEY:-}" ]; then
    "$TAILSCALE_BIN_DIR/tailscale" up --hostname="$(hostname)" --accept-dns=false --auth-key="$TAILSCALE_AUTH_KEY"
  else
    echo "Open the link below on a phone or computer and sign in to your Tailscale account."
    "$TAILSCALE_BIN_DIR/tailscale" up --hostname="$(hostname)" --accept-dns=false
  fi
  echo "Signed in. On a device with Tailscale, the page is at: http://$(hostname):3000"
  echo "In the Tailscale admin page, switch off key expiry for this Pod so it stays signed in."
}

# Offers the Pod's own home address to the tailnet as a one-address route. A device with Tailscale
# on then reaches http://<home address>:3000 from anywhere, and the same link works at home with
# Tailscale off. The route has to be approved once in the Tailscale admin page.
advertise_home_address() {
  home_address=$(ip -4 route get 1.1.1.1 2>/dev/null | sed -n 's/.* src \([0-9.]*\).*/\1/p' | head -n 1)
  if ! echo "$home_address" | grep -Eq '^(10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[01])\.)'; then
    echo "Could not find the Pod's home network address (got '$home_address')." >&2
    return 1
  fi
  "$TAILSCALE_BIN_DIR/tailscale" set --advertise-routes="$home_address/32"
  echo "Offered $home_address to your Tailscale network."
  echo "Approve it once: Tailscale admin page > Machines > $(hostname) > Edit route settings > tick $home_address/32."
  echo "Then http://$home_address:3000 works at home and away. Reserve that address in your router so it never changes."
}

show_status() {
  "$TAILSCALE_BIN_DIR/tailscale" status || true
  echo ""
  echo "Relay regions: $(head -n 1 "$TAILSCALE_REGIONS_FILE" 2>/dev/null || echo 'none chosen')"
  echo "Allowed relay addresses:"
  sed 's/^/  /' "$TAILSCALE_RELAY_ADDRESSES_FILE" 2>/dev/null || echo "  none"
}

remove_tailscale() {
  if [ -x "$TAILSCALE_BIN_DIR/tailscale" ]; then
    "$TAILSCALE_BIN_DIR/tailscale" logout 2>/dev/null || true
  fi
  for unit_name in "$TAILSCALE_REFRESH_TIMER_NAME" "$TAILSCALE_REFRESH_SERVICE_NAME" "$TAILSCALE_SERVICE_NAME"; do
    if [ -f "$TAILSCALE_UNIT_DIR/$unit_name" ]; then
      systemctl disable --now "$unit_name" 2>/dev/null || true
      rm -f "$TAILSCALE_UNIT_DIR/$unit_name"
    fi
  done
  systemctl daemon-reload
  # Only remove the command link when it is ours
  if [ "$(readlink "$TAILSCALE_COMMAND_LINK" 2>/dev/null || true)" = "$TAILSCALE_BIN_DIR/tailscale" ]; then
    rm -f "$TAILSCALE_COMMAND_LINK"
  fi
  rm -f "$TAILSCALE_RELAY_ADDRESSES_FILE" "$TAILSCALE_REGIONS_FILE"
  case "$TAILSCALE_DIR" in
    ""|"/") echo "Refusing to delete '$TAILSCALE_DIR'" >&2 ;;
    *) rm -rf "$TAILSCALE_DIR" ;;
  esac
  save_firewall_option ALLOW_TAILSCALE false
  if firewall_is_on; then
    sh "$SCRIPT_DIR/block_internet_access.sh"
  fi
  echo "Tailscale was removed from the Pod. Delete the Pod from the Tailscale admin page if it is still listed."
}

case "$ACTION" in
  install|upgrade)
    install_tailscale
    ;;
  login)
    login_tailscale
    ;;
  status)
    show_status
    ;;
  home-address)
    advertise_home_address
    ;;
  regions)
    curl -fsS --max-time 30 "$TAILSCALE_RELAY_MAP_URL" | python3 "$SCRIPT_DIR/tailscale_relay_addresses.py" --list
    ;;
  policy)
    # shellcheck disable=SC2046 # the saved region codes are separate arguments on purpose
    curl -fsS --max-time 30 "$TAILSCALE_RELAY_MAP_URL" \
      | python3 "$SCRIPT_DIR/tailscale_relay_addresses.py" --policy $(head -n 1 "$TAILSCALE_REGIONS_FILE")
    ;;
  sync-scripts)
    # Nothing to do on a Pod without Tailscale
    if [ -d "$TAILSCALE_SCRIPTS_DIR" ]; then
      copy_refresh_scripts
      # Rewritten too, so a fix to the units reaches Pods that already have Tailscale
      write_units
      upgrade_if_newer || echo "WARNING: could not check for a newer Tailscale" >&2
    fi
    ;;
  remove)
    remove_tailscale
    ;;
  *)
    echo "Unknown action '$ACTION'. Use install, upgrade, login, status, home-address, regions, policy, sync-scripts or remove." >&2
    exit 1
    ;;
esac
