import { SlackInstallation, SlackInstallationResult } from '@mechane/protocol';
import type { catalog, ObjectUnavailable, WorkspaceNotFound, WorkspaceOwnerRequired } from '@mechane/protocol';
import { Effect, Schema } from 'effect';
import { callOwnerWorkspace } from '../../admission/call-owner-workspace.ts';
import type { WorkInput } from '../../routing/types.ts';

/** Owners bind a stable callback identity to workspace credential references without copying credential values. */
export const configureSlackInstallation = Effect.fn('configureSlackInstallation')(function* ({
  input,
  caller,
  settings,
}: WorkInput<typeof catalog.configureSlackInstallation>): Effect.fn.Return<
  SlackInstallationResult,
  ObjectUnavailable | WorkspaceNotFound | WorkspaceOwnerRequired
> {
  const { workspaceId, connectionId, isCreateOnly, ...configuration } = input;
  const installation = Schema.encodeSync(SlackInstallation)({ id: connectionId, workspaceId, ...configuration });

  return yield* callOwnerWorkspace({
    settings,
    caller,
    workspaceId,
    call: ({ workspace }) => workspace.configureSlackInstallation({ installation, isCreateOnly }),
    answer: SlackInstallationResult,
  });
});
