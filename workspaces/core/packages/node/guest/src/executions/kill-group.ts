import { Effect, Result, Schema } from 'effect';

/** The error code of a signal to a process group with no process left. */
const NO_SUCH_PROCESS = 'ESRCH';

/** A kill of an execution's process group failed while the group still had a process. */
export class ExecutionUnkillable extends Schema.TaggedError<ExecutionUnkillable>()('ExecutionUnkillable', {
  groupId: Schema.Int,
  reason: Schema.String,
}) {}

/** The failure of a signal to a process group that has no process left, which means the group already ended. */
const NoSuchProcess = Schema.Struct({ code: Schema.Literal(NO_SUCH_PROCESS) });

const isNoSuchProcess = Schema.is(NoSuchProcess);

type KillGroupInput = { readonly groupId: number };

/**
 * Kills every process of an execution's group. A group with no process left has ended already; any other failure of the
 * kill leaves processes the guest cannot stop, so callers release it with `Effect.orDie`.
 */
export const killGroup = Effect.fn('killGroup')(function* ({
  groupId,
}: KillGroupInput): Effect.fn.Return<void, ExecutionUnkillable> {
  const killed = Result.try(() => process.kill(-groupId, 'SIGKILL'));

  if (Result.isSuccess(killed) || isNoSuchProcess(killed.failure)) {
    return;
  }

  const reason = String(killed.failure);

  return yield* new ExecutionUnkillable({ groupId, reason });
});
