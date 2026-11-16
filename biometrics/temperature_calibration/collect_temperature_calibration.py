"""
Finds out what temperature each Pod level really means, to check (or correct) the curve Free
Sleep uses in server/src/db/temperatureCurve.ts.

The firmware publishes, every few seconds, the water temperature it is aiming for on each side
(`frzTherm.target`, in °C) along with the measured water and bed surface temperatures. So for
each level this script sets both sides, waits for the firmware to report its new target, and
records it. That takes seconds per level.

With --measure it also waits for the water to settle at each level and averages the measured
temperatures, to check that the bed actually reaches what the firmware aims for. That takes
about (settle + sample) minutes per level and needs the bed empty.

Before running:
- Free Sleep must be running. Schedules are not paused: run it when none will fire.
- For --measure: nobody in the bed, covers as you normally sleep.

Usage (on the Pod):
    cd /home/dac/free-sleep/biometrics/temperature_calibration && \
    /home/dac/venv/bin/python collect_temperature_calibration.py

Options:
    --levels=-100,-50,0,50,100   Pod levels to check (default: -100 to 100 in steps of 10)
    --measure                    Also wait for each level to settle and measure it
    --settle-minutes=20          With --measure: time to wait at each level before measuring
    --sample-minutes=3           With --measure: how long to average the sensors for
    --output=PATH                Where to save the results
    --dry-run                    Change nothing; print what the sensors report for 20 seconds
"""
import asyncio
import json
import os
import platform
import sys
import urllib.request
from argparse import ArgumentParser, RawDescriptionHelpFormatter
from datetime import datetime, timezone

sys.path.append(os.getcwd())
DEFAULT_OUTPUT = './temperature_calibration.json'
if platform.system().lower() == 'linux':
    DEFAULT_OUTPUT = '/persistent/free-sleep-data/temperature_calibration.json'
    sys.path.append('/home/dac/free-sleep/biometrics/temperature_calibration/')

from calibration_math import (
    celsius_to_fahrenheit,
    fit_line,
    level_to_assumed_temp_f,
    parse_levels,
    summarize_readings,
)

DEVICE_STATUS_URL = 'http://127.0.0.1:3000/api/deviceStatus'
NATS_URL = 'nats://127.0.0.1:4222'
# Where the firmware publishes live readings. (A Pod 5 was found publishing here and nothing on
# the `raw.` subjects that the sleep analysis reads.)
TARGET_SUBJECT = 'rawmem.frz.therm'
WATER_SUBJECT = 'rawmem.frz.temp'
BED_SUBJECT = 'rawmem.sens.bedtemp'
SIDES = ('left', 'right')
SECONDS_PER_MINUTE = 60
# The firmware reports its target about every 10 seconds; this covers two reports after a change
TARGET_WAIT_SECONDS = 25
DRY_RUN_SECONDS = 20
DEFAULT_LEVELS = ','.join(str(level) for level in range(-100, 101, 10))
# Sensors on each side of the cover, as named in the bedTemp records
BED_SENSOR_KEYS = ('side', 'out', 'cen', 'in')


def get_device_status() -> dict:
    with urllib.request.urlopen(DEVICE_STATUS_URL, timeout=30) as response:
        return json.loads(response.read())


def post_device_status(payload: dict):
    request = urllib.request.Request(
        DEVICE_STATUS_URL,
        data=json.dumps(payload).encode(),
        headers={'Content-Type': 'application/json'},
        method='POST',
    )
    with urllib.request.urlopen(request, timeout=60):
        pass


def set_level(level: int):
    """Turns both sides on at one level. The API takes °F and converts back to a level, and it
    accepts fractions, so sending the assumed °F for the level lands on exactly that level."""
    side_status = {'isOn': True, 'targetTemperatureF': level_to_assumed_temp_f(level)}
    post_device_status({side: side_status for side in SIDES})


def restore_device_status(original_status: dict):
    """Puts each side back to the power state and target it had before calibration."""
    payload = {}
    for side in SIDES:
        payload[side] = {'isOn': original_status[side]['isOn']}
        if original_status[side]['isOn']:
            payload[side]['targetTemperatureF'] = original_status[side]['targetTemperatureF']
    post_device_status(payload)


async def collect_records(connection, seconds: float) -> dict:
    """Listens to the firmware's live readings for a while. Returns the records per subject."""
    import cbor2  # Imported here so --help works without the biometrics dependencies
    records = {TARGET_SUBJECT: [], WATER_SUBJECT: [], BED_SUBJECT: []}

    async def handle_message(message):
        try:
            record = cbor2.loads(message.data)
        except Exception:
            return
        if isinstance(record, dict):
            records[message.subject].append(record)

    subscriptions = [await connection.subscribe(subject, cb=handle_message) for subject in records]
    await asyncio.sleep(seconds)
    for subscription in subscriptions:
        await subscription.unsubscribe()
    return records


def read_firmware_targets(records: dict) -> dict:
    """The water temperature the firmware is aiming for on each side, from its latest report."""
    target_records = records[TARGET_SUBJECT]
    if not target_records:
        return {side: None for side in SIDES}
    latest = target_records[-1]
    targets = {}
    for side in SIDES:
        side_report = latest.get(side, {})
        target_c = side_report.get('target')
        targets[side] = None if target_c is None else {
            'target_c': round(target_c, 2),
            'target_f': round(celsius_to_fahrenheit(target_c), 2),
            'power': side_report.get('power'),
            'enabled': side_report.get('enabled'),
        }
    return targets


