import { CredentialAlreadyExists } from '@mechane/protocol';
import type {
  catalog,
  CredentialMetadata,
  ObjectUnavailable,
  WorkerMisconfigured,
  WorkspaceNotFound,
  WorkspaceOwnerRequired,
} from '@mechane/protocol';
import { CredentialMutation } from '@mechane/rpc';
import { Effect } from 'effect';
import { callOwnerWorkspace } from '../../admission/call-owner-workspace.ts';
import { requireWorkspaceOwner } from '../../admission/require-workspace-owner.ts';
import type { WorkInput } from '../../routing/types.ts';
import { encryptCredential } from './encrypt-credential.ts';

/** Encrypts an owner's write-only value and preserves existing values when an import requires creation only. */
export const putCredential = Effect.fn('putCredential')(function* ({
  input,
  caller,
  settings,
}: WorkInput<typeof catalog.putCredential>): Effect.fn.Return<
  CredentialMetadata,
  ObjectUnavailable | WorkspaceNotFound | WorkspaceOwnerRequired | WorkerMisconfigured | CredentialAlreadyExists
> {
  const { workspaceId, secretReference, value, isCreateOnly } = input;

  yield* requireWorkspaceOwner({ settings, caller, workspaceId });

  const encrypted = yield* encryptCredential({ settings, workspaceId, secretReference, value });

  const result = yield* callOwnerWorkspace({
    caller,
    settings,
    workspaceId,
    call: ({ workspace }) => workspace.saveCredential({ secretReference, credential: encrypted, isCreateOnly }),
    answer: CredentialMutation,
  });

  if (CredentialMutation.guards.AlreadyExists(result)) {
    return yield* new CredentialAlreadyExists({ secretReference });
  }

  return result.metadata;
});
