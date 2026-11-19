import { LogEventCursor, NoFields, RoutineId } from '@mechane/protocol';
import { MechId, renamedWireStruct, TurnId } from '@mechane/records';
import { Schema } from 'effect';
import { CommandShape, FlagKind } from '../constants.ts';
import type { CommandDeclaration } from '../types.ts';
import { MECH_ARGUMENT } from './constants.ts';
import { MechCommandInput } from './schemas.ts';

const AfterHeld = Schema.OptionFromOptionalKey(Schema.NonEmptyString);
const ROUTINE_ARGUMENT = { name: 'routine-id', summary: 'the durable routine identity' } as const;
const IDENTITY_FIELDS = { mechId: MechId, routineId: RoutineId } as const;
const IDENTITY_RENAMES = { mechId: 'mech-id', routineId: 'routine-id' } as const;
const AfterRoutine = Schema.OptionFromOptionalKey(RoutineId);
const TURN_ARGUMENT = { name: 'turn-id', summary: 'the id of the turn, as mechane history events prints it' } as const;

/** The input of a command on one turn of a mech. */
const TurnCommandInput = renamedWireStruct({
  fields: { mechId: MechId, turnId: TurnId },
  renames: { mechId: 'mech-id', turnId: 'turn-id' },
});

/** Operator access to records created before the Managed Agents cutover. */
export const HISTORY_COMMANDS = {
  'history mechs': {
    summary: 'list the mechs of your workspace, oldest first, each with the mech it was forked from',
    shape: CommandShape.Document,
    operations: ['listWorkspaces', 'listMechs'],
    flags: {},
    arguments: [],
    input: NoFields,
  },
  'history mech': {
    summary: 'show the mech definition, lifecycle, and current and active revisions',
    shape: CommandShape.Document,
    operations: ['listWorkspaces', 'showMech'],
    flags: {},
    arguments: [MECH_ARGUMENT],
    input: MechCommandInput,
  },
  'history events': {
    summary: 'write retained events after a cursor, one record per event',
    shape: CommandShape.Stream,
    operations: ['listWorkspaces', 'listEvents'],
    flags: {
      after: {
        kind: FlagKind.Text,
        summary: 'the sequence of the last event you have, to resume after it; 0 when absent',
      },
    },
    arguments: [MECH_ARGUMENT],
    input: renamedWireStruct({
      fields: {
        mechId: MechId,
        /** Absent for the log's start. */
        after: LogEventCursor,
      },
      renames: { mechId: 'mech-id' },
    }),
  },
  'history held': {
    summary: 'inspect unfinished historical work and uncertain effects without resuming them',
    shape: CommandShape.Document,
    operations: ['listWorkspaces', 'listHeldWork'],
    flags: { after: { kind: FlagKind.Text, summary: 'continue after the preceding page cursor' } },
    arguments: [MECH_ARGUMENT],
    input: renamedWireStruct({ fields: { mechId: MechId, after: AfterHeld }, renames: { mechId: 'mech-id' } }),
  },
  'history turn': {
    summary: 'show one turn of a mech: its outcome, and each model request it reserved, with its tokens and charge',
    shape: CommandShape.Document,
    operations: ['listWorkspaces', 'showTurn'],
    flags: {},
    arguments: [MECH_ARGUMENT, TURN_ARGUMENT],
    input: TurnCommandInput,
  },
  'history routines': {
    summary: 'list routines and retained deletion receipts for one mech',
    shape: CommandShape.Document,
    operations: ['listWorkspaces', 'listRoutines'],
    flags: { after: { kind: FlagKind.Text, summary: 'continue after the previous page cursor' } },
    arguments: [MECH_ARGUMENT],
    input: renamedWireStruct({ fields: { mechId: MechId, after: AfterRoutine }, renames: { mechId: 'mech-id' } }),
  },
  'history routine': {
    summary: 'show routine configuration and delivery and observation evidence',
    shape: CommandShape.Document,
    operations: ['listWorkspaces', 'showRoutine'],
    flags: {},
    arguments: [MECH_ARGUMENT, ROUTINE_ARGUMENT],
    input: renamedWireStruct({ fields: IDENTITY_FIELDS, renames: IDENTITY_RENAMES }),
  },
} as const satisfies Readonly<Record<string, CommandDeclaration>>;
