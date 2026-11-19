#!/bin/bash
#
# Two watchdogs for the Pod, both off until asked for:
#
#   sh setup_watchdog.sh wifi       Reconnect Wi-Fi when the Pod has been off it for 3 minutes
#   sh setup_watchdog.sh hardware   Reset the Pod if its kernel or systemd freezes
#   sh setup_watchdog.sh status     Say what is on
#   sh setup_watchdog.sh remove     Take both out again
#
# Wi-Fi: a timer runs wifi_watchdog.sh once a minute. It only acts when NetworkManager itself
# says wlan0 is not connected, three checks in a row, and then asks it to connect once.
#
# Hardware: systemd is told to feed the board's watchdog (RuntimeWatchdogSec). If systemd or
# the kernel stops, the board resets itself instead of sitting frozen with the bed as it was.
# Arming it can reset the Pod if the board's watchdog does not take the setting, so:
#   - the setting goes in /run first, which a reset clears, and is copied to /etc only after
#     the Pod has run with it for over two timeouts;
#   - a note is left in the data folder for the length of the trial. If it is still there at
#     the next try, the Pod reset during the trial and this refuses to try again.
# 30 seconds is used because the Pod 5's watchdog cannot count further than 31.

set -u

RUNTIME_SECONDS=30
TRIAL_SECONDS=75
DROP_IN_NAME="free-sleep-watchdog.conf"
TRIAL_DIR="/run/systemd/system.conf.d"
KEPT_DIR="/etc/systemd/system.conf.d"
TRIAL_NOTE="/persistent/free-sleep-data/watchdog-trial"
SCRIPTS_DIR="/home/dac/free-sleep/scripts"
WIFI_UNIT="free-sleep-wifi-watchdog"

runtime_setting() {
  systemctl show -p RuntimeWatchdogUSec 2>/dev/null | sed -n 's/^RuntimeWatchdogUSec=//p'
}

# Prints the name of any program other than systemd that has the watchdog device open
find_other_holder() {
  for process in /proc/[0-9]*; do
    [ "$process" = "/proc/1" ] && continue
    if ls -l "$process/fd" 2>/dev/null | grep -q '/dev/watchdog'; then
      cat "$process/comm" 2>/dev/null
      return
    fi
  done
}

turn_on_hardware() {
  [ -c /dev/watchdog ] || { echo "Hardware watchdog: this Pod has no watchdog device. Left off."; return 0; }
  current="$(runtime_setting)"
  case "$current" in
    0|infinity|"") ;;
    *) echo "Hardware watchdog: already on ($current)."; return 0 ;;
  esac
  holder="$(find_other_holder)"
  [ -z "$holder" ] || { echo "Hardware watchdog: $holder is using the device. Left off."; return 0; }
  if [ -f "$TRIAL_NOTE" ]; then
    echo "Hardware watchdog: an earlier trial did not finish, so the Pod may have reset during it."
    echo "Left off. Delete $TRIAL_NOTE to try again."
    return 1
  fi

  echo "started $(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$TRIAL_NOTE"
  mkdir -p "$TRIAL_DIR"
  printf '[Manager]\nRuntimeWatchdogSec=%ss\n' "$RUNTIME_SECONDS" > "$TRIAL_DIR/$DROP_IN_NAME"
  if ! systemctl daemon-reexec; then
    rm -f "$TRIAL_DIR/$DROP_IN_NAME" "$TRIAL_NOTE"
    echo "Hardware watchdog: systemd would not reload. Left off."
    return 1
  fi
  echo "Hardware watchdog: on trial for $TRIAL_SECONDS seconds. If the Pod resets now, it comes back with it off."
  sleep "$TRIAL_SECONDS"
  case "$(runtime_setting)" in
    0|infinity|"")
      rm -f "$TRIAL_DIR/$DROP_IN_NAME" "$TRIAL_NOTE"
      systemctl daemon-reexec || true
      echo "Hardware watchdog: systemd did not take the setting. Left off."
      return 1
      ;;
  esac
  mkdir -p "$KEPT_DIR"
  cp "$TRIAL_DIR/$DROP_IN_NAME" "$KEPT_DIR/$DROP_IN_NAME"
  rm -f "$TRIAL_NOTE"
  echo "Hardware watchdog: on, and kept across restarts ($(runtime_setting))."
}

turn_on_wifi() {
  command -v nmcli >/dev/null 2>&1 || { echo "Wi-Fi watchdog: this Pod has no nmcli. Left off."; return 0; }
  cat > "/etc/systemd/system/$WIFI_UNIT.service" <<EOF
[Unit]
Description=SevenSleep Wi-Fi watchdog

[Service]
Type=oneshot
ExecStart=/bin/bash $SCRIPTS_DIR/wifi_watchdog.sh
EOF
  cat > "/etc/systemd/system/$WIFI_UNIT.timer" <<EOF
[Unit]
Description=SevenSleep Wi-Fi watchdog, once a minute

[Timer]
OnBootSec=3min
OnUnitActiveSec=1min

[Install]
WantedBy=timers.target
EOF
  systemctl daemon-reload
  systemctl enable --now "$WIFI_UNIT.timer"
  echo "Wi-Fi watchdog: on."
}

remove_all() {
  systemctl disable --now "$WIFI_UNIT.timer" 2>/dev/null
  rm -f "/etc/systemd/system/$WIFI_UNIT.service" "/etc/systemd/system/$WIFI_UNIT.timer"
  systemctl daemon-reload
  if [ -f "$KEPT_DIR/$DROP_IN_NAME" ] || [ -f "$TRIAL_DIR/$DROP_IN_NAME" ]; then
    rm -f "$KEPT_DIR/$DROP_IN_NAME" "$TRIAL_DIR/$DROP_IN_NAME"
    systemctl daemon-reexec
  fi
  rm -f "$TRIAL_NOTE"
  echo "Both watchdogs are off."
}

show_status() {
  echo "Hardware watchdog: RuntimeWatchdogUSec=$(runtime_setting)"
  [ -f "$TRIAL_NOTE" ] && echo "Hardware watchdog: an unfinished trial is noted in $TRIAL_NOTE"
  echo "Wi-Fi watchdog: $(systemctl is-active "$WIFI_UNIT.timer" 2>/dev/null)"
}

case "${1:-}" in
  wifi) turn_on_wifi ;;
  hardware) turn_on_hardware ;;
  status) show_status ;;
  remove) remove_all ;;
  *) echo "Usage: sh setup_watchdog.sh wifi | hardware | status | remove"; exit 2 ;;
esac
