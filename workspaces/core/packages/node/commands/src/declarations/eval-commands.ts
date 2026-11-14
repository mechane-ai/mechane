import { renamedWireStruct } from '@mechane/records';
import { Effect, Schema } from 'effect';
import { CommandShape, FlagKind } from '../constants.ts';
import type { CommandDeclaration } from '../types.ts';

const EvalInspectInput = renamedWireStruct({
  fields: { outFolder: Schema.NonEmptyString, caseId: Schema.OptionFromOptionalKey(Schema.NonEmptyString) },
  renames: { outFolder: 'run-folder', caseId: 'case' },
});

const EvalCompareInput = renamedWireStruct({
  fields: {
    baselineFolder: Schema.NonEmptyString,
    candidateFolder: Schema.NonEmptyString,
    shouldFailOnRegression: Schema.Boolean.pipe(Schema.withDecodingDefaultKey(Effect.succeed(false))),
  },
  renames: {
    baselineFolder: 'baseline-folder',
    candidateFolder: 'candidate-folder',
    shouldFailOnRegression: 'fail-on-regression',
  },
});

/** Evaluations grade explicit Console messages from fresh mechs through the deployment. */
export const EVAL_COMMANDS = {
  'eval inspect': {
    summary:
      'inspect saved evaluation completion, evidence, grades, usage, and cleanup without credentials or a runtime',
    shape: CommandShape.Document,
    operations: [],
    flags: {
      case: {
        kind: FlagKind.Text,
        summary: 'show the saved trials of one case while retaining the whole-run denominators',
      },
    },
    arguments: [{ name: 'run-folder', summary: 'the saved evaluation directory' }],
    input: EvalInspectInput,
  },
  'eval compare': {
    summary:
      'compare saved evaluations with matching cases, judge, fixture, evidence, and grading rules without model requests',
    shape: CommandShape.Document,
    operations: [],
    flags: {
      'fail-on-regression': {
        kind: FlagKind.Switch,
        summary: 'fail for a complete, comparable regression in the suite grade projection',
      },
    },
    arguments: [
      { name: 'baseline-folder', summary: 'the saved baseline evaluation directory' },
      { name: 'candidate-folder', summary: 'the saved candidate evaluation directory' },
    ],
    input: EvalCompareInput,
  },
  'eval run': {
    summary:
      'run each case on a fresh mech, grade its Console messages with a fresh grader mech, and report each trial; reuse --out-folder to resume',
    shape: CommandShape.Document,
    operations: [
      'listWorkspaces',
      'readiness',
      'showAllowance',
      'createMech',
      'showMech',
      'updateMech',
      'sendNotification',
      'listTurns',
      'showTurn',
      'cancelTurn',
      'listConsoleMessages',
      'createConnection',
      'listConnections',
      'updateConnection',
      'deleteConnection',
      'grantTools',
      'putCredential',
      'deleteCredential',
      'configureExecutionAccess',
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
