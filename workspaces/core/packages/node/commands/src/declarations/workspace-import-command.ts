import { Schema } from 'effect';
import { CommandShape, FlagKind } from '../constants.ts';
import type { CommandDeclaration } from '../types.ts';

/** An explicit private file seeds missing runtime records while preserving changes already made through the API. */
export const WORKSPACE_IMPORT_COMMAND = {
  'workspace import': {
    summary: 'import missing workspace credentials, Slack installations and policy without replacing runtime data',
    shape: CommandShape.Document,
    operations: [
      'listWorkspaces',
      'putCredential',
      'configureSlackInstallation',
      'setWorkspacePolicy',
      'showWorkspacePolicy',
    ],
    flags: { file: { kind: FlagKind.Text, summary: 'the private JSON file containing runtime configuration' } },
    arguments: [],
    input: Schema.Struct({ file: Schema.NonEmptyString }),
  },
} as const satisfies Readonly<Record<string, CommandDeclaration>>;
