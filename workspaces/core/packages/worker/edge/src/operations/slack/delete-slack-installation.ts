import type {
  catalog,
  ObjectUnavailable,
  SlackInstallationDeletion,
  WorkspaceNotFound,
  WorkspaceOwnerRequired,
} from '@mechane/protocol';
import { Effect, Schema } from 'effect';
import { callOwnerWorkspace } from '../../admission/call-owner-workspace.ts';
import type { WorkInput } from '../../routing/types.ts';

/** Disconnects a callback idempotently while retaining separately managed credentials and delivery history. */
export const deleteSlackInstallation = Effect.fn('deleteSlackInstallation')(function* ({
  input,
  caller,
  settings,
}: WorkInput<typeof catalog.deleteSlackInstallation>): Effect.fn.Return<
  SlackInstallationDeletion,
  ObjectUnavailable | WorkspaceNotFound | WorkspaceOwnerRequired
> {
  const { workspaceId, connectionId } = input;

  yield* callOwnerWorkspace({
    settings,
    caller,
    workspaceId,
    call: ({ workspace }) => workspace.deleteSlackInstallation({ connectionId }),
    answer: Schema.Undefined,
  });

  return { connectionId };
});
