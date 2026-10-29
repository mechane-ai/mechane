import { RecordId, renamedWireStruct, TurnId } from '@mechane/records';
import { CommandShape } from '../constants.ts';
import type { CommandDeclaration } from '../types.ts';
import { MECH_ARGUMENT } from './constants.ts';
import { MechCommandInput } from './schemas.ts';

/** The argument that names a turn of the mech, by the id `mechane event list` printed. */
const TURN_ARGUMENT = { name: 'turn-id', summary: 'the id of the turn, as mechane event list prints it' } as const;

/** The input of a command on one turn of a mech. */
const TurnCommandInput = renamedWireStruct({
  fields: { mechId: RecordId, turnId: TurnId },
  renames: { mechId: 'mech-id', turnId: 'turn-id' },
});

/** The commands that show and cancel one turn of a mech, and list the memories its turns saved. */
export const TURN_COMMANDS = {
  'turn show': {
    summary: 'show one turn of a mech: its outcome, and each model request it reserved, with its tokens and charge',
    shape: CommandShape.Document,
    operations: ['listWorkspaces', 'showTurn'],
    flags: {},
    arguments: [MECH_ARGUMENT, TURN_ARGUMENT],
    input: TurnCommandInput,
  },
  'turn cancel': {
    summary:
      'cancel a running turn and its unfinished command; the turn ends unanswered and saves none of its memory changes',
    shape: CommandShape.Document,
    operations: ['listWorkspaces', 'cancelTurn'],
    flags: {},
    arguments: [MECH_ARGUMENT, TURN_ARGUMENT],
    input: TurnCommandInput,
  },
  'memory list': {
    summary: 'list the memories a mech saved, by path, each with its version, the turn that saved it, and its text',
    shape: CommandShape.Document,
    operations: ['listWorkspaces', 'listMemories'],
    flags: {},
    arguments: [MECH_ARGUMENT],
    input: MechCommandInput,
  },
} as const satisfies Readonly<Record<string, CommandDeclaration>>;
