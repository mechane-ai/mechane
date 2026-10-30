import { SlackInstallations } from '@mechane/protocol';
import type { catalog, ObjectUnavailable, WorkspaceNotFound, WorkspaceOwnerRequired } from '@mechane/protocol';
import { Effect } from 'effect';
import { callOwnerWorkspace } from '../../admission/call-owner-workspace.ts';
import type { WorkInput } from '../../routing/types.ts';

/** Owners inspect the connections admitted by the workspace without reading their referenced credentials. */
export const listSlackInstallations = Effect.fn('listSlackInstallations')(function* ({
  input,
  caller,
  settings,
}: WorkInput<typeof catalog.listSlackInstallations>): Effect.fn.Return<
  SlackInstallations,
  ObjectUnavailable | WorkspaceNotFound | WorkspaceOwnerRequired
> {
  return yield* callOwnerWorkspace({
    settings,
    caller,
    workspaceId: input.workspaceId,
    call: ({ workspace }) => workspace.slackInstallations(),
    answer: SlackInstallations,
  });
});
