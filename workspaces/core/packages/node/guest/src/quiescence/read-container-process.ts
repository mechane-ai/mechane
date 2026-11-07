import { WorkspaceStep } from '@mechane/sandbox-wire';
import { Effect, Option, Record, Result, Schema } from 'effect';
import { readFileSync } from 'node:fs';
import { WorkspaceFailed } from '../errors.ts';
import type { WorkspaceFilesInput } from '../types.ts';
import { ContainerProcessFile, containerProcessPath } from './container-process-path.ts';
import { ContainerProcess, ProcessDisappeared } from './container-process.schemas.ts';

/** A numeric directory entry discovered while enumerating the proc filesystem. */
type ReadContainerProcessInput = Pick<WorkspaceFilesInput, 'generation'> & { readonly directory: string };

const STAT_GROUP_INDEX = 2;
const STAT_START_INDEX = 19;

/** Reads a process identity while tolerating processes that disappear during enumeration. */
export const readContainerProcess = Effect.fn('readContainerProcess')(function* ({
  generation,
  directory,
}: ReadContainerProcessInput): Effect.fn.Return<Option.Option<ContainerProcess>, WorkspaceFailed> {
  const path = containerProcessPath({ directory, file: ContainerProcessFile.Status });
  const read = Result.try(() => readFileSync(path, 'utf8'));

  if (Result.isFailure(read)) {
    const disappeared = Schema.decodeUnknownResult(ProcessDisappeared)(read.failure);

    if (Result.isSuccess(disappeared)) {
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
  const statPath = containerProcessPath({ directory, file: ContainerProcessFile.Stat });
  const stat = Result.try(() => readFileSync(statPath, 'utf8'));

  if (Result.isFailure(stat)) {
    const disappeared = Schema.decodeUnknownResult(ProcessDisappeared)(stat.failure);

    if (Result.isSuccess(disappeared)) {
      return Option.none();
    }

    const reason = String(stat.failure);

    return yield* new WorkspaceFailed({ generation, step: WorkspaceStep.Archive, reason });
  }

  // The process name may contain spaces and parentheses; the remaining fields begin after its final parenthesis.
  const nameEnd = stat.success.lastIndexOf(')') + 1;
  const statFields = stat.success.slice(nameEnd).trim().split(/\s+/);

  const identity = {
    ...record,
    State: statFields[0],
    groupId: statFields[STAT_GROUP_INDEX],
    startedAt: statFields[STAT_START_INDEX],
  };

  const decoded = yield* Schema.decodeUnknownEffect(ContainerProcess)(identity).pipe(
    Effect.mapError(
      (failure) => new WorkspaceFailed({ generation, step: WorkspaceStep.Archive, reason: failure.message }),
    ),
  );

  return Option.some(decoded);
});