def summarize_measurements(records: dict) -> dict:
    """Averages every measured temperature over the window, per side plus the shared ones."""
    water_records = records[WATER_SUBJECT]
    bed_records = records[BED_SUBJECT]
    summary = {
        'ambient_hub': summarize_readings([record['amb'] for record in water_records if 'amb' in record]),
        'heatsink': summarize_readings([record['hs'] for record in water_records if 'hs' in record]),
        'ambient_cover': summarize_readings([record['amb'] for record in bed_records if 'amb' in record]),
    }
    for side in SIDES:
        side_summary = {'water': summarize_readings([record[side] for record in water_records if side in record])}
        for sensor_key in BED_SENSOR_KEYS:
            readings = [record[side][sensor_key] for record in bed_records if sensor_key in record.get(side, {})]
            side_summary[f'bed_{sensor_key}'] = summarize_readings(readings)
        summary[side] = side_summary
    return summary


async def check_level(connection, level: int, arguments) -> dict:
    """Sets one level and records what the firmware aims for. With --measure, also waits for the
    water to settle and records what was actually reached."""
    set_level(level)
    records = await collect_records(connection, TARGET_WAIT_SECONDS)
    point = {
        'level': level,
        'assumed_temp_f': round(level_to_assumed_temp_f(level), 2),
        'firmware_target': read_firmware_targets(records),
    }
    for side in SIDES:
        target = point['firmware_target'][side]
        shown = 'no report' if target is None else f'{target["target_f"]}°F ({target["target_c"]}°C)'
        print(f'Level {level:>4} {side:>5}: firmware aims for {shown}, Free Sleep shows {point["assumed_temp_f"]}°F', flush=True)

    if arguments.measure:
        print(f'  waiting {arguments.settle_minutes:g} min to settle...', flush=True)
        await asyncio.sleep(arguments.settle_minutes * SECONDS_PER_MINUTE)
        measured = await collect_records(connection, arguments.sample_minutes * SECONDS_PER_MINUTE)
        point['measured'] = summarize_measurements(measured)
        for side in SIDES:
            water = point['measured'][side]['water']
            if water:
                print(f'  {side}: water measured {water["mean_f"]}°F (±{water["spread_f"]})', flush=True)
    return point


def fit_results(points: list) -> dict:
    """Fits a line through temperature against level, per side: what the firmware aims for,
    and (with --measure) what the water reached."""
    fits = {}
    for side in SIDES:
        aimed = [(point['level'], point['firmware_target'][side]) for point in points]
        aimed = [(level, target['target_f']) for level, target in aimed if target]
        fits[side] = {'firmware_target': fit_line([level for level, _ in aimed], [temp_f for _, temp_f in aimed])}
        reached = [(point['level'], point.get('measured', {}).get(side, {}).get('water')) for point in points]
        reached = [(level, water['mean_f']) for level, water in reached if water]
        if reached:
            fits[side]['measured_water'] = fit_line([level for level, _ in reached], [temp_f for _, temp_f in reached])
    return fits


async def dry_run(connection):
    """Prints what the sensors report without changing anything."""
    print(f'Listening for {DRY_RUN_SECONDS} seconds, changing nothing...', flush=True)
    records = await collect_records(connection, DRY_RUN_SECONDS)
    for subject, subject_records in records.items():
        print(f'{subject}: {len(subject_records)} records')
        if subject_records:
            print(f'  latest: {subject_records[-1]}')
    print(json.dumps(read_firmware_targets(records), indent=2))


async def run(arguments):
    import nats  # Imported here so --help works without the biometrics dependencies
    connection = await nats.connect(NATS_URL)
    try:
        if arguments.dry_run:
            await dry_run(connection)
            return

        levels = parse_levels(arguments.levels)
        original_status = get_device_status()
        points = []
        try:
            for level in levels:
                points.append(await check_level(connection, level, arguments))
        except (KeyboardInterrupt, asyncio.CancelledError):
            print('Stopped early, keeping the levels checked so far.', flush=True)
        finally:
            print('Restoring the previous power and temperature...', flush=True)
            restore_device_status(original_status)

        results = {
            'created_at': datetime.now(timezone.utc).isoformat(),
            'cover_version': original_status.get('coverVersion'),
            'hub_version': original_status.get('hubVersion'),
            'measured': arguments.measure,
            'points': points,
            'fit': fit_results(points),
        }
        with open(arguments.output, 'w') as output_file:
            json.dump(results, output_file, indent=2)
        print(f'Saved {len(points)} levels to {arguments.output}')
        print(json.dumps(results['fit'], indent=2))
        print('Compare the "firmware aims for" figures above with what Free Sleep shows: they should match.')
    finally:
        await connection.close()


def main():
    parser = ArgumentParser(description=__doc__, formatter_class=RawDescriptionHelpFormatter)
    parser.add_argument('--levels', default=DEFAULT_LEVELS)
    parser.add_argument('--measure', action='store_true')
    parser.add_argument('--settle-minutes', type=float, default=20)
    parser.add_argument('--sample-minutes', type=float, default=3)
    parser.add_argument('--output', default=DEFAULT_OUTPUT)
    parser.add_argument('--dry-run', action='store_true')
    arguments = parser.parse_args()
    try:
        asyncio.run(run(arguments))
    except KeyboardInterrupt:
        pass


if __name__ == '__main__':
    main()
