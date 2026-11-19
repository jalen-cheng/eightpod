#!/bin/bash
# Exit immediately on error, on undefined variables, and on error in pipelines
set -euo pipefail

# --------------------------------------------------------------------------------
# Variables
# Install source. Forks set FREE_SLEEP_REPO / FREE_SLEEP_BRANCH once on the first install; the
# values are saved so later updates (including the in-app update button) keep using the same source.
UPDATE_SOURCE_CONFIG="/etc/free-sleep/update_source.conf"
read_saved_update_source() {
  if [ -f "$UPDATE_SOURCE_CONFIG" ]; then
    grep -E "^$1=[A-Za-z0-9._/-]+\$" "$UPDATE_SOURCE_CONFIG" | tail -n 1 | cut -d= -f2 || true
  fi
}
FREE_SLEEP_REPO="${FREE_SLEEP_REPO:-$(read_saved_update_source FREE_SLEEP_REPO)}"
# This fork installs and updates from itself unless told otherwise
FREE_SLEEP_REPO="${FREE_SLEEP_REPO:-jalen-cheng/sevensleep}"
# The repository has been renamed twice; a Pod that saved an old name moves to the present one
case "$FREE_SLEEP_REPO" in
  jalen-cheng/eightpod|jalen-cheng/free-sleep) FREE_SLEEP_REPO="jalen-cheng/sevensleep" ;;
esac
FREE_SLEEP_BRANCH="${FREE_SLEEP_BRANCH:-$(read_saved_update_source FREE_SLEEP_BRANCH)}"
FREE_SLEEP_BRANCH="${FREE_SLEEP_BRANCH:-main}"
for source_value in "$FREE_SLEEP_REPO" "$FREE_SLEEP_BRANCH"; do
  if ! echo "$source_value" | grep -Eq '^[A-Za-z0-9._/-]+$'; then
    echo "Invalid FREE_SLEEP_REPO or FREE_SLEEP_BRANCH: $source_value" >&2
    exit 1
  fi
done
REPO_URL="https://github.com/$FREE_SLEEP_REPO/archive/refs/heads/$FREE_SLEEP_BRANCH.zip"
# The zip is unpacked into a folder of its own, and the one folder inside it is the code. Its
# name is not guessed: GitHub serves a renamed repository from its old address under its new name.
UNPACK_DIR="free-sleep-unpacked"
ZIP_FILE="free-sleep.zip"
REPO_DIR="/home/dac/free-sleep"
SERVER_DIR="$REPO_DIR/server"
USERNAME="dac"

# Stop both services before replacing code or touching the database. Restore them on failure too.
services_to_restore=""
restore_services() {
  for service_name in $services_to_restore; do
    systemctl start "$service_name" || true
  done
}
trap restore_services EXIT
for service_name in free-sleep-stream free-sleep; do
  if systemctl is-active --quiet "$service_name"; then
    services_to_restore="$service_name $services_to_restore"
    systemctl stop "$service_name"
  fi
done

# --------------------------------------------------------------------------------
# Download the repository
echo "Downloading the repository from $FREE_SLEEP_REPO ($FREE_SLEEP_BRANCH)..."
curl -fL --connect-timeout 20 --max-time 600 -o "$ZIP_FILE" "$REPO_URL"

