import { renamedWireStruct } from '@mechane/records';
import { Schema } from 'effect';
import { CommandShape, FlagKind } from '../constants.ts';
import type { CommandDeclaration } from '../types.ts';

/** The command that measures a mech through the deployment: a suite's cases, each reply graded by a grader mech. */
export const EVAL_COMMANDS = {
  'eval run': {
    summary:
      "run a suite's cases, each on a fresh mech, grade each reply with a fresh grader mech, and report each trial; a rerun with the same --out-folder resumes",
    shape: CommandShape.Document,
    operations: [
      'listWorkspaces',
      'readiness',
      'showAllowance',
      'createMech',
      'sendInboxItem',
      'listEvents',
      'showTurn',
    ],
    flags: {
      'suite': { kind: FlagKind.Text, summary: 'the suite file: JSON with its cases and their expectations' },
      'out-folder': {
        kind: FlagKind.Text,
        summary: "the folder that keeps the plan, each trial's records and the report",
      },
    },
    arguments: [],
    input: renamedWireStruct({
      fields: { suiteFile: Schema.NonEmptyString, outFolder: Schema.NonEmptyString },
      renames: { suiteFile: 'suite', outFolder: 'out-folder' },
    }),
  },
} as const satisfies Readonly<Record<string, CommandDeclaration>>;
