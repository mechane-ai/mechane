import { MechId, renamedWireStruct, TurnId } from '@mechane/records';
import { CommandShape } from '../constants.ts';
import type { CommandDeclaration } from '../types.ts';
import { MECH_ARGUMENT } from './constants.ts';

/** The argument that names a turn of the mech, by the id `mechane event list` printed. */
const TURN_ARGUMENT = { name: 'turn-id', summary: 'the id of the turn, as mechane event list prints it' } as const;

/** The input of a command on one turn of a mech. */
const TurnCommandInput = renamedWireStruct({
  fields: { mechId: MechId, turnId: TurnId },
  renames: { mechId: 'mech-id', turnId: 'turn-id' },
});

/** The commands inspect and stop one execution while retaining its trace. */
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
    summary: 'cancel a running turn and its unfinished command',
    shape: CommandShape.Document,
    operations: ['listWorkspaces', 'cancelTurn'],
    flags: {},
    arguments: [MECH_ARGUMENT, TURN_ARGUMENT],
    input: TurnCommandInput,
  },
} as const satisfies Readonly<Record<string, CommandDeclaration>>;
