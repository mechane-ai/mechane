import { Duration, Effect } from 'effect';
import type { Scope } from 'effect';
import { spawn } from 'node:child_process';
import { DistributionStep } from '../constants.ts';
import { DistributionFailed } from '../errors.ts';
import type { ArchiveEntryInput, ArchiveProcess } from './types.ts';

const ENTRY_TIMEOUT = Duration.minutes(5);
const ENTRY_TIMEOUT_MS = Duration.toMillis(ENTRY_TIMEOUT);
type OpenedEntry = { readonly child: ArchiveProcess; readonly close: () => void };

/** Keeps blob extraction within the caller's scope and terminates the reader at its deadline. */
export const openArchiveEntry = Effect.fn('openArchiveEntry')(function* ({
  path,
  entry,
  settings,
  format,
}: ArchiveEntryInput): Effect.fn.Return<ArchiveProcess, DistributionFailed, Scope.Scope> {
  const acquisition = spawnArchiveEntry({ path, entry, settings, format });
  const { child } = yield* Effect.acquireRelease(acquisition, ({ close }) => Effect.sync(close));

  return child;
});

const spawnArchiveEntry = Effect.fn('spawnArchiveEntry')(function* ({
  path,
  entry,
  settings,
  format,
}: ArchiveEntryInput): Effect.fn.Return<OpenedEntry, DistributionFailed> {
  const reader = { command: 'tar', args: ['-xOf', path, entry] };

  if (format === 'zip') {
    reader.command = 'unzip';
    reader.args = ['-p', path, entry];
  }

  const child = yield* Effect.try({
    try: () =>
      spawn(reader.command, reader.args, {
        env: settings.inherited,
        timeout: ENTRY_TIMEOUT_MS,
        killSignal: 'SIGKILL',
        stdio: ['ignore', 'pipe', 'ignore'],
      }),
    catch: () =>
      new DistributionFailed({ step: DistributionStep.Verify, reason: 'artifact archive reader could not start' }),
  });

  const close: () => void = () => {
    child.kill('SIGKILL');
  };

  return { child, close };
});
