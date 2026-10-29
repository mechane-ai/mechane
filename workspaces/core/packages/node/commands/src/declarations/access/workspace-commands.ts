import { NoFields } from '@mechane/protocol';
import { CommandShape } from '../../constants.ts';
import type { CommandDeclaration } from '../../types.ts';

/** The commands that read the workspaces the account belongs to, and its workspace's daily allowance. */
export const WORKSPACE_COMMANDS = {
  'workspace list': {
    summary: 'list the workspaces you belong to, with your role and each daily model allowance',
    shape: CommandShape.Document,
    operations: ['listWorkspaces'],
    flags: {},
    arguments: [],
    input: NoFields,
  },
  'allowance show': {
    summary: "show your workspace's daily model allowance and what the current UTC day has committed of it",
    shape: CommandShape.Document,
    operations: ['listWorkspaces', 'showAllowance'],
    flags: {},
    arguments: [],
    input: NoFields,
  },
} as const satisfies Readonly<Record<string, CommandDeclaration>>;
