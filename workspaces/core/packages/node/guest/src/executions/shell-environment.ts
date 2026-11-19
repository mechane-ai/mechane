import { EXECUTION_VARIABLES } from '@mechane/sandbox-wire';
import type { ExecutionEnvironment, ExecutionRequest } from '@mechane/sandbox-wire';
import { Option, Record, Redacted } from 'effect';
import { delimiter, join } from 'node:path';
import { certificateEnvironment } from '../certificate-environment.ts';
import type { GuestSettings } from '../types.ts';
import { cacheEnvironment } from './cache-environment.ts';
import { GITHUB_ENVIRONMENT } from './github-environment.ts';

type ShellEnvironmentInput = {
  readonly request: Pick<ExecutionRequest, 'environment'>;
  readonly settings: GuestSettings;
};

type BoundEnvironment = { readonly base: Readonly<Record<string, string>>; readonly access: ExecutionEnvironment };

/** Keep guest-owned paths and trust settings when binding credentials to a command. */
export function bindShellAccess({ base, access }: BoundEnvironment): Readonly<Record<string, string>> {
  const secrets = Record.map(access.secrets, (value) => Redacted.value(value));
  const token = Record.get(secrets, 'GH_TOKEN');
  const github = Option.match(token, { onNone: () => ({}), onSome: () => GITHUB_ENVIRONMENT });
  const granted = { ...access.variables, ...secrets };
  const grantedJava = Record.get(granted, 'JAVA_TOOL_OPTIONS');
  const javaOptions = Option.getOrElse(grantedJava, () => '');
  const javaTrust = Record.get(base, 'JAVA_TOOL_OPTIONS');
  const java = Option.map(javaTrust, (trust) => ({ JAVA_TOOL_OPTIONS: `${javaOptions} ${trust}`.trim() }));

  return { ...granted, ...github, ...base, ...Option.getOrElse(java, () => ({})) };
}

export function shellEnvironment({ request, settings }: ShellEnvironmentInput): Readonly<Record<string, string>> {
  const localCommands = join(settings.home, '.local', 'bin');

  const base = {
    PATH: [localCommands, settings.path].join(delimiter),
    HOME: settings.home,
    ...EXECUTION_VARIABLES,
    ...certificateEnvironment(settings),
  };

  const access = Option.getOrElse(request.environment, () => ({ variables: {}, secrets: {} }));

  return { ...cacheEnvironment(settings), ...bindShellAccess({ base, access }) };
}
