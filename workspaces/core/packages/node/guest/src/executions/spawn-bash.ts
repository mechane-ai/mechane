import { EXECUTION_VARIABLES } from '@mechane/sandbox-wire';
import type { ExecutionId, ExecutionRequest } from '@mechane/sandbox-wire';
import { Effect, Option, Record, Redacted } from 'effect';
import { spawn } from 'node:child_process';
import { delimiter, join } from 'node:path';
import { ExecutionUnstarted } from '../errors.ts';
import { gatewayCertificates } from '../gateway-certificates.ts';
import type { GuestSettings } from '../types.ts';
import { GITHUB_ENVIRONMENT } from './github-environment.ts';
import { spawnedBash } from './spawned-bash.ts';
import type { BashRun } from './types.ts';

type SpawnBashInput = {
  readonly executionId: ExecutionId;
  readonly request: ExecutionRequest;
  readonly settings: GuestSettings;
};

/**
 * Spawns bash with the text after the end of its options, so text that starts with a dash is still a command. The
 * system can refuse the spawn, such as past the machine's process limit or once the home is gone, and then bash never
 * started.
 */
export const spawnBash = Effect.fn('spawnBash')(function* ({
  executionId,
  request,
  settings,
}: SpawnBashInput): Effect.fn.Return<BashRun, ExecutionUnstarted> {
  const certificates = gatewayCertificates();

  const access = Option.getOrElse(request.environment, () => ({ variables: {}, secrets: {} }));
  const secrets = Record.map(access.secrets, (value) => Redacted.value(value));
  const token = Record.get(secrets, 'GH_TOKEN');
  const github = Option.match(token, { onNone: () => ({}), onSome: () => GITHUB_ENVIRONMENT });
  const localCommands = join(settings.home, '.local', 'bin');
  const commandPath = [localCommands, settings.path].join(delimiter);

  const environment = {
    ...access.variables,
    ...secrets,
    ...github,
    PATH: commandPath,
    HOME: settings.home,
    ...EXECUTION_VARIABLES,
    ...certificates,
  };

  return yield* Effect.callback<BashRun, ExecutionUnstarted>((resume) => {
    const child = spawn('bash', ['-c', '--', request.command], {
      cwd: settings.home,
      env: environment,
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const refuse: (error: Error) => void = (error) =>
      resume(Effect.fail(new ExecutionUnstarted({ executionId, reason: error.message })));

    const start: () => void = () => resume(Effect.succeed(spawnedBash({ child })));

    child.once('error', refuse);
    child.once('spawn', start);
  });
});
