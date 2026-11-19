import { AUTH_COMMANDS } from './declarations/access/auth-commands.ts';
import { KEY_COMMANDS } from './declarations/access/key-commands.ts';
import { SERVICE_PRINCIPAL_COMMANDS } from './declarations/access/service-principal-commands.ts';
import { WORKSPACE_COMMANDS } from './declarations/access/workspace-commands.ts';
import { WORKSPACE_POLICY_COMMANDS } from './declarations/access/workspace-policy-commands.ts';
import { DEPLOYMENT_COMMANDS } from './declarations/deployment-commands.ts';
import { EVAL_COMMANDS } from './declarations/eval-commands.ts';
import { HISTORY_COMMANDS } from './declarations/history-commands.ts';
import { CONNECTION_COMMANDS } from './declarations/integrations/connection-commands.ts';
import { CREDENTIAL_COMMANDS } from './declarations/integrations/credential-commands.ts';
import { EXECUTION_ACCESS_COMMANDS } from './declarations/integrations/execution-access-commands.ts';
import { RELEASE_COMMANDS } from './declarations/release-commands.ts';
import { WORKSPACE_IMPORT_COMMAND } from './declarations/workspace-import-command.ts';
import { WORKSPACE_LIFECYCLE_COMMANDS } from './declarations/workspace-lifecycle-commands.ts';
import type { CommandDeclaration } from './types.ts';

/** Every command, keyed by the words a person types, in the order `--help` lists them. */
export const COMMANDS = {
  ...CONNECTION_COMMANDS,
  ...EXECUTION_ACCESS_COMMANDS,
  ...CREDENTIAL_COMMANDS,
  ...DEPLOYMENT_COMMANDS,
  ...AUTH_COMMANDS,
  ...KEY_COMMANDS,
  ...SERVICE_PRINCIPAL_COMMANDS,
  ...WORKSPACE_COMMANDS,
  ...WORKSPACE_POLICY_COMMANDS,
  ...HISTORY_COMMANDS,
  ...WORKSPACE_LIFECYCLE_COMMANDS,
  ...WORKSPACE_IMPORT_COMMAND,
  ...EVAL_COMMANDS,
  ...RELEASE_COMMANDS,
} as const satisfies Readonly<Record<string, CommandDeclaration>>;

/** The words of a command, such as `workspace show`. */
export type CommandName = keyof typeof COMMANDS;

/** The decoded input of a command's flags and arguments, which its run reads. */
export type CommandInput<N extends CommandName> = (typeof COMMANDS)[N]['input']['Type'];
