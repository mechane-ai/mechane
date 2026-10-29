import { BYTES_PER_KIBIBYTE } from '@mechane/records';
import type { SourceId } from '@mechane/records';
import { SOURCE_CHECKOUT_TIMEOUT } from '@mechane/sandbox-wire';
import { Duration, Effect, Option } from 'effect';
import type { Redacted } from 'effect';
import { execFile } from 'node:child_process';
import { SourceGuestFailed } from '../../errors.ts';
import { sourceGitEnvironment } from './source-git-environment.ts';

/** Trusted checkout diagnostics are bounded and never returned to the agent. */
const SOURCE_GIT_OUTPUT_MAX_BYTES = 64 * BYTES_PER_KIBIBYTE;

/** Checkout processes have bounded time and output and cannot survive cancellation. */
const SOURCE_GIT_OPTIONS = {
  timeout: Duration.toMillis(SOURCE_CHECKOUT_TIMEOUT),
  maxBuffer: SOURCE_GIT_OUTPUT_MAX_BYTES,
  killSignal: 'SIGKILL',
  encoding: 'utf8',
} as const;

/** The guest image supplies this binary independently of repository contents and command PATH changes. */
const SOURCE_GIT_BINARY = '/usr/bin/git';

/** Suppresses repository hooks, machine credentials, ambient templates, and network protocol escalation. */
const SOURCE_GIT_CONFIGURATION = [
  '-c',
  'core.hooksPath=/dev/null',
  '-c',
  'init.templateDir=',
  '-c',
  'credential.helper=',
  '-c',
  'core.fsmonitor=false',
  '-c',
  'core.attributesFile=/dev/null',
  '-c',
  'gc.auto=0',
  '-c',
  'maintenance.auto=false',
  '-c',
  'fetch.writeCommitGraph=false',
  '-c',
  'http.followRedirects=false',
  '-c',
  'protocol.allow=never',
  '-c',
  'protocol.https.allow=always',
  '-c',
  'protocol.http.allow=always',
] as const;

/** One trusted Git command; only the fetch carries a short-lived token. */
type SourceGitInput = {
  readonly sourceId: SourceId;
  readonly folder: string;
  readonly arguments: ReadonlyArray<string>;
  /** None for initialization, local inspection, checkout, and remote configuration. */
  readonly token: Option.Option<Redacted.Redacted>;
};

type SourceGitOutcomeInput = { readonly sourceId: SourceId; readonly failure: unknown; readonly stdout: string };

/** Runs the trusted Git binary with an isolated environment and a sanitized failure result. */
export const runSourceGit = Effect.fn('runSourceGit')(function* ({
  ...input
}: SourceGitInput): Effect.fn.Return<string, SourceGuestFailed> {
  const { sourceId, folder, arguments: arguments_, token } = input;
  const environment = sourceGitEnvironment({ folder, token });
  const argumentsList = [...SOURCE_GIT_CONFIGURATION, ...arguments_];

  return yield* Effect.callback<string, SourceGuestFailed>((resume) => {
    const settle: (failure: unknown, stdout: string) => void = (failure, stdout) => {
      const outcome = sourceGitOutcome({ sourceId, failure, stdout });

      resume(outcome);
    };

    const child = execFile(
      SOURCE_GIT_BINARY,
      argumentsList,
      { cwd: folder, env: environment, ...SOURCE_GIT_OPTIONS },
      settle,
    );

    const stop: () => void = () => {
      child.kill('SIGKILL');
    };

    return Effect.sync(stop);
  });
});

/** The process result exposes no stderr, environment, command, or token from a Git failure. */
const sourceGitOutcome = Effect.fn('sourceGitOutcome')(function* ({
  sourceId,
  failure,
  stdout,
}: SourceGitOutcomeInput): Effect.fn.Return<string, SourceGuestFailed> {
  const failed = Option.fromNullishOr(failure);

  if (Option.isSome(failed)) {
    return yield* new SourceGuestFailed({ sourceId, reason: 'trusted Git checkout failed' });
  }

  return stdout;
});
