import type { ExecutionClaim, ExecutionRow, SandboxStore } from '@mechane/sandbox-store';
import { ExecutionId } from '@mechane/sandbox-wire';
import { Duration, Option, Result, Schema } from 'effect';
import type { DateTime } from 'effect';

/**
 * A known execution id arrived with another request. Only pi's replay repeats an id, with the arguments it recorded, so
 * the sandbox dies with it, 041's refusal of a reused identity, and it joins no RPC answer.
 */
class ExecutionReused extends Schema.TaggedError<ExecutionReused>()('ExecutionReused', { executionId: ExecutionId }) {}

/** A claim the call decides against the sandbox's store, at the call's instant. */
type ClaimDecisionInput = {
  readonly store: SandboxStore;
  readonly request: ExecutionClaim;
  readonly now: DateTime.Utc;
};

/**
 * Claims the execution as pending, the intent of its run, in one transaction, or reads the one its id already names.
 * Since pi reruns a tool with the arguments it recorded, an id that holds another request is a broken invariant, which
 * it answers as `ExecutionReused`.
 */
export function claimExecution({
  store,
  request,
  now,
}: ClaimDecisionInput): Result.Result<ExecutionRow, ExecutionReused> {
  const { executionId, command, timeout } = request;

  const claim: () => Result.Result<ExecutionRow, ExecutionReused> = () => {
    if (Option.isNone(store.execution({ executionId }))) {
      store.claimExecution({ request, now });
    }

    const stored = store.execution({ executionId });
    // The claim above wrote the row when none was there, and nothing deletes one.
    const row = Option.getOrThrow(stored);
    const holdsRequest = row.command === command && Duration.equals(row.timeout, timeout);

    if (!holdsRequest) {
      const reused = new ExecutionReused({ executionId: row.id });

      return Result.fail(reused);
    }

    return Result.succeed(row);
  };

  return store.atomic({ run: claim });
}
