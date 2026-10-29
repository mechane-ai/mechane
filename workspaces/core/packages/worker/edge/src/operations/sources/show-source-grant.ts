import { callMech } from '@mechane/bindings';
import { MechNotFound } from '@mechane/protocol';
import type { catalog, OperationFailure, SourceGrantState } from '@mechane/protocol';
import { SourceGrantAnswer } from '@mechane/rpc';
import { Effect, Match } from 'effect';
import { requireWorkspaceOwner } from '../../admission/require-workspace-owner.ts';
import type { WorkInput } from '../../routing/types.ts';

/** An owner may inspect grants without receiving provider credentials or triggering source work. */
export const showSourceGrant = Effect.fn('showSourceGrant')(function* ({
  input,
  settings,
  caller,
}: WorkInput<typeof catalog.showSourceGrant>): Effect.fn.Return<
  SourceGrantState,
  OperationFailure<typeof catalog.showSourceGrant>
> {
  const { workspaceId, mechId } = input;

  yield* requireWorkspaceOwner({ settings, caller, workspaceId });

  const answer = yield* callMech({
    settings,
    workspaceId,
    mechId,
    call: ({ mech }) => mech.sourceGrant(),
    answer: SourceGrantAnswer,
  });

  return yield* Match.valueTags(answer, {
    Found: ({ state }) => Effect.succeed(state),
    MechMissing: () => new MechNotFound({ mechId }),
  });
});
