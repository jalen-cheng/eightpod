#!/bin/bash
# Updates EightPod from the saved source, keeping settings and schedules. If anything fails the
# previous install is put back. However the script ends, the server is enabled and started again
# and the internet block is switched back on.

set -e

print_json_if_exists() {
  local file_path="$1"
  local label="$2"

  if [ -f "$file_path" ]; then
    python3 -m json.tool "$file_path" \
      | sed 's/^/      /' \
      | sed $'s/^/\033[0;90m/' \
      | sed $'s/$/\033[0m/'
  else
    echo "File not found: $file_path ❌"
  fi
}
print_json_if_exists "/home/dac/free-sleep/server/src/serverInfo.json" "Server info"

BACKUP_PATH="/home/dac/free-sleep-backup"
APP_DIR="/home/dac/free-sleep"
# A stalled download must not hold the internet open: the update unit has no time limit of its own
INSTALLER_DOWNLOAD_SECONDS=120

services_to_restore=""
server_was_disabled=false
internet_was_unblocked=false
update_succeeded=false

# Puts the previous install back when the new one is missing or failed
restore_previous_install() {
  if [ ! -d "$BACKUP_PATH" ]; then
    return 0
  fi
  echo "Restoring the previous install from $BACKUP_PATH..."
  # The installer moves node_modules out of the backup to reuse them; give them back
  if [ ! -d "$BACKUP_PATH/server/node_modules" ] && [ -d "$APP_DIR/server/node_modules" ]; then
    mv "$APP_DIR/server/node_modules" "$BACKUP_PATH/server/node_modules" || true
  fi
  rm -rf "$APP_DIR"
  mv "$BACKUP_PATH" "$APP_DIR"
}

# Runs on every exit, including a failed step: without it a failure part-way would leave the
# server disabled and the firewall open until the next reboot.
finish_update() {
  exit_status=$?
  trap - EXIT
  set +e
  if [ "$update_succeeded" != true ]; then
    restore_previous_install
  fi
  if [ "$server_was_disabled" = true ]; then
    systemctl enable free-sleep
  fi
  for service_name in $services_to_restore; do
    systemctl start "$service_name"
  done
  systemctl start free-sleep
  if [ "$internet_was_unblocked" = true ]; then
    # Options chosen earlier (e.g. ALLOW_SENTRY) are read from the saved config
    sh "$APP_DIR/scripts/block_internet_access.sh" \
      || echo "WARNING: could not switch the internet block back on. Reboot the Pod to restore it." >&2
  fi
  if [ "$update_succeeded" != true ]; then
    echo "Update failed; the previous installation was restored." >&2
    [ "$exit_status" -eq 0 ] && exit_status=1
    exit "$exit_status"
  fi
  echo -e "\033[0;32mUpdate completed successfully!\033[0m"
  echo -e "\033[0;32mRestart your pod with 'reboot -h now'\033[0m"
  exit 0
}
trap finish_update EXIT

# Keep biometrics stopped through the downloaded installer, including older installers.
for service_name in free-sleep-stream free-sleep; do
  if systemctl is-active --quiet "$service_name"; then
    services_to_restore="$service_name $services_to_restore"
    systemctl stop "$service_name"
  fi
done

if [ -f /persistent/free-sleep-data/free-sleep.db ]; then
  sh "$APP_DIR/scripts/backup_database.sh" \
    /persistent/free-sleep-data/free-sleep.db \
    /persistent/free-sleep-data/free-sleep-copy.db
fi

server_was_disabled=true
systemctl disable free-sleep

# Unblock internet first. Temporary: the saved rules stay, so a reboot mid-update comes back blocked.
internet_was_unblocked=true
sh "$APP_DIR/scripts/unblock_internet_access.sh" --temporary

# Where to update from: the source saved by install.sh, so an install from another repository
# keeps following it
UPDATE_SOURCE_CONFIG="/etc/free-sleep/update_source.conf"
read_saved_update_source() {
  if [ -f "$UPDATE_SOURCE_CONFIG" ]; then
    grep -E "^$1=[A-Za-z0-9._/-]+\$" "$UPDATE_SOURCE_CONFIG" | tail -n 1 | cut -d= -f2 || true
  fi
}
FREE_SLEEP_REPO="${FREE_SLEEP_REPO:-$(read_saved_update_source FREE_SLEEP_REPO)}"
# EightPod installs and updates from its own repository unless told otherwise
FREE_SLEEP_REPO="${FREE_SLEEP_REPO:-jalen-cheng/eightpod}"
FREE_SLEEP_BRANCH="${FREE_SLEEP_BRANCH:-$(read_saved_update_source FREE_SLEEP_BRANCH)}"
FREE_SLEEP_BRANCH="${FREE_SLEEP_BRANCH:-main}"
export FREE_SLEEP_REPO FREE_SLEEP_BRANCH
INSTALLER_URL="https://raw.githubusercontent.com/$FREE_SLEEP_REPO/$FREE_SLEEP_BRANCH/scripts/install.sh"

echo "Attempting to reinstall free-sleep from $FREE_SLEEP_REPO ($FREE_SLEEP_BRANCH)..."
# Downloaded before the current install is moved aside, so a failed download changes nothing.
# Checked separately: running an empty script after a failed curl would exit successfully.
installer_source=$(curl -fsSL --connect-timeout 20 --max-time "$INSTALLER_DOWNLOAD_SECONDS" "$INSTALLER_URL") || installer_source=""
if [ -z "$installer_source" ]; then
  echo "Could not download the installer from $INSTALLER_URL" >&2
  exit 1
fi

if [ -d "$APP_DIR" ]; then
  echo "Backing up current free-sleep to $BACKUP_PATH"
  # A backup left by an update that was cut short would otherwise swallow this one
  rm -rf "$BACKUP_PATH"
  mv "$APP_DIR" "$BACKUP_PATH"
fi

if /bin/bash -c "$installer_source" && [ -d "$APP_DIR" ]; then
  echo "Reinstall successful."
  update_succeeded=true
  rm -rf "$BACKUP_PATH"
else
  echo "Reinstall failed."
fi
