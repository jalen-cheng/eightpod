#!/usr/bin/env python3
"""Builds the iPhone Shortcut that sends last night's sleep from Apple Health to the Pod.

Writes an unsigned shortcut file. An iPhone only imports signed ones, so sign it on a Mac:

    python3 scripts/build_apple_health_shortcut.py unsigned.shortcut
    shortcuts sign --mode anyone --input unsigned.shortcut --output "Send sleep to SevenSleep.shortcut"

What the Shortcut does, in order:
  1. holds the Pod's address (asked for when the Shortcut is added, so nobody has to edit it)
  2. finds the Sleep samples in Apple Health that began in the last two days
  3. for each one, writes a line "start|end|value" with the times in ISO 8601
  4. posts those lines to /api/autopilot/sleepTimes
  5. shows the Pod's answer as a notification

Every action is written the way the Shortcuts editor writes it, taken from exported shortcuts:
a wrong key or label makes an action import with an empty setting.
"""

import plistlib
import sys
import uuid

DEFAULT_POD_ADDRESS = 'http://sevensleep.local'
SLEEP_TIMES_PATH = '/api/autopilot/sleepTimes'
SOURCE_NAME = 'Apple Health'
# Two days, so a run late in the day still reaches back over last night. Sending a night twice
# changes nothing on the Pod.
DAYS_LOOKED_BACK = 2
ADDRESS_QUESTION = "Your Pod's address, as you open the app (keep the http://)"

# The marker the editor puts in a text where a variable goes
VARIABLE_MARK = '￼'
# The editor's codes: "is", "is in the last", days, and text as a dictionary value
OPERATOR_IS = 4
OPERATOR_IN_THE_LAST = 1001
UNIT_DAYS = 16
ITEM_TYPE_TEXT = 0
CONTROL_FLOW_START = 0
CONTROL_FLOW_END = 2


def new_uuid():
    return str(uuid.uuid4()).upper()


def action(name, parameters):
    return {'WFWorkflowActionIdentifier': f'is.workflow.actions.{name}', 'WFWorkflowActionParameters': parameters}


def output_of(output_uuid, output_name):
    """A reference to what an earlier action produced."""
    return {'OutputUUID': output_uuid, 'Type': 'ActionOutput', 'OutputName': output_name}


def variable_input(variable):
    """A whole setting filled by one variable."""
    return {'Value': variable, 'WFSerializationType': 'WFTextTokenAttachment'}


def text_with(parts):
    """A text setting made of plain strings and variables (dicts), in order."""
    string = ''
    attachments = {}
    for part in parts:
        if isinstance(part, str):
            string += part
        else:
            attachments[f'{{{len(string)}, 1}}'] = part
            string += VARIABLE_MARK
    value = {'string': string}
    if attachments:
        value['attachmentsByRange'] = attachments
    return {'Value': value, 'WFSerializationType': 'WFTextTokenString'}


def json_field(key, value_parts):
    return {'WFKey': text_with([key]), 'WFItemType': ITEM_TYPE_TEXT, 'WFValue': text_with(value_parts)}


def sample_detail(property_name, detail_uuid):
    """Get Details of Health Sample: one property of the sample the repeat is on."""
    return action('properties.health.quantity', {
        'WFInput': variable_input({'VariableName': 'Repeat Item', 'Type': 'Variable'}),
        'UUID': detail_uuid,
        'WFContentItemPropertyName': property_name,
    })


def iso_date(detail_uuid, property_name, formatted_uuid):
    """Format Date: a sample's date as ISO 8601 with its time and zone."""
    return action('format.date', {
        'WFDateFormatStyle': 'ISO 8601',
        'WFISO8601IncludeTime': True,
        'UUID': formatted_uuid,
        'WFDate': text_with([output_of(detail_uuid, property_name)]),
    })


