#!/bin/sh
# Backs up the SQLite database before an install or update touches it.
#
# Usage: sh backup_database.sh SOURCE_DB DESTINATION_DB
#
# The Pod's system Python does not always have what sqlite_maintenance.py needs (a Pod 5 was
# found with no `_sqlite3` module at all), which used to stop every update at this step.
# So this tries, in order:
#   1. sqlite_maintenance.py, when Python can import its modules
#   2. Node's built-in SQLite, which the server's own Node provides
#   3. a plain file copy, which is safe here because the services are stopped first
set -eu

SOURCE_DB="$1"
DESTINATION_DB="$2"
SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
PYTHON_BIN="${FREE_SLEEP_PYTHON:-python3}"
NODE_BIN="${FREE_SLEEP_NODE:-/home/dac/.volta/bin/node}"
NODE_USER="${FREE_SLEEP_NODE_USER:-dac}"

# Node is installed for the dac user through Volta, so root has to run it as that user
run_node() {
  if [ "$(id -u)" = "0" ] && id "$NODE_USER" > /dev/null 2>&1; then
    sudo -u "$NODE_USER" "$NODE_BIN" "$@"
  else
    "$NODE_BIN" "$@"
  fi
}

if "$PYTHON_BIN" -c "import json, sqlite3" > /dev/null 2>&1; then
  exec "$PYTHON_BIN" "$SCRIPT_DIR/sqlite_maintenance.py" backup "$SOURCE_DB" "$DESTINATION_DB" --checkpoint
fi

echo "Python cannot open SQLite databases here, backing up with Node instead..."
if command -v "$NODE_BIN" > /dev/null 2>&1 && run_node -e "require('node:sqlite')" > /dev/null 2>&1; then
  run_node "$SCRIPT_DIR/backup_database.mjs" "$SOURCE_DB" "$DESTINATION_DB"
  exit 0
fi

echo "WARNING: no SQLite support found in Python or Node, copying the database files as they are." >&2
cp -p "$SOURCE_DB" "$DESTINATION_DB"
for suffix in -wal -shm; do
  if [ -f "$SOURCE_DB$suffix" ]; then
    cp -p "$SOURCE_DB$suffix" "$DESTINATION_DB$suffix"
  else
    rm -f "$DESTINATION_DB$suffix"
  fi
done
