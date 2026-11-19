"""Tests for build_apple_health_shortcut.py; run with python3 -m unittest discover -s scripts/tests."""

import importlib.util
from pathlib import Path
import plistlib
import unittest


script_path = Path(__file__).resolve().parents[1] / 'build_apple_health_shortcut.py'
spec = importlib.util.spec_from_file_location('build_apple_health_shortcut', script_path)
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


class AppleHealthShortcutTests(unittest.TestCase):
    def setUp(self):
        self.shortcut = builder.build_shortcut()
        self.actions = self.shortcut['WFWorkflowActions']

    def identifiers(self):
        return [action['WFWorkflowActionIdentifier'].removeprefix('is.workflow.actions.') for action in self.actions]

    def test_actions_run_in_the_order_the_shortcut_needs(self):
        self.assertEqual(self.identifiers(), [
            'gettext', 'filter.health.quantity', 'repeat.each',
            'properties.health.quantity', 'format.date', 'properties.health.quantity', 'format.date',
            'properties.health.quantity', 'gettext', 'repeat.each',
            'downloadurl', 'getvalueforkey', 'notification',
        ])

    def test_every_variable_points_at_an_earlier_action(self):
        produced = set()
        for action in self.actions:
            parameters = action['WFWorkflowActionParameters']
            for reference in find_references(parameters):
                self.assertIn(reference, produced, f"{action['WFWorkflowActionIdentifier']} uses an output not made yet")
            if 'UUID' in parameters:
                produced.add(parameters['UUID'])

    def test_the_repeat_opens_and_closes_as_one_group(self):
        opening, closing = [action['WFWorkflowActionParameters'] for action in self.actions
                            if action['WFWorkflowActionIdentifier'].endswith('repeat.each')]
        self.assertEqual(opening['GroupingIdentifier'], closing['GroupingIdentifier'])
        self.assertEqual((opening['WFControlFlowMode'], closing['WFControlFlowMode']), (0, 2))
        # Only the closing action has an output: the lines the repeat made
        self.assertNotIn('UUID', opening)
        self.assertIn('UUID', closing)

    def test_the_address_question_points_at_the_address(self):
        question, = self.shortcut['WFWorkflowImportQuestions']
        asked = self.actions[question['ActionIndex']]
        self.assertEqual(asked['WFWorkflowActionIdentifier'], 'is.workflow.actions.gettext')
        self.assertEqual(asked['WFWorkflowActionParameters'][question['ParameterKey']], question['DefaultValue'])

    def test_each_line_is_start_end_value(self):
        line = self.actions[8]['WFWorkflowActionParameters']['WFTextActionText']['Value']
        mark = builder.VARIABLE_MARK
        self.assertEqual(line['string'], f'{mark}|{mark}|{mark}')
        self.assertEqual(sorted(line['attachmentsByRange']), ['{0, 1}', '{2, 1}', '{4, 1}'])
        names = [line['attachmentsByRange'][position]['OutputName'] for position in ('{0, 1}', '{2, 1}', '{4, 1}')]
        self.assertEqual(names, ['Formatted Date', 'Formatted Date', 'Value'])

    def test_the_request_goes_to_the_sleep_times_address_as_json(self):
        request = self.actions[10]['WFWorkflowActionParameters']
        self.assertEqual(request['WFURL']['Value']['string'], f'{builder.VARIABLE_MARK}/api/autopilot/sleepTimes')
        self.assertEqual((request['WFHTTPMethod'], request['WFHTTPBodyType']), ('POST', 'JSON'))
        keys = [item['WFKey']['Value']['string'] for item in request['WFJSONValues']['Value']['WFDictionaryFieldValueItems']]
        self.assertEqual(keys, ['source', 'samples'])

    def test_it_can_be_written_as_a_property_list(self):
        self.assertEqual(plistlib.loads(plistlib.dumps(self.shortcut, fmt=plistlib.FMT_BINARY)), self.shortcut)


if __name__ == '__main__':
    unittest.main()
