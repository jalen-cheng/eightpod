"""Read Tailscale's relay map (JSON on stdin) and print what the firewall scripts need.

Usage:
  tailscale_relay_addresses.py sfo sea     Print the IPv4 address of every relay in those regions
  tailscale_relay_addresses.py --list      Print every region code and name
  tailscale_relay_addresses.py --nearest 2 Print the codes of the regions that answer fastest
  tailscale_relay_addresses.py --policy sfo sea
                                           Print the tailnet policy entry that switches off every other region
"""

from concurrent.futures import ThreadPoolExecutor
import ipaddress
import json
import socket
import sys
import time

RELAY_PORT = 443
CONNECT_TIMEOUT_SECONDS = 3


def load_regions(relay_map_text):
    """Return the regions of a relay map, keyed by lower-case region code."""
    relay_map = json.loads(relay_map_text)
    return {region['RegionCode'].lower(): region for region in relay_map['Regions'].values()}


def relay_addresses(regions, region_codes):
    """Return the sorted public IPv4 addresses of every relay in the chosen regions."""
    addresses = set()
    for region_code in region_codes:
        region = regions.get(region_code.lower())
        if region is None:
            raise ValueError(f'Unknown relay region: {region_code}')
        for node in region.get('Nodes', []):
            address = ipaddress.ip_address(node['IPv4']) if node.get('IPv4') else None
            # Anything that is not a public IPv4 address must never reach the firewall rules
            if address is not None and address.version == 4 and address.is_global:
                addresses.add(address)
    return [str(address) for address in sorted(addresses)]


def connect_seconds(region):
    """Time one connection to a region's first relay; None when it cannot be reached."""
    nodes = [node for node in region.get('Nodes', []) if node.get('IPv4')]
    if not nodes:
        return None
    started_at = time.monotonic()
    try:
        with socket.create_connection((nodes[0]['IPv4'], RELAY_PORT), timeout=CONNECT_TIMEOUT_SECONDS):
            return time.monotonic() - started_at
    except OSError:
        return None


def nearest_regions(regions, region_count):
    """Return the codes of the regions with the quickest connections, fastest first."""
    region_codes = sorted(regions)
    with ThreadPoolExecutor(max_workers=len(region_codes)) as executor:
        timings = list(executor.map(lambda region_code: connect_seconds(regions[region_code]), region_codes))
    reachable = [(seconds, region_code) for seconds, region_code in zip(timings, region_codes) if seconds is not None]
    return [region_code for _seconds, region_code in sorted(reachable)[:region_count]]


def region_policy(regions, region_codes):
    """Return the "derpMap" policy entry that leaves only the chosen regions switched on."""
    kept_codes = {region_code.lower() for region_code in region_codes}
    unknown_codes = kept_codes - set(regions)
    if unknown_codes:
        raise ValueError(f"Unknown relay region: {', '.join(sorted(unknown_codes))}")
    switched_off = sorted(region['RegionID'] for region_code, region in regions.items() if region_code not in kept_codes)
    return json.dumps({'derpMap': {'Regions': {str(region_id): None for region_id in switched_off}}})


def main(arguments):
    regions = load_regions(sys.stdin.read())
    if arguments[:1] == ['--list']:
        for region_code in sorted(regions):
            print(f"{region_code}\t{regions[region_code].get('RegionName', '')}")
    elif arguments[:1] == ['--nearest']:
        print(' '.join(nearest_regions(regions, int(arguments[1]))))
    elif arguments[:1] == ['--policy']:
        print(region_policy(regions, arguments[1:]))
    elif arguments:
        print('\n'.join(relay_addresses(regions, arguments)))
    else:
        raise ValueError('Give region codes, --list or --nearest <count>')


if __name__ == '__main__':
    try:
        main(sys.argv[1:])
    except (ValueError, KeyError, json.JSONDecodeError) as error:
        print(f'tailscale_relay_addresses: {error}', file=sys.stderr)
        sys.exit(1)
