#!/bin/bash
#
# The hub has two copies of its system, slot a and slot b, and its boot loader keeps a note of
# whether each has been confirmed as good. A slot that is not confirmed gets a limited number
# of boots (the retry count goes down by one each time); when they run out the boot loader
# starts the other slot. SevenSleep is installed in one slot only. The other still holds Eight
# Sleep's system, with its updates on and no internet block, so a Pod that falls back to it is
# back on stock firmware and online.
#
# Eight Sleep's own service that confirms a slot (defibrillator) is one of those the install
# switches off. So if the slot was not yet confirmed when SevenSleep was installed, for example
# straight after a firmware update, nothing would ever confirm it.
#
#   sh boot_slot.sh status    Say which slot is running and whether it is confirmed
#   sh boot_slot.sh confirm   Confirm the running slot, if it is not already
#
# "confirm" only ever marks the slot the Pod is running from, which has shown it boots by
# booting. It changes nothing when that slot is already confirmed.

set -u

# The slot the system was started from, as the kernel was told it: a or b, or nothing if unknown
find_running_slot() {
  sed -n 's/.*root=PARTLABEL=rootfs_\([ab]\).*/\1/p' /proc/cmdline
}

# Prints one of the boot loader's settings, or nothing when it is missing or cannot be read
read_setting() {
  fw_printenv -n "$1" 2>/dev/null || true
}

show_status() {
  if ! command -v fw_printenv >/dev/null 2>&1; then
    echo "Boot slot: this Pod has no fw_printenv, so its boot slots cannot be read."
    return 2
  fi
  slot="$(find_running_slot)"
  if [ -z "$slot" ]; then
    echo "Boot slot: could not tell which slot is running."
    return 2
  fi
  confirmed="$(read_setting "boot_${slot}_success")"
  retries="$(read_setting "retry_boot_${slot}")"
  if [ "$confirmed" = "1" ]; then
    echo "Boot slot: running slot $slot, confirmed. It will keep booting from here."
    return 0
  fi
  # Only a plain 0 means "not confirmed". Anything else (the setting missing, or the boot loader's
  # settings unreadable) is not understood, and nothing is written on the strength of it.
  if [ "$confirmed" != "0" ]; then
    echo "Boot slot: running slot $slot, but boot_${slot}_success reads '${confirmed:-nothing}'. Not understood, so left alone."
    return 2
  fi
  echo "Boot slot: running slot $slot, NOT confirmed (${retries:-?} boots left)."
  echo "When the boots run out the Pod starts its other slot, which is Eight Sleep's own system."
  return 1
}

confirm_slot() {
  show_status
  result=$?
  [ "$result" = "1" ] || return "$result"
  [ "$(id -u)" = "0" ] || { echo "Run this as root to confirm the slot."; return 1; }
  slot="$(find_running_slot)"
  if fw_setenv "boot_${slot}_success" 1 && [ "$(read_setting "boot_${slot}_success")" = "1" ]; then
    echo "Boot slot: slot $slot is now confirmed."
    return 0
  fi
  echo "Boot slot: could not confirm slot $slot. Do not reboot more than you must, and open an issue."
  return 1
}

case "${1:-}" in
  status) show_status ;;
  confirm) confirm_slot ;;
  *) echo "Usage: sh boot_slot.sh status | confirm"; exit 2 ;;
esac
