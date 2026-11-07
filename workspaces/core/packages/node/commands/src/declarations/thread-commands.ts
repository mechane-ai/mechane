import { CommandShape } from '../constants.ts';
import type { CommandDeclaration } from '../types.ts';
import { MECH_ARGUMENT } from './constants.ts';
import { MechCommandInput } from './schemas.ts';

/** Work items are distinct from conversation sessions. */
export const THREAD_COMMANDS = {
  'thread list': {
    summary: 'list the work items a mech opened, oldest first, each with its state and its note',
    shape: CommandShape.Document,
    operations: ['listWorkspaces', 'listThreads'],
    flags: {},
    arguments: [MECH_ARGUMENT],
    input: MechCommandInput,
  },
} as const satisfies Readonly<Record<string, CommandDeclaration>>;
