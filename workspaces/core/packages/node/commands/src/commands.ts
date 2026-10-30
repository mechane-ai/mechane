import { AUTH_COMMANDS } from './declarations/access/auth-commands.ts';
import { KEY_COMMANDS } from './declarations/access/key-commands.ts';
import { WORKSPACE_COMMANDS } from './declarations/access/workspace-commands.ts';
import { WORKSPACE_POLICY_COMMANDS } from './declarations/access/workspace-policy-commands.ts';
import { DEPLOYMENT_COMMANDS } from './declarations/deployment-commands.ts';
import { DRONE_COMMANDS } from './declarations/drone-commands.ts';
import { EVAL_COMMANDS } from './declarations/eval-commands.ts';
import { CONNECTION_COMMANDS } from './declarations/integrations/connection-commands.ts';
import { CREDENTIAL_COMMANDS } from './declarations/integrations/credential-commands.ts';
import { SLACK_COMMANDS } from './declarations/integrations/slack-commands.ts';
import { SLACK_INSTALLATION_COMMANDS } from './declarations/integrations/slack-installation-commands.ts';
import { MECH_ADMINISTRATION_COMMANDS } from './declarations/mech-administration/mech-administration-commands.ts';
import { MECH_LIFECYCLE_COMMANDS } from './declarations/mech-administration/mech-lifecycle-commands.ts';
import { MECH_COMMANDS } from './declarations/mech-commands.ts';
import { RELEASE_COMMANDS } from './declarations/release-commands.ts';
import { SOURCE_COMMANDS } from './declarations/source-commands.ts';
import { TURN_COMMANDS } from './declarations/turn-commands.ts';
import { WATCH_COMMANDS } from './declarations/watch-commands.ts';
import { WORKSPACE_IMPORT_COMMAND } from './declarations/workspace-import-command.ts';
import { WORKSPACE_LIFECYCLE_COMMANDS } from './declarations/workspace-lifecycle-commands.ts';
import type { CommandDeclaration } from './types.ts';

/** Every command, keyed by the words a person types, in the order `--help` lists them. */
export const COMMANDS = {
  ...SOURCE_COMMANDS,
  ...WATCH_COMMANDS,
  ...SLACK_COMMANDS,
  ...SLACK_INSTALLATION_COMMANDS,
  ...CONNECTION_COMMANDS,
  ...CREDENTIAL_COMMANDS,
  ...DEPLOYMENT_COMMANDS,
  ...AUTH_COMMANDS,
  ...KEY_COMMANDS,
  ...WORKSPACE_COMMANDS,
  ...WORKSPACE_POLICY_COMMANDS,
  ...MECH_COMMANDS,
  ...MECH_ADMINISTRATION_COMMANDS,
  ...MECH_LIFECYCLE_COMMANDS,
  ...WORKSPACE_LIFECYCLE_COMMANDS,
  ...WORKSPACE_IMPORT_COMMAND,
  ...TURN_COMMANDS,
  ...DRONE_COMMANDS,
  ...EVAL_COMMANDS,
  ...RELEASE_COMMANDS,
} as const satisfies Readonly<Record<string, CommandDeclaration>>;

/** The words of a command, such as `mech create`. */
export type CommandName = keyof typeof COMMANDS;

/** The decoded input of a command's flags and arguments, which its run reads. */
export type CommandInput<N extends CommandName> = (typeof COMMANDS)[N]['input']['Type'];
