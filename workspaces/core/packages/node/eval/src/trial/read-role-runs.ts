import type { OperationCall } from '@mechane/client';
import { Turn } from '@mechane/protocol';
import type { MechId, TurnId } from '@mechane/records';
import { Array, Effect, Option, Schema, Stream } from 'effect';
import { EvalResponseInvalid } from '../errors.ts';
import type { EvalRunFailure, WorkspaceAccess } from '../types.ts';

type ReadRoleRunsInput = {
  readonly call: OperationCall<'listTurns'>;
  readonly access: WorkspaceAccess;
  readonly mechId: MechId;
};

type ReadRoleRunPageInput = ReadRoleRunsInput & { readonly after: Option.Option<TurnId> };
type RoleRunPage = readonly [ReadonlyArray<Turn>, Option.Option<Option.Option<TurnId>>];

const isSupportedTurn = Schema.is(Turn);

/** Reads all activations on the isolated role, including successors which no longer carry the original notification. */
export const readRoleRuns = Effect.fn('readRoleRuns')(function* (
  input: ReadRoleRunsInput,
): Effect.fn.Return<ReadonlyArray<Turn>, EvalRunFailure> {
  const firstPage = Option.none<TurnId>();
  const pages = Stream.paginate(firstPage, (after) => readRoleRunPage({ ...input, after }));

  return yield* Stream.runCollect(pages);
});

const readRoleRunPage = Effect.fn('readRoleRunPage')(function* ({
  call,
  access,
  mechId,
  after,
}: ReadRoleRunPageInput): Effect.fn.Return<RoleRunPage, EvalRunFailure> {
  const { token, workspaceId } = access;
  const page = yield* call({ name: 'listTurns', input: { workspaceId, mechId, after }, credential: token });
  const runs = page.turns;

  if (!runs.every(isSupportedTurn)) {
    const failure = new EvalResponseInvalid({
      mechId,
      reason: 'The runtime returned an unsupported activation status',
    });

    return yield* failure;
  }

  if (!page.hasMore) {
    return [runs, Option.none()];
  }

  const lastRun = Array.last(runs);

  if (Option.isNone(lastRun) || Option.contains(after, lastRun.value.id)) {
    const failure = new EvalResponseInvalid({ mechId, reason: 'The activation page has no advancing cursor' });

    return yield* failure;
  }

  const nextPage = Option.some(lastRun.value.id);

  return [runs, Option.some(nextPage)];
});
