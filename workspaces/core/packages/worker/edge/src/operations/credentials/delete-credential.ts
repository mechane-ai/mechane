import type {
  catalog,
  CredentialDeletion,
  ObjectUnavailable,
  WorkspaceNotFound,
  WorkspaceOwnerRequired,
} from '@mechane/protocol';
import { Effect, Schema } from 'effect';
import { callOwnerWorkspace } from '../../admission/call-owner-workspace.ts';
import type { WorkInput } from '../../routing/types.ts';

/** Owner deletion is idempotent and leaves saved integration references unable to resolve the removed value. */
export const deleteCredential = Effect.fn('deleteCredential')(function* ({
  input,
  caller,
  settings,
}: WorkInput<typeof catalog.deleteCredential>): Effect.fn.Return<
  typeof CredentialDeletion.Type,
  ObjectUnavailable | WorkspaceNotFound | WorkspaceOwnerRequired
> {
  const { secretReference, workspaceId } = input;

  yield* callOwnerWorkspace({
    caller,
    settings,
    workspaceId,
    call: ({ workspace }) => workspace.deleteCredential({ secretReference }),
    answer: Schema.Undefined,
  });

  return { secretReference };
});