def build_actions():
    address, samples, repeat_group, repeat_results = new_uuid(), new_uuid(), new_uuid(), new_uuid()
    start, start_iso, end, end_iso, value, line = (new_uuid() for _ in range(6))
    response, message = new_uuid(), new_uuid()
    return [
        action('gettext', {'WFTextActionText': DEFAULT_POD_ADDRESS, 'UUID': address, 'CustomOutputName': 'Pod address'}),
        action('filter.health.quantity', {
            'WFContentItemFilter': {
                'Value': {
                    'WFActionParameterFilterPrefix': 1,
                    'WFContentPredicateBoundedDate': False,
                    'WFActionParameterFilterTemplates': [
                        {
                            'Property': 'Type', 'Operator': OPERATOR_IS, 'Removable': False, 'Bounded': True,
                            'Values': {'Enumeration': {'Value': 'Sleep', 'WFSerializationType': 'WFStringSubstitutableState'}},
                        },
                        {
                            'Property': 'Start Date', 'Operator': OPERATOR_IN_THE_LAST, 'Removable': False, 'Bounded': True,
                            'Values': {'Unit': UNIT_DAYS, 'Number': str(DAYS_LOOKED_BACK)},
                        },
                    ],
                },
                'WFSerializationType': 'WFContentPredicateTableTemplate',
            },
            'WFContentItemSortProperty': 'Start Date',
            'WFContentItemSortOrder': 'Oldest First',
            'WFContentItemLimitEnabled': False,
            'UUID': samples,
        }),
        action('repeat.each', {
            'WFInput': variable_input(output_of(samples, 'Health Samples')),
            'GroupingIdentifier': repeat_group,
            'WFControlFlowMode': CONTROL_FLOW_START,
        }),
        sample_detail('Start Date', start),
        iso_date(start, 'Start Date', start_iso),
        sample_detail('End Date', end),
        iso_date(end, 'End Date', end_iso),
        sample_detail('Value', value),
        action('gettext', {
            'WFTextActionText': text_with([
                output_of(start_iso, 'Formatted Date'), '|', output_of(end_iso, 'Formatted Date'), '|', output_of(value, 'Value'),
            ]),
            'UUID': line,
        }),
        action('repeat.each', {'UUID': repeat_results, 'GroupingIdentifier': repeat_group, 'WFControlFlowMode': CONTROL_FLOW_END}),
        action('downloadurl', {
            'WFURL': text_with([output_of(address, 'Pod address'), SLEEP_TIMES_PATH]),
            'WFHTTPMethod': 'POST',
            'WFHTTPBodyType': 'JSON',
            'WFJSONValues': {
                'Value': {'WFDictionaryFieldValueItems': [
                    json_field('source', [SOURCE_NAME]),
                    json_field('samples', [output_of(repeat_results, 'Repeat Results')]),
                ]},
                'WFSerializationType': 'WFDictionaryFieldValue',
            },
            'UUID': response,
        }),
        action('getvalueforkey', {
            'WFInput': variable_input(output_of(response, 'Contents of URL')),
            'WFDictionaryKey': 'message',
            'UUID': message,
        }),
        action('notification', {
            'WFNotificationActionTitle': 'SevenSleep',
            'WFNotificationActionBody': text_with([output_of(message, 'Dictionary Value')]),
            'UUID': new_uuid(),
        }),
    ]


def build_shortcut():
    actions = build_actions()
    address_index = next(
        index for index, built in enumerate(actions)
        if built['WFWorkflowActionParameters'].get('CustomOutputName') == 'Pod address'
    )
    return {
        'WFWorkflowClientVersion': '4607',
        'WFWorkflowMinimumClientVersion': 900,
        'WFWorkflowMinimumClientVersionString': '900',
        'WFWorkflowIcon': {'WFWorkflowIconStartColor': 463140863, 'WFWorkflowIconGlyphNumber': 61440},
        'WFWorkflowImportQuestions': [{
            'ActionIndex': address_index,
            'Category': 'Parameter',
            'DefaultValue': DEFAULT_POD_ADDRESS,
            'ParameterKey': 'WFTextActionText',
            'Text': ADDRESS_QUESTION,
        }],
        'WFWorkflowTypes': [],
        'WFWorkflowInputContentItemClasses': [],
        'WFWorkflowOutputContentItemClasses': [],
        'WFWorkflowHasShortcutInputVariables': False,
        'WFWorkflowHasOutputFallback': False,
        'WFQuickActionSurfaces': [],
        'WFWorkflowActions': actions,
    }


def main():
    if len(sys.argv) != 2:
        sys.exit('Usage: build_apple_health_shortcut.py <unsigned output file>')
    with open(sys.argv[1], 'wb') as output_file:
        plistlib.dump(build_shortcut(), output_file, fmt=plistlib.FMT_BINARY)
    print(f'Wrote {sys.argv[1]}. Sign it before sending it to a phone: shortcuts sign --mode anyone --input ... --output ...')


if __name__ == '__main__':
    main()
