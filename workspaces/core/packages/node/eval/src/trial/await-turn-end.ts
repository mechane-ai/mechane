import type { OperationCall } from '@mechane/client';
import { TurnStatus } from '@mechane/protocol';
import type { NotificationId, Turn } from '@mechane/protocol';
import type { MechId } from '@mechane/records';
import { Array, Effect, Option } from 'effect';
import type { EvalRunFailure, WorkspaceAccess } from '../types.ts';
import { readRoleRuns } from './read-role-runs.ts';

type AwaitTurnEndInput = {
  readonly call: OperationCall<'listTurns'>;
  readonly access: WorkspaceAccess;
  readonly mechId: MechId;
  readonly notificationId: NotificationId;
};

const POLL_INTERVAL = '250 millis';
const ACTIVE_STATUSES: ReadonlySet<TurnStatus> = new Set([TurnStatus.Queued, TurnStatus.Running]);

/** Each role has a fresh mech and one notification; a successor is reserved before its predecessor becomes idle. */
export const awaitTurnEnd = Effect.fn('awaitTurnEnd')(function* (
  input: AwaitTurnEndInput,
): Effect.fn.Return<Array.NonEmptyReadonlyArray<Turn>, EvalRunFailure> {
  let completed = yield* readCompletedRoleRuns(input);

  while (Option.isNone(completed)) {
    completed = yield* readCompletedRoleRuns(input);
  }

  return completed.value;
});

const readCompletedRoleRuns = Effect.fn('readCompletedRoleRuns')(function* (
  input: AwaitTurnEndInput,
): Effect.fn.Return<Option.Option<Array.NonEmptyReadonlyArray<Turn>>, EvalRunFailure> {
  const runs = yield* readRoleRuns(input);
  const hasInput = runs.some((run) => run.notificationIds.includes(input.notificationId));
  const hasActiveRun = runs.some((run) => ACTIVE_STATUSES.has(run.status));

  if (Array.isReadonlyArrayNonEmpty(runs) && hasInput && !hasActiveRun) {
    return Option.some(runs);
  }

  yield* Effect.sleep(POLL_INTERVAL);

  return Option.none();
});
