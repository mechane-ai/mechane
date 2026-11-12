import { MechName, NotificationText, RoutineId, RoutineRevision } from '@mechane/protocol';
import { MechId, renamedWireStruct } from '@mechane/records';
import { Schema } from 'effect';
import { CommandShape, FlagKind } from '../constants.ts';
import type { CommandDeclaration } from '../types.ts';
import { MECH_ARGUMENT } from './constants.ts';

const ROUTINE_ARGUMENT = { name: 'routine-id', summary: 'the durable routine identity' } as const;
const IDENTITY_FIELDS = { mechId: MechId, routineId: RoutineId } as const;
const IDENTITY_RENAMES = { mechId: 'mech-id', routineId: 'routine-id' } as const;
const Revision = Schema.NumberFromString.pipe(Schema.decodeTo(RoutineRevision));
const integerMinutes = Schema.isInt();
const positiveMinutes = Schema.isGreaterThan(0);
const Minutes = Schema.NumberFromString.check(integerMinutes, positiveMinutes);
const Enabled = Schema.fromJsonString(Schema.Boolean);
const AfterRoutine = Schema.OptionFromOptionalKey(RoutineId);

const REVISION_FLAG = {
  revision: { kind: FlagKind.Text, summary: 'the current routine revision; 0 creates a new identity' },
} as const;

export const ROUTINE_COMMANDS = {
  'routine put': {
    summary: 'save a recurring notification with a revision check',
    shape: CommandShape.Document,
    operations: ['listWorkspaces', 'putRoutine'],
    flags: {
      ...REVISION_FLAG,
      'name': { kind: FlagKind.Text, summary: 'the display name of the routine' },
      'text': { kind: FlagKind.Text, summary: 'the ordinary notification text delivered at each interval' },
      'every-minutes': { kind: FlagKind.Text, summary: 'an interval from 1 minute to 30 days' },
      'enabled': { kind: FlagKind.Text, summary: 'true enables delivery; false pauses future delivery' },
    },
    arguments: [MECH_ARGUMENT, ROUTINE_ARGUMENT],
    input: renamedWireStruct({
      fields: {
        ...IDENTITY_FIELDS,
        expectedRevision: Revision,
        name: MechName,
        text: NotificationText,
        everyMinutes: Minutes,
        enabled: Enabled,
      },
      renames: { ...IDENTITY_RENAMES, expectedRevision: 'revision', everyMinutes: 'every-minutes' },
    }),
  },
  'routine show': {
    summary: 'show routine configuration and delivery and observation evidence',
    shape: CommandShape.Document,
    operations: ['listWorkspaces', 'showRoutine'],
    flags: {},
    arguments: [MECH_ARGUMENT, ROUTINE_ARGUMENT],
    input: renamedWireStruct({ fields: IDENTITY_FIELDS, renames: IDENTITY_RENAMES }),
  },
  'routine list': {
    summary: 'list routines and retained deletion receipts for one mech',
    shape: CommandShape.Document,
    operations: ['listWorkspaces', 'listRoutines'],
    flags: { after: { kind: FlagKind.Text, summary: 'continue after the previous page cursor' } },
    arguments: [MECH_ARGUMENT],
    input: renamedWireStruct({ fields: { mechId: MechId, after: AfterRoutine }, renames: { mechId: 'mech-id' } }),
  },
  'routine delete': {
    summary: 'stop future delivery while preserving accepted notifications and evidence',
    shape: CommandShape.Document,
    operations: ['listWorkspaces', 'deleteRoutine'],
    flags: REVISION_FLAG,
    arguments: [MECH_ARGUMENT, ROUTINE_ARGUMENT],
    input: renamedWireStruct({
      fields: { ...IDENTITY_FIELDS, expectedRevision: Revision },
      renames: { ...IDENTITY_RENAMES, expectedRevision: 'revision' },
    }),
  },
} as const satisfies Readonly<Record<string, CommandDeclaration>>;
