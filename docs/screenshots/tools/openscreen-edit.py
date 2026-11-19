"""Turns a plain take into a finished demo with OpenScreen: pointer, gentle zooms, callouts, export.

Usage: python3 openscreen-edit.py <take folder> <absolute output.mp4>
Needs the OpenScreen app in /Applications. Record the take first with record-take.mjs.
"""
import json
import os
import re
import subprocess
import sys

# Run from the folder that holds the take folder; working files are written there too
SCRATCH = os.getcwd() + '/'
TOOLS = os.path.dirname(os.path.abspath(__file__)) + '/'
take_folder, output_path = sys.argv[1], sys.argv[2]
take = json.load(open(f'{SCRATCH}{take_folder}/take.json'))


def call(calls, name):
    """Runs a list of tool calls through the MCP client and returns its printed output."""
    path = f'{SCRATCH}{name}.json'
    json.dump(calls, open(path, 'w'))
    return subprocess.run(['node', TOOLS + 'openscreen-mcp.mjs', 'call', path], capture_output=True, text=True, cwd=SCRATCH).stdout


events = [{key: (round(value, 4) if isinstance(value, float) else value) for key, value in event.items()} for event in take['pointerEvents']]
log = call([
    {'tool': 'createProject', 'args': {'title': 'SevenSleep demo', 'videoPath': f'{SCRATCH}{take_folder}/take.mp4'}, 'save': {'projectId': 'projectId'}},
    {'tool': 'setPointerTrack', 'args': {'projectId': '$projectId', 'events': events, 'recordingStartedAt': 0}},
    {'tool': 'setAspectRatio', 'args': {'projectId': '$projectId', 'aspectRatio': '16:9'}},
    {'tool': 'getCurrentDocument', 'args': {'projectId': '$projectId'}, 'show': 100000},
], 'os_phase1')
project_id = re.search(r'"projectId":"(proj_[^"]+)"', log).group(1)
document = json.loads(log[log.index('--- getCurrentDocument') + len('--- getCurrentDocument\n'):].strip().split('\n')[0])
duration = document['assets'][0]['durationSec']
print('project', project_id, 'duration', duration)

beats = [(beat['atSec'], beat['callout']) for beat in take['beats']]
clicks = [event for event in take['pointerEvents'] if event.get('click')]
start_of = {callout: at for at, callout in beats}
# Three gentle zooms (1.25x), each held on the part of the window its beat is about
zooms = [
    {'startSec': start_of['One tap turns the bed on'] + 1.1, 'endSec': start_of['A schedule for every night'] - 0.5, 'focus': {'cx': 0.6, 'cy': 0.45}},
    {'startSec': start_of['Wake up warm'] + 1.1, 'endSec': start_of["Knows when you're in bed"] - 0.5, 'focus': {'cx': 0.6, 'cy': 0.6}},
    {'startSec': start_of["Knows when you're in bed"] + 1.9, 'endSec': start_of['A local API for anything'] - 0.4, 'focus': {'cx': 0.6, 'cy': 0.5}},
]
end_title_at = duration - 1.7
edits = [{'tool': 'createCheckpoint', 'args': {'projectId': project_id}}]
edits += [{'tool': 'removeModifier', 'args': {'projectId': project_id, 'id': zoom['id']}} for zoom in document['zoomRanges']]
edits.append({'tool': 'addZooms', 'args': {'projectId': project_id, 'regions': [
    {**zoom, 'startSec': round(zoom['startSec'], 2), 'endSec': round(zoom['endSec'], 2), 'depth': 1, 'focusMode': 'manual'} for zoom in zooms]}, 'show': 200})
# A smaller pointer than the default, which is sized for a full desktop
edits.append({'tool': 'setEditorSettings', 'args': {'projectId': project_id, 'cursor': {'size': 2.2, 'smoothing': 0.6}}, 'show': 300})
# One callout per beat at the bottom. Each starts as the last ends, with no entrance, so the line
# reads as one caption whose words change.
captions = [(0.0, 'Your Eight Sleep Pod, without the cloud')] + beats
for index, (start, text) in enumerate(captions):
    stop = captions[index + 1][0] if index + 1 < len(captions) else end_title_at
    edits.append({'tool': 'addAnnotation', 'show': 120, 'args': {
        'projectId': project_id, 'startSec': round(start, 2), 'endSec': round(stop, 2), 'text': text, 'x': 50, 'y': 94,
        'fontSize': 34, 'animation': 'fade' if index == 0 else 'none'}})
edits.append({'tool': 'addAnnotation', 'show': 120, 'args': {
    'projectId': project_id, 'startSec': round(end_title_at, 2), 'endSec': duration, 'text': 'SevenSleep: local control for Eight Sleep Pods',
    'x': 50, 'y': 94, 'fontSize': 34, 'animation': 'none'}})
edits.append({'tool': 'exportVideo', 'args': {'projectId': project_id, 'path': output_path, 'quality': 'good', 'fps': 60}, 'show': 400})
print(call(edits, 'os_phase2'))
