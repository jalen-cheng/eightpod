"""Tests for build_shortcuts.py; run with python3 -m unittest discover -s scripts/tests."""

import importlib.util
from pathlib import Path
import plistlib
import unittest


script_path = Path(__file__).resolve().parents[1] / 'build_shortcuts.py'
spec = importlib.util.spec_from_file_location('build_shortcuts', script_path)
builder = importlib.util.module_from_spec(spec)
spec.loader.exec_module(builder)


def find_references(value):
    """Every reference to another action's output found anywhere inside a setting."""
    if isinstance(value, dict):
        if value.get('Type') == 'ActionOutput':
            yield value['OutputUUID']
        for child in value.values():
            yield from find_references(child)
    elif isinstance(value, list):
        for child in value:
            yield from find_references(child)


def identifiers(actions):
    return [action['WFWorkflowActionIdentifier'].removeprefix('is.workflow.actions.') for action in actions]


def json_fields(request):
    return request['WFWorkflowActionParameters']['WFJSONValues']['Value']['WFDictionaryFieldValueItems']


class EveryShortcutTests(unittest.TestCase):
    def test_every_variable_points_at_an_earlier_action(self):
        for name in builder.SHORTCUTS:
            produced = set()
            for action in builder.build_shortcut(name)['WFWorkflowActions']:
                parameters = action['WFWorkflowActionParameters']
                for reference in find_references(parameters):
                    self.assertIn(reference, produced, f"{name}: {action['WFWorkflowActionIdentifier']} uses an output not made yet")
                if 'UUID' in parameters:
                    produced.add(parameters['UUID'])

    def test_the_address_question_points_at_the_address(self):
        for name in builder.SHORTCUTS:
            shortcut = builder.build_shortcut(name)
            question, = shortcut['WFWorkflowImportQuestions']
            asked = shortcut['WFWorkflowActions'][question['ActionIndex']]
            self.assertEqual(asked['WFWorkflowActionIdentifier'], 'is.workflow.actions.gettext', name)
            self.assertEqual(asked['WFWorkflowActionParameters'][question['ParameterKey']], question['DefaultValue'], name)

    def test_every_request_goes_to_the_address_asked_for(self):
        for name in builder.SHORTCUTS:
            requests = [action for action in builder.build_shortcut(name)['WFWorkflowActions']
                        if action['WFWorkflowActionIdentifier'].endswith('downloadurl')]
            self.assertEqual(len(requests), 1, name)
            url = requests[0]['WFWorkflowActionParameters']['WFURL']['Value']
            self.assertTrue(url['string'].startswith(f'{builder.VARIABLE_MARK}/api/'), name)
            self.assertEqual(url['attachmentsByRange']['{0, 1}']['OutputName'], builder.ADDRESS_OUTPUT_NAME, name)

    def test_each_can_be_written_as_a_property_list(self):
        for name in builder.SHORTCUTS:
            shortcut = builder.build_shortcut(name)
            self.assertEqual(plistlib.loads(plistlib.dumps(shortcut, fmt=plistlib.FMT_BINARY)), shortcut, name)


class SendSleepTests(unittest.TestCase):
    def setUp(self):
        self.actions = builder.build_shortcut('Send sleep to SevenSleep')['WFWorkflowActions']

    def test_actions_run_in_the_order_the_shortcut_needs(self):
        self.assertEqual(identifiers(self.actions), [
            'gettext', 'filter.health.quantity', 'repeat.each',
            'properties.health.quantity', 'format.date', 'properties.health.quantity', 'format.date',
            'properties.health.quantity', 'gettext', 'repeat.each',
            'downloadurl', 'getvalueforkey', 'notification',
        ])

    def test_the_repeat_opens_and_closes_as_one_group(self):
        opening, closing = [action['WFWorkflowActionParameters'] for action in self.actions
                            if action['WFWorkflowActionIdentifier'].endswith('repeat.each')]
        self.assertEqual(opening['GroupingIdentifier'], closing['GroupingIdentifier'])
        self.assertEqual((opening['WFControlFlowMode'], closing['WFControlFlowMode']), (0, 2))
        # Only the closing action has an output: the lines the repeat made
        self.assertNotIn('UUID', opening)
        self.assertIn('UUID', closing)

    def test_each_line_is_start_end_value(self):
        line = self.actions[8]['WFWorkflowActionParameters']['WFTextActionText']['Value']
        mark = builder.VARIABLE_MARK
        self.assertEqual(line['string'], f'{mark}|{mark}|{mark}')
        names = [line['attachmentsByRange'][position]['OutputName'] for position in ('{0, 1}', '{2, 1}', '{4, 1}')]
        self.assertEqual(names, ['Formatted Date', 'Formatted Date', 'Value'])

    def test_the_request_posts_source_and_samples_as_json(self):
        request = self.actions[10]
        parameters = request['WFWorkflowActionParameters']
        self.assertEqual(parameters['WFURL']['Value']['string'], f'{builder.VARIABLE_MARK}/api/autopilot/sleepTimes')
        self.assertEqual((parameters['WFHTTPMethod'], parameters['WFHTTPBodyType']), ('POST', 'JSON'))
        self.assertEqual([item['WFKey']['Value']['string'] for item in json_fields(request)], ['source', 'samples'])


class BedShortcutTests(unittest.TestCase):
    def test_bed_temperature_asks_for_a_number_and_posts_it_as_one(self):
        address, ask, request = builder.build_shortcut('Bed temperature')['WFWorkflowActions']
        self.assertEqual(ask['WFWorkflowActionParameters']['WFInputType'], 'Number')
        self.assertTrue(ask['WFWorkflowActionParameters']['WFAskActionAllowsNegativeNumbers'])
        dial, = json_fields(request)
        self.assertEqual((dial['WFKey']['Value']['string'], dial['WFItemType']), ('dial', builder.ITEM_TYPE_NUMBER))

    def test_bed_alarm_asks_for_a_time_and_posts_it_as_text(self):
        address, ask, request = builder.build_shortcut('Bed alarm')['WFWorkflowActions']
        self.assertEqual(ask['WFWorkflowActionParameters']['WFInputType'], 'Time')
        time, = json_fields(request)
        self.assertEqual((time['WFKey']['Value']['string'], time['WFItemType']), ('time', builder.ITEM_TYPE_TEXT))
        self.assertTrue(request['WFWorkflowActionParameters']['WFURL']['Value']['string'].endswith('/api/alarm/time'))

    def test_bed_status_reads_without_changing_anything(self):
        actions = builder.build_shortcut('Bed status')['WFWorkflowActions']
        self.assertEqual(identifiers(actions), ['gettext', 'downloadurl', 'getvalueforkey', 'showresult'])
        self.assertNotIn('WFHTTPMethod', actions[1]['WFWorkflowActionParameters'])
        self.assertEqual(actions[2]['WFWorkflowActionParameters']['WFDictionaryKey'], 'summary')

    def test_bed_off_turns_both_sides_off(self):
        address, request = builder.build_shortcut('Bed off')['WFWorkflowActions']
        for side in json_fields(request):
            self.assertEqual(side['WFItemType'], builder.ITEM_TYPE_DICTIONARY)
            is_on, = side['WFValue']['Value']['WFDictionaryFieldValueItems']
            self.assertEqual((is_on['WFKey']['Value']['string'], is_on['WFValue']['Value']), ('isOn', False))
        self.assertEqual([side['WFKey']['Value']['string'] for side in json_fields(request)], ['left', 'right'])


if __name__ == '__main__':
    unittest.main()
