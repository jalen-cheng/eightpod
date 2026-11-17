"""Exercise the Tailscale relay scripts with temporary paths and fake Pod commands."""

import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest


scripts_path = Path(__file__).resolve().parents[1]

RELAY_MAP = {
    'Regions': {
        '2': {'RegionCode': 'sfo', 'RegionName': 'San Francisco', 'Nodes': [
            {'HostName': 'derp2d.tailscale.com', 'IPv4': '192.73.252.65', 'IPv6': '2607:f740:0:3f::287'},
            {'HostName': 'derp2e.tailscale.com', 'IPv4': '192.73.252.134'},
        ]},
        '10': {'RegionCode': 'sea', 'RegionName': 'Seattle', 'Nodes': [
            {'HostName': 'derp10b.tailscale.com', 'IPv4': '192.73.240.161'},
            # A relay map must never be able to open the home network or a non-address
            {'HostName': 'private.example', 'IPv4': '10.0.0.5'},
            {'HostName': 'no-address.example'},
        ]},
    },
}

FAKE_COMMAND = '''#!/bin/sh
printf '%s %s\\n' "$(basename "$0")" "$*" >> "$FIREWALL_LOG"
cat > /dev/null
'''

# Stands in for curl: prints the relay map file, or fails when the file is missing
FAKE_CURL = '''#!/bin/sh
cat "$RELAY_MAP_FILE" 2>/dev/null || exit 22
'''


class TailscaleScriptTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.folder = Path(self.directory.name)
        self.commands = self.folder / 'commands'
        self.commands.mkdir()
        self.log = self.folder / 'commands.log'
        self.rules_folder = self.folder / 'iptables'
        self.relay_map_file = self.folder / 'relay_map.json'
        self.relay_map_file.write_text(json.dumps(RELAY_MAP))
        self.addresses_file = self.folder / 'free-sleep/tailscale_relay_addresses'
        self.regions_file = self.folder / 'free-sleep/tailscale_relay_regions'
        self.regions_file.parent.mkdir()
        for name in ('iptables', 'ip6tables', 'iptables-restore', 'ip6tables-restore', 'systemctl'):
            self.write_command(name, FAKE_COMMAND)
        self.write_command('curl', FAKE_CURL)
        self.environment = dict(os.environ, PATH=str(self.commands) + ':' + os.environ['PATH'],
                                FIREWALL_LOG=str(self.log), FIREWALL_RULES_DIR=str(self.rules_folder),
                                FIREWALL_CONFIG=str(self.folder / 'free-sleep/firewall.conf'),
                                SYSTEMD_UNIT_DIR=str(self.folder), TIMESYNCD_CONFIG=str(self.folder / 'timesyncd.conf'),
                                TAILSCALE_RELAY_ADDRESSES_FILE=str(self.addresses_file),
                                TAILSCALE_REGIONS_FILE=str(self.regions_file),
                                TAILSCALE_DIR=str(self.folder / 'tailscale'),
                                RELAY_MAP_FILE=str(self.relay_map_file))
        for option in ('ALLOW_SENTRY', 'ALLOW_TAILSCALE', 'SKIP_FIREWALL_RELOAD'):
            self.environment.pop(option, None)

    def write_command(self, name, source):
        command = self.commands / name
        command.write_text(source)
        command.chmod(0o755)

    def run_script(self, name, *arguments, check=True, **extra_environment):
        return subprocess.run(['sh', str(scripts_path / name), *arguments], check=check, text=True,
                              capture_output=True, stdin=subprocess.DEVNULL, env=dict(self.environment, **extra_environment))

    def run_relay_helper(self, *arguments, check=True):
        return subprocess.run([sys.executable, str(scripts_path / 'tailscale_relay_addresses.py'), *arguments],
                              input=json.dumps(RELAY_MAP), check=check, text=True, capture_output=True)

    def test_relay_helper_prints_only_public_addresses_of_the_chosen_regions(self):
        self.assertEqual(self.run_relay_helper('sfo').stdout.split(), ['192.73.252.65', '192.73.252.134'])
        self.assertEqual(self.run_relay_helper('sea').stdout.split(), ['192.73.240.161'])
        self.assertIn('sea\tSeattle', self.run_relay_helper('--list').stdout)
        self.assertNotEqual(self.run_relay_helper('nowhere', check=False).returncode, 0)

    def test_block_opens_sign_in_and_relays_only_when_tailscale_is_on_the_pod(self):
        rules = self.run_script('block_internet_access.sh', '--print-rules', ALLOW_TAILSCALE='true').stdout
        self.assertNotIn('192.200.0.0/24', rules)

        self.addresses_file.write_text('192.73.252.65\n0.0.0.0/0\nnot an address\n')
        rules = self.run_script('block_internet_access.sh', '--print-rules', ALLOW_TAILSCALE='true').stdout.splitlines()
        self.assertIn('-A OUTPUT -p tcp -d 192.200.0.0/24 --dport 443 -j ACCEPT', rules)
        self.assertIn('-A OUTPUT -p tcp -d 192.73.252.65 --dport 443 -j ACCEPT', rules)
        # Replies only: nothing on the internet can open a connection to the Pod
        self.assertIn('-A INPUT -p tcp -s 192.73.252.65 --sport 443 ! --syn -j ACCEPT', rules)
        self.assertFalse([rule for rule in rules if '0.0.0.0/0' in rule or 'not an address' in rule])
        self.assertLess(rules.index('-A OUTPUT -p tcp -d 192.73.252.65 --dport 443 -j ACCEPT'), rules.index('-A OUTPUT -j DROP'))

        # The relay file alone opens nothing
        rules = self.run_script('block_internet_access.sh', '--print-rules').stdout
        self.assertNotIn('192.73.252.65', rules)

    def test_refresh_writes_the_list_and_reapplies_the_block_only_when_it_is_on(self):
        self.regions_file.write_text('sfo sea\n')
        self.run_script('refresh_tailscale_relays.sh', ALLOW_TAILSCALE='true')
        self.assertEqual(self.addresses_file.read_text().split(), ['192.73.240.161', '192.73.252.65', '192.73.252.134'])
        # The block was off, so refreshing must not have switched it on
        self.assertFalse(self.rules_folder.exists())

        self.run_script('block_internet_access.sh', ALLOW_TAILSCALE='true')
        self.regions_file.write_text('sfo\n')
        self.run_script('refresh_tailscale_relays.sh')
        saved_rules = (self.rules_folder / 'iptables.rules').read_text()
        self.assertIn('-d 192.73.252.134 ', saved_rules)
        self.assertNotIn('192.73.240.161', saved_rules)

    def test_refresh_keeps_the_last_good_list_when_the_download_fails(self):
        self.regions_file.write_text('sfo\n')
        self.addresses_file.write_text('192.73.252.65\n')
        self.relay_map_file.unlink()
        result = self.run_script('refresh_tailscale_relays.sh', check=False)
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(self.addresses_file.read_text(), '192.73.252.65\n')

        # A map without the chosen region is treated the same way
        self.relay_map_file.write_text(json.dumps({'Regions': {}}))
        self.assertNotEqual(self.run_script('refresh_tailscale_relays.sh', check=False).returncode, 0)
        self.assertEqual(self.addresses_file.read_text(), '192.73.252.65\n')


if __name__ == '__main__':
    unittest.main()
