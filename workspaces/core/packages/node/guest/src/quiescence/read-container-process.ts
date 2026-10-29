import { WorkspaceStep } from '@mechane/sandbox-wire';
import { Effect, Option, Record, Result, Schema } from 'effect';
import { readFileSync } from 'node:fs';
import { WorkspaceFailed } from '../errors.ts';
import type { WorkspaceFilesInput } from '../types.ts';
import { containerProcessPath } from './container-process-path.ts';
import { ContainerProcess, ProcessDisappeared } from './container-process.schemas.ts';

/** A numeric directory entry discovered while enumerating the proc filesystem. */
type ReadContainerProcessInput = Pick<WorkspaceFilesInput, 'generation'> & { readonly directory: string };

/** Reads a process identity while tolerating processes that disappear during enumeration. */
export const readContainerProcess = Effect.fn('readContainerProcess')(function* ({
  generation,
  directory,
}: ReadContainerProcessInput): Effect.fn.Return<Option.Option<ContainerProcess>, WorkspaceFailed> {
  const path = containerProcessPath({ directory });
  const read = Result.try(() => readFileSync(path, 'utf8'));

  if (Result.isFailure(read)) {
    if (Schema.is(ProcessDisappeared)(read.failure)) {
      return Option.none();
    }

    const reason = String(read.failure);

    return yield* new WorkspaceFailed({ generation, step: WorkspaceStep.Archive, reason });
  }

  const lines = read.success.trim().split('\n');

  const field: (line: string) => readonly [string, string] = (line) => {
    const separator = line.indexOf(':');

    return [line.slice(0, separator), line.slice(separator + 1).trim()] as const;
  };

  const fields = lines.map(field);
  const record = Record.fromEntries(fields);

  const decoded = yield* Schema.decodeUnknownEffect(ContainerProcess)(record).pipe(
    Effect.mapError(
      (failure) => new WorkspaceFailed({ generation, step: WorkspaceStep.Archive, reason: failure.message }),
    ),
  );

  return Option.some(decoded);
});
