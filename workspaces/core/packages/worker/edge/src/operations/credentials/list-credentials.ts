import { CredentialList } from '@mechane/protocol';
import type { catalog, ObjectUnavailable, WorkspaceNotFound, WorkspaceOwnerRequired } from '@mechane/protocol';
import { Effect } from 'effect';
import { callOwnerWorkspace } from '../../admission/call-owner-workspace.ts';
import type { WorkInput } from '../../routing/types.ts';

/** Owners receive references and rotation metadata without either credential values or encrypted envelopes. */
export const listCredentials = Effect.fn('listCredentials')(function* ({
  input,
  caller,
  settings,
}: WorkInput<typeof catalog.listCredentials>): Effect.fn.Return<
  typeof CredentialList.Type,
  ObjectUnavailable | WorkspaceNotFound | WorkspaceOwnerRequired
> {
  return yield* callOwnerWorkspace({
    caller,
    settings,
    workspaceId: input.workspaceId,
    call: ({ workspace }) => workspace.credentials(),
    answer: CredentialList,
  });
});