echo ""
echo "Unzipping the repository..."
rm -rf "$UNPACK_DIR"
mkdir "$UNPACK_DIR"
unzip -o -q "$ZIP_FILE" -d "$UNPACK_DIR"
echo "Removing the zip file..."
rm -f "$ZIP_FILE"
EXTRACTED_DIR=""
for unpacked_entry in "$UNPACK_DIR"/*/; do
  EXTRACTED_DIR="${unpacked_entry%/}"
  break
done
if [ ! -d "$EXTRACTED_DIR/server" ]; then
  echo "The download did not unpack to the code it should hold." >&2
  exit 1
fi

# Clean up existing directory and move new code into place
echo "Setting up the installation directory..."
rm -rf "$REPO_DIR"
mv "$EXTRACTED_DIR" "$REPO_DIR"
rm -rf "$UNPACK_DIR"

mkdir -p "$(dirname "$UPDATE_SOURCE_CONFIG")"
printf 'FREE_SLEEP_REPO=%s\nFREE_SLEEP_BRANCH=%s\n' "$FREE_SLEEP_REPO" "$FREE_SLEEP_BRANCH" > "$UPDATE_SOURCE_CONFIG"


chown -R "$USERNAME":"$USERNAME" "$REPO_DIR"

# Synchronize installed biometrics before restarting services. Old updaters also
# download this installer, so this repairs environments created before new dependencies.
if [ -x /home/dac/venv/bin/python ]; then
  sh "$REPO_DIR/scripts/install_python_packages.sh"
fi

# --------------------------------------------------------------------------------
# Install or update Volta
# - We check once. If it’s not installed, install it.
echo "Checking if Volta is installed for user '$USERNAME'..."
if [ -d "/home/$USERNAME/.volta" ]; then
  echo "Volta is already installed for user '$USERNAME'."
else
  echo "Volta is not installed. Installing for user '$USERNAME'..."
  sudo -u "$USERNAME" bash -c 'curl https://get.volta.sh | bash'
  # Ensure Volta environment variables are in the DAC user’s profile:
  if ! grep -q 'export VOLTA_HOME=' "/home/$USERNAME/.profile"; then
    echo -e '\nexport VOLTA_HOME="/home/dac/.volta"\nexport PATH="$VOLTA_HOME/bin:$PATH"\n' \
      >> "/home/$USERNAME/.profile"
  fi
  echo "Finished installing Volta"
  echo ""
fi


# --------------------------------------------------------------------------------
# Install (or update) Node via Volta
echo "Installing/ensuring Node 24.11.0 via Volta..."
sudo -u "$USERNAME" bash -c "source /home/$USERNAME/.profile && volta install node@24.11.0"

# --------------------------------------------------------------------------------
# Setup /persistent/free-sleep-data (migrate old configs, logs, etc.)
mkdir -p /persistent/free-sleep-data/logs/
mkdir -p /persistent/free-sleep-data/lowdb/

SRC_FILE="/opt/eight/bin/frank.sh"
DEST_FILE="/persistent/free-sleep-data/dac_sock_path.txt"

if [ -f "$DEST_FILE" ]; then
  echo "Destination file $DEST_FILE already exists, skipping copy."
else
  if [ -r "$SRC_FILE" ]; then
    echo "Found $SRC_FILE, searching for dac.sock path..."
    result=$(grep -oP '(?<=DAC_SOCKET=)[^ ]*dac\.sock' "$SRC_FILE" || true)
    if [ -n "$result" ]; then
      echo "$result" > "$DEST_FILE"
      echo "DAC socket path saved to $DEST_FILE"
    else
      echo "No dac.sock path found in $SRC_FILE, skipping write."
    fi
  else
    # Newer firmware (seen on a Pod 5) has no frank.sh; the socket path is set in the frank unit.
    # Without it the server would fall back to the Pod 3 path and never reach the firmware.
    echo "File $SRC_FILE not found, checking the frank service for the dac.sock path..."
    result=$(systemctl cat frank 2>/dev/null | grep -oP '(?<=DAC_SOCKET=)[^ "]*dac\.sock' | head -n 1 || true)
    if [ -n "$result" ]; then
      echo "$result" > "$DEST_FILE"
      echo "DAC socket path saved to $DEST_FILE"
    else
      echo "No dac.sock path found in the frank service, skipping write."
    fi
  fi
fi


# DO NOT REMOVE, OLD VERSIONS WILL LOSE settings & schedules
FILES_TO_MOVE=(
  "/home/dac/free-sleep-database/settingsDB.json:/persistent/free-sleep-data/lowdb/settingsDB.json"
  "/home/dac/free-sleep-database/schedulesDB.json:/persistent/free-sleep-data/lowdb/schedulesDB.json"
  "/home/dac/dac_sock_path.txt:/persistent/free-sleep-data/dac_sock_path.txt"
)

for entry in "${FILES_TO_MOVE[@]}"; do
  IFS=":" read -r SOURCE_FILE DESTINATION <<< "$entry"
  if [ -f "$SOURCE_FILE" ]; then
    mv "$SOURCE_FILE" "$DESTINATION"
    echo "Moved $SOURCE_FILE to $DESTINATION"
  fi
done

if [ -d /persistent/deviceinfo/ ]; then
  chown -R "$USERNAME":"$USERNAME" /persistent/deviceinfo/
fi

if [ -d /deviceinfo/ ]; then
  chown -R "$USERNAME":"$USERNAME" /deviceinfo/
fi

# Change ownership and permissions
chown -R "$USERNAME":"$USERNAME" /persistent/free-sleep-data/
chmod 770 /persistent/free-sleep-data/
chmod g+s /persistent/free-sleep-data/

# --------------------------------------------------------------------------------
# Install server dependencies

BACKUP_PATH="/home/dac/free-sleep-backup/server/package-lock.json"
NEW_PATH="/home/dac/free-sleep/server/package-lock.json"
NODE_MODULES_BACKUP="/home/dac/free-sleep-backup/server/node_modules"
NODE_MODULES_NEW="/home/dac/free-sleep/server/node_modules"

echo "Reviewing npm dependencies for changes..."
if [ -f "$BACKUP_PATH" ] && [ -f "$NEW_PATH" ]; then
  BACKUP_HASH=$(sha256sum "$BACKUP_PATH" | awk '{print $1}')
  NEW_HASH=$(sha256sum "$NEW_PATH" | awk '{print $1}')

  echo "Backup hash: $BACKUP_HASH"
  echo "New hash: $NEW_HASH"

  if [ "$BACKUP_HASH" != "$NEW_HASH" ]; then
    echo "package-lock.json changed — running npm install..."
    sudo -u "$USERNAME" bash -c "cd '$SERVER_DIR' && /home/$USERNAME/.volta/bin/npm install"
  else
    echo "package-lock.json unchanged — restoring node_modules from backup..."
    if [ -d "$NODE_MODULES_BACKUP" ]; then
      mv "$NODE_MODULES_BACKUP" "$NODE_MODULES_NEW"
      chown -R "$USERNAME:$USERNAME" "$NODE_MODULES_NEW" || true
      echo "node_modules restored from backup."
    else
      echo "Backup node_modules not found, running npm install instead..."
      sudo -u "$USERNAME" bash -c "cd '$SERVER_DIR' && /home/$USERNAME/.volta/bin/npm install"
    fi
  fi
else
  echo "One or both package-lock.json files missing, running npm install..."
  sudo -u "$USERNAME" bash -c "cd '$SERVER_DIR' && /home/$USERNAME/.volta/bin/npm install"
fi
echo ""

# --------------------------------------------------------------------------------
# Run Prisma migrations


SRC="/persistent/free-sleep-data/free-sleep.db"
DEST="/persistent/free-sleep-data/free-sleep-copy.db"

if [ -f "$SRC" ]; then
  echo "Verifying and backing up the database prior to migrations..."
  sh "$REPO_DIR/scripts/backup_database.sh" "$SRC" "$DEST"
else
  echo "Source database not found, skipping copying database."
fi




migration_failed="false"

echo "Running Prisma migrations..."
if sudo -u "$USERNAME" bash -c "cd '$SERVER_DIR' && /home/$USERNAME/.volta/bin/npm run migrate deploy"; then
  echo "Prisma migrations completed successfully."
else
  migration_failed="true"
  echo -e "\033[33mWARNING: Prisma migrations failed! \033[0m"
fi


echo ""

# --------------------------------------------------------------------------------
# Create systemd service

SERVICE_FILE="/etc/systemd/system/free-sleep.service"

echo "Creating systemd service file at $SERVICE_FILE..."

# Reading the firmware journal is how a Pod 5 reports its button presses. It needs the
# systemd-journal group; naming a group that does not exist would stop the service from starting,
# so the line is only written where the group exists. The group file is read directly: the Pod
# has no getent command, and asking it made every install leave the group out.
JOURNAL_GROUP_LINE=""
if grep -q '^systemd-journal:' /etc/group 2>/dev/null; then
  JOURNAL_GROUP_LINE="SupplementaryGroups=systemd-journal"
fi

cat > "$SERVICE_FILE" <<EOF
[Unit]
Description=SevenSleep Server
After=network.target

[Service]
ExecStart=/home/$USERNAME/.volta/bin/npm run start
WorkingDirectory=$SERVER_DIR
Restart=always
User=$USERNAME
$JOURNAL_GROUP_LINE
# Lets the server also answer on port 80, so the app opens without ":3000"
AmbientCapabilities=CAP_NET_BIND_SERVICE
Environment=NODE_ENV=production
Environment=VOLTA_HOME=/home/$USERNAME/.volta
Environment=PATH=/home/$USERNAME/.volta/bin:/usr/local/bin:/usr/bin:/bin:/usr/local/sbin:/usr/sbin:/sbin

[Install]
WantedBy=multi-user.target
EOF

echo "Reloading systemd daemon and enabling the service..."
systemctl daemon-reload
systemctl enable free-sleep.service

echo "Starting free-sleep.service..."
systemctl start free-sleep.service

# Recover an enabled streamer even if it was already failing before the update.
if systemctl is-enabled --quiet free-sleep-stream.service; then
  systemctl reset-failed free-sleep-stream.service
  systemctl restart free-sleep-stream.service
fi

echo "Checking free-sleep service status..."
systemctl status free-sleep.service --no-pager || true
echo ""

# -----------------------------------------------------------------------------------------------------
# Create systemd service for updating

UPDATE_SERVICE_FILE="/etc/systemd/system/free-sleep-update.service"
echo "Creating systemd service file at $UPDATE_SERVICE_FILE..."

cat > "$UPDATE_SERVICE_FILE" <<EOF
[Unit]
Description=SevenSleep Updater
After=free-sleep.service

[Service]
Type=oneshot
ExecStart=/home/dac/free-sleep/scripts/update_service.sh
User=root
Group=root
KillMode=process
# Also capture logs at the unit level (append so your file grows)
StandardOutput=append:/persistent/free-sleep-data/logs/free-sleep-update.log
StandardError=append:/persistent/free-sleep-data/logs/free-sleep-update.log

EOF
# --------------------------------------------------------------------------------
# Graceful device time update (optional)

echo "Attempting to update device time from Google..."
# If the curl fails or is blocked, skip with a warning but don't fail the entire script
if date_string="$(curl -s --head http://google.com | grep '^Date: ' | sed 's/Date: //g')" && [ -n "$date_string" ]; then
  date -s "$date_string" || echo "WARNING: Unable to update system time"
else
  echo -e "\033[0;33mWARNING: Unable to retrieve date from Google... Skipping time update.\033[0m"
fi

echo ""
# --------------------------------------------------------------------------------
# Setup passwordless sudo scripts for dac user

SUDOERS_FILE="/etc/sudoers.d/$USERNAME"
echo "Setting up sudoers rules..."
# Reboot
SUDOERS_RULE="$USERNAME ALL=(ALL) NOPASSWD: /sbin/reboot"
if sudo grep -Fxq "$SUDOERS_RULE" "$SUDOERS_FILE" 2>/dev/null; then
  echo "Rule for '$USERNAME' reboot permissions already exists."
else
  echo "$SUDOERS_RULE" | sudo tee "$SUDOERS_FILE" > /dev/null
  sudo chmod 440 "$SUDOERS_FILE"
  echo "Passwordless permission for reboots granted to '$USERNAME'."
fi

# Updates
SUDOERS_UPDATE_RULE="$USERNAME ALL=(root) NOPASSWD: /bin/systemctl start free-sleep-update.service --no-block"
if sudo grep -Fxq "$SUDOERS_UPDATE_RULE" "$SUDOERS_FILE" 2>/dev/null; then
  echo "Rule for '$USERNAME' update permissions already exists."
else
  echo "$SUDOERS_UPDATE_RULE" | sudo tee -a "$SUDOERS_FILE" >> /dev/null
  sudo chmod 440 "$SUDOERS_FILE"
  echo "Passwordless permission for updates granted to '$USERNAME'."
fi
chmod 755 /home/dac/free-sleep/scripts/update_service.sh

# Keep the update guard outside the downloaded checkout, including across older installers.
MAINTENANCE_DIR="/persistent/free-sleep-maintenance"
mkdir -p "$MAINTENANCE_DIR" /etc/systemd/system/free-sleep-update.service.d
cp "$REPO_DIR/scripts/update_service.sh" "$MAINTENANCE_DIR/update_service.sh"
cp "$REPO_DIR/scripts/sqlite_maintenance.py" "$MAINTENANCE_DIR/sqlite_maintenance.py"
cp "$REPO_DIR/scripts/backup_database.sh" "$REPO_DIR/scripts/backup_database.mjs" "$MAINTENANCE_DIR/"
chown -R root:root "$MAINTENANCE_DIR"
chmod 755 "$MAINTENANCE_DIR" "$MAINTENANCE_DIR/update_service.sh"
chmod 644 "$MAINTENANCE_DIR/sqlite_maintenance.py" "$MAINTENANCE_DIR/backup_database.sh" "$MAINTENANCE_DIR/backup_database.mjs"
cat > /etc/systemd/system/free-sleep-update.service.d/sqlite-maintenance.conf <<EOF
[Service]
ExecStart=
ExecStart=$MAINTENANCE_DIR/update_service.sh
EOF
systemctl daemon-reload


# Biometrics enablement
SUDOERS_BIOMETRICS_RULE="$USERNAME ALL=(ALL) NOPASSWD: /bin/sh /home/dac/free-sleep/scripts/enable_biometrics.sh"
if sudo grep -Fxq "$SUDOERS_BIOMETRICS_RULE" "$SUDOERS_FILE" 2>/dev/null; then
  echo "Rule for '$USERNAME' biometrics permissions already exists."
else
  echo "$SUDOERS_BIOMETRICS_RULE" | sudo tee -a "$SUDOERS_FILE" >> /dev/null
  sudo chmod 440 "$SUDOERS_FILE"
  echo "Passwordless permission for biometrics granted to '$USERNAME'."
fi

echo ""

bash /home/dac/free-sleep/scripts/add_shortcuts.sh

# Give the Pod a name on the home network (http://<hostname>.local:3000), so bookmarks and
# shortcuts survive a change of address. Skipped if it was switched off with "disable".
sh /home/dac/free-sleep/scripts/setup_local_name.sh auto || echo "WARNING: could not set up the .local name"

# If Tailscale was set up on the Pod, keep its root-owned script copies in step with this version
sh /home/dac/free-sleep/scripts/setup_tailscale.sh sync-scripts || echo "WARNING: could not refresh the Tailscale scripts"

# --------------------------------------------------------------------------------
# Finish
echo "This is your dac.sock path (if it doesn't end in dac.sock, open an issue at https://github.com/jalen-cheng/sevensleep/issues):"
cat /persistent/free-sleep-data/dac_sock_path.txt 2>/dev/null || echo "No dac.sock path found."

echo -e "\033[0;32mInstallation complete! The SevenSleep server is running and will start automatically on boot.\033[0m"
echo -e "\033[0;32mSee logs with: journalctl -u free-sleep --no-pager --output=cat\033[0m"

if [ "$migration_failed" = "true" ]; then
  echo -e "\033[33mWARNING: Prisma migrations failed! A backup of your database prior to the migration was saved to /persistent/free-sleep-data/free-sleep-copy.db \033[0m"
fi
