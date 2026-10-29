import { renamedWireStruct } from '@mechane/records';
import { CommandShape } from '../../constants.ts';
import type { CommandDeclaration } from '../../types.ts';
import { MECH_ARGUMENT } from '../constants.ts';
import { CHANGE_RENAMES, REVISION_FLAG } from './constants.ts';
import { CHANGE_FIELDS } from './schemas.ts';

/** The mech and revision that a lifecycle change must match. */
const MechChangeInput = renamedWireStruct({ fields: CHANGE_FIELDS, renames: CHANGE_RENAMES });

type MechChangeInput = typeof MechChangeInput.Type;

const LIFECYCLE_COMMAND = {
  shape: CommandShape.Document,
  operations: ['listWorkspaces', 'updateMech'],
  flags: REVISION_FLAG,
  arguments: [MECH_ARGUMENT],
  input: MechChangeInput,
} as const;

/** Commands that suspend or resume future turns while preserving the mech and its history. */
export const MECH_LIFECYCLE_COMMANDS = {
  'mech pause': {
    ...LIFECYCLE_COMMAND,
    summary: 'pause new turns while running work finishes and queued input stays durable',
  },
  'mech resume': { ...LIFECYCLE_COMMAND, summary: 'resume a paused or archived mech and release its queued input' },
  'mech archive': {
    ...LIFECYCLE_COMMAND,
    summary: 'retain the mech and its history while stopping new turns and refusing new input',
  },
} as const satisfies Readonly<Record<string, CommandDeclaration>>;
