import type { EncryptedCredential } from '@mechane/deployment';
import type { IntegrationSecretReference } from '@mechane/protocol';
import { CredentialMutation } from '@mechane/rpc';
import type { WorkspaceStore } from '@mechane/workspace-store';
import { DateTime, Option } from 'effect';

type SaveCredentialInput = {
  readonly store: WorkspaceStore;
  readonly secretReference: IntegrationSecretReference;
  readonly credential: EncryptedCredential;
  readonly isCreateOnly: boolean;
};

/** The create-only check and encrypted write share a transaction so imports cannot replace an existing credential. */
export function saveCredential({
  store,
  secretReference,
  credential,
  isCreateOnly,
}: SaveCredentialInput): CredentialMutation {
  const save: () => CredentialMutation = () => {
    const previous = store.credential({ secretReference });

    if (isCreateOnly && Option.isSome(previous)) {
      return CredentialMutation.cases.AlreadyExists.make({});
    }

    const now = DateTime.nowUnsafe();
    const metadata = store.saveCredential({ secretReference, credential, now });

    return CredentialMutation.cases.Saved.make({ metadata });
  };

  return store.atomic({ run: save });
}
