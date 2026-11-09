import { renamedWireStruct } from '@mechane/records';
import { Schema } from 'effect';
import { CommandShape, FlagKind } from '../constants.ts';
import type { CommandDeclaration } from '../types.ts';

/** Evaluations grade explicit Console messages from fresh mechs through the deployment. */
export const EVAL_COMMANDS = {
  'eval run': {
    summary:
      'run each case on a fresh mech, grade its Console messages with a fresh grader mech, and report each trial; reuse --out-folder to resume',
    shape: CommandShape.Document,
    operations: [
      'listWorkspaces',
      'readiness',
      'showAllowance',
      'createMech',
      'sendNotification',
      'listTurns',
      'showTurn',
      'listConsoleMessages',
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
