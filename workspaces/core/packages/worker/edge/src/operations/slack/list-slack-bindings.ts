import { callWorkspace } from '@mechane/bindings';
import { SlackBindings } from '@mechane/protocol';
import type { catalog, ObjectUnavailable } from '@mechane/protocol';
import { Effect } from 'effect';
import type { WorkInput } from '../../routing/types.ts';

/** Lists the Slack bindings visible to the workspace member. */
export const listSlackBindings = Effect.fn('listSlackBindings')(function* ({
  input,
  settings,
}: WorkInput<typeof catalog.listSlackBindings>): Effect.fn.Return<SlackBindings, ObjectUnavailable> {
  return yield* callWorkspace({
    settings,
    workspaceId: input.workspaceId,
    call: ({ workspace }) => workspace.slackBindings(),
    answer: SlackBindings,
  });
});
