import { EXECUTION_VARIABLES } from '@mechane/sandbox-wire';
import type { ExecutionRequest } from '@mechane/sandbox-wire';
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

/** Reveals granted secrets only at shell creation and adds installed tools to the command path. */
export function shellEnvironment({ request, settings }: ShellEnvironmentInput): Readonly<Record<string, string>> {
  const certificates = certificateEnvironment(settings);
  const access = Option.getOrElse(request.environment, () => ({ variables: {}, secrets: {} }));
  const secrets = Record.map(access.secrets, (value) => Redacted.value(value));
  const token = Record.get(secrets, 'GH_TOKEN');
  const github = Option.match(token, { onNone: () => ({}), onSome: () => GITHUB_ENVIRONMENT });
  const localCommands = join(settings.home, '.local', 'bin');
  const commandPath = [localCommands, settings.path].join(delimiter);

  return {
    ...cacheEnvironment(settings),
    ...access.variables,
    ...secrets,
    ...github,
    PATH: commandPath,
    HOME: settings.home,
    ...EXECUTION_VARIABLES,
    ...certificates,
  };
}
