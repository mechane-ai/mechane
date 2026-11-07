import { finishedProcess } from '@mechane/program';
import { GuestScope, WorkspaceStep } from '@mechane/sandbox-wire';
import { Duration, Effect, Option, Schema } from 'effect';
import { WorkspaceFailed } from '../errors.ts';
import type { FreezeInput, FreezeProcess } from './freeze.types.ts';
import { liveContainerProcesses } from './live-container-processes.ts';

const PROCESS_SCAN_TIMEOUT = Duration.seconds(1);
const PROCESS_FIELDS = /^\s*(\d+)\s+(\d+)\s+(\S+)\s+(.+?)\s*$/;
const DEAD_PROCESS_STATES: ReadonlySet<string> = new Set(['Z', 'X']);

const HostProcess = Schema.Struct({
  processId: Schema.NumberFromString,
  groupId: Schema.NumberFromString,
  state: Schema.NonEmptyString,
  startedAt: Schema.NonEmptyString,
});

/** Enumerates isolated-container writers or only guest-owned groups when sharing a host. */
export const readFreezeProcesses = Effect.fn('readFreezeProcesses')(function* (
  input: FreezeInput,
): Effect.fn.Return<ReadonlyArray<FreezeProcess>, WorkspaceFailed> {
  if (input.settings.scope === GuestScope.Container) {
    const processes = yield* liveContainerProcesses(input);

    return processes.map((candidate) => ({
      processId: candidate.Pid,
      groupId: candidate.groupId,
      state: candidate.State,
      startedAt: candidate.startedAt,
    }));
  }

  const groups = input.ownedProcessGroups();
  const ownedGroups = new Set(groups);

  if (ownedGroups.size === 0) {
    return [];
  }

  const result = yield* finishedProcess({
    command: '/bin/ps',
    args: ['-axo', 'pid=,pgid=,state=,lstart='],
    environment: { PATH: input.settings.path, LC_ALL: 'C' },
    timeout: PROCESS_SCAN_TIMEOUT,
  }).pipe(
    Effect.mapError(
      (failure) =>
        new WorkspaceFailed({ generation: input.generation, step: WorkspaceStep.Archive, reason: failure.reason }),
    ),
  );

  const lines = result.stdout.trim().split('\n');

  const processes = yield* Effect.forEach(lines, (line) => decodeHostProcess({ line, generation: input.generation }), {
    concurrency: 1,
  });

  return processes.filter(
    (candidate) => ownedGroups.has(candidate.groupId) && !DEAD_PROCESS_STATES.has(candidate.state),
  );
});

type DecodeHostProcessInput = Pick<FreezeInput, 'generation'> & { readonly line: string };

const decodeHostProcess = Effect.fn('decodeHostProcess')(function* ({
  line,
  generation,
}: DecodeHostProcessInput): Effect.fn.Return<FreezeProcess, WorkspaceFailed> {
  const match = PROCESS_FIELDS.exec(line);
  const matched = Option.fromNullishOr(match);

  if (Option.isNone(matched)) {
    return yield* new WorkspaceFailed({
      generation,
      step: WorkspaceStep.Archive,
      reason: 'host process identity did not decode',
    });
  }

  const [, processId, groupId, state, startedAt] = matched.value;
  const fields = { processId, groupId, state, startedAt };

  return yield* Schema.decodeUnknownEffect(HostProcess)(fields).pipe(
    Effect.mapError(
      (failure) => new WorkspaceFailed({ generation, step: WorkspaceStep.Archive, reason: failure.message }),
    ),
  );
});
