import type { CommandResult, RunFailure, RunInput } from '@mechane/cli-kernel';
import type { Routine } from '@mechane/protocol';
import { DateTime, Effect, Option } from 'effect';
import { withWorkspace } from '../mechs/with-workspace.ts';

type RoutineLineInput = { readonly routine: Routine };
type RoutineTimeInput = { readonly at: Routine['nextDueAt'] };

function routineLine({ routine }: RoutineLineInput): string {
  return `${routine.id} revision ${routine.revision} ${routine.status}: ${routine.name}`;
}

function routineTime({ at }: RoutineTimeInput): string {
  if (Option.isNone(at)) {
    return 'none';
  }

  return DateTime.formatIso(at.value);
}

export const runRoutineShow = Effect.fn('runRoutineShow')(function* ({
  call,
  origin,
  input,
  credentials,
  selectedWorkspaceId,
}: RunInput<'history routine'>): Effect.fn.Return<CommandResult<'history routine'>, RunFailure> {
  const result = yield* withWorkspace({
    call,
    origin,
    credentials,
    selectedWorkspaceId,
    use: ({ token, workspaceId }) => call({ name: 'showRoutine', input: { ...input, workspaceId }, credential: token }),
  });

  const lines = [
    routineLine({ routine: result }),
    `Every ${result.everySeconds} seconds`,
    `Notification: ${result.text}`,
    `Next due: ${routineTime({ at: result.nextDueAt })}`,
    `Last due: ${routineTime({ at: result.lastDueAt })}`,
    `Last delivered: ${routineTime({ at: result.lastDeliveredAt })}`,
    `Last observed: ${routineTime({ at: result.lastObservedAt })}`,
  ];

  if (Option.isSome(result.lastObservedRunId)) {
    lines.push(`Observed run: ${result.lastObservedRunId.value}`);
  }

  return { result, lines };
});

export const runRoutineList = Effect.fn('runRoutineList')(function* ({
  call,
  origin,
  input,
  credentials,
  selectedWorkspaceId,
}: RunInput<'history routines'>): Effect.fn.Return<CommandResult<'history routines'>, RunFailure> {
  const result = yield* withWorkspace({
    call,
    origin,
    credentials,
    selectedWorkspaceId,
    use: ({ token, workspaceId }) =>
      call({ name: 'listRoutines', input: { ...input, workspaceId }, credential: token }),
  });

  const lines = result.routines.map((routine) => routineLine({ routine }));

  if (Option.isSome(result.nextAfter)) {
    lines.push(`More routines follow; continue with --after ${result.nextAfter.value}`);
  }

  return { result, lines };
});
