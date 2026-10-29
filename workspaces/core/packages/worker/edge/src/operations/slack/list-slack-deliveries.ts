import { callMech } from '@mechane/bindings';
import { SlackDeliveries } from '@mechane/protocol';
import type { catalog, ObjectUnavailable } from '@mechane/protocol';
import { Effect } from 'effect';
import type { WorkInput } from '../../routing/types.ts';

/** Lists the most recent durable Slack receipts for a workspace agent. */
export const listSlackDeliveries = Effect.fn('listSlackDeliveries')(function* ({
  input,
  settings,
}: WorkInput<typeof catalog.listSlackDeliveries>): Effect.fn.Return<SlackDeliveries, ObjectUnavailable> {
  return yield* callMech({
    settings,
    workspaceId: input.workspaceId,
    mechId: input.mechId,
    call: ({ mech }) => mech.slackDeliveries(),
    answer: SlackDeliveries,
  });
});
