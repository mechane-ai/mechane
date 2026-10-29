import { NoFields } from '@mechane/protocol';
import { CommandShape } from '../../constants.ts';
import type { CommandDeclaration } from '../../types.ts';

/** The commands that sign the CLI in and out, and report what it signs in as. */
export const AUTH_COMMANDS = {
  'auth login': {
    summary:
      'sign in through an approval in the browser, save the login key for this origin, and revoke the one it replaces',
    shape: CommandShape.Document,
    operations: ['startDeviceApproval', 'pollDeviceApproval', 'revokeKey'],
    flags: {},
    arguments: [],
    input: NoFields,
  },
  'auth status': {
    summary: 'report the account, its workspaces and the key this CLI signs in with, and when the key expires',
    shape: CommandShape.Document,
    operations: ['showPrincipal', 'listWorkspaces'],
    flags: {},
    arguments: [],
    input: NoFields,
  },
  'auth logout': {
    summary: 'revoke the saved login key on the deployment, then remove the saved login',
    shape: CommandShape.Document,
    operations: ['revokeKey'],
    flags: {},
    arguments: [],
    input: NoFields,
  },
} as const satisfies Readonly<Record<string, CommandDeclaration>>;
