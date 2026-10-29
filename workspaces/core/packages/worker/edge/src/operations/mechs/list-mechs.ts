import { callWorkspace } from '@mechane/bindings';
import { catalog, RequestInvalid } from '@mechane/protocol';
import type { MechPage, ObjectUnavailable } from '@mechane/protocol';
import { MechSummaryPage } from '@mechane/rpc';
import { Effect, Match, Schema } from 'effect';
import type { WorkInput } from '../../routing/types.ts';

/** Lists a page of the workspace's mechs from its index, oldest first. */
export const listMechs = Effect.fn('listMechs')(function* ({
  input,
  settings,
}: WorkInput<typeof catalog.listMechs>): Effect.fn.Return<MechPage, RequestInvalid | ObjectUnavailable> {
  const query = Schema.encodeSync(catalog.listMechs.query)({ after: input.after });

  const page = yield* callWorkspace({
    settings,
    workspaceId: input.workspaceId,
    call: ({ workspace }) => workspace.mechs({ query }),
    answer: MechSummaryPage,
  });

  return yield* Match.valueTags(page, {
    Listed: ({ mechs, hasMore }) => Effect.succeed({ mechs, hasMore }),
    CursorMissing: () => new RequestInvalid({ reason: 'after names no mech of this workspace' }),
  });
});
