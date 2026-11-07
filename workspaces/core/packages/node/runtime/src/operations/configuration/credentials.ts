import { catalog, CredentialAlreadyExists, RequestInvalid } from '@mechane/protocol';
import { RecordText } from '@mechane/records';
import { requireAuthenticated, validatedOperation } from '../validated-operation.ts';
import { credentialWire } from './presentation.ts';
import type { ConfigurationOperationsInput } from './types.ts';

export function createCredentialOperations({ store }: ConfigurationOperationsInput) {
  return {
    listCredentials: validatedOperation({
      operation: catalog.listCredentials,
      run: async ({ input, caller }) => {
        const actor = requireAuthenticated(caller);

        await store.authorizeConfigurationWorkspace({
          ...input,
          principalId: actor.principalId,
          isOwnerRequired: true,
        });

        const credentials = await store.listCredentials({ workspaceId: input.workspaceId });

        return { credentials: credentials.map(credentialWire) };
      },
    }),
    putCredential: validatedOperation({
      operation: catalog.putCredential,
      run: async ({ input, caller }) => {
        const actor = requireAuthenticated(caller);

        const saved = await store.runInTransaction(async (transaction) => {
          await transaction.authorizeConfigurationWorkspace({
            workspaceId: input.workspaceId,
            principalId: actor.principalId,
            isOwnerRequired: true,
          });

          const credential = await transaction.putCredential({
            workspaceId: input.workspaceId,
            reference: input.secretReference,
            value: input.value,
            isCreateOnly: input.isCreateOnly,
          });

          if (credential === null) {
            throw new CredentialAlreadyExists({ secretReference: RecordText.make(input.secretReference) });
          }

          await transaction.recordConfigurationChange({
            workspaceId: input.workspaceId,
            principalId: actor.principalId,
            credentialId: actor.keyId,
            action: 'credential.saved',
            targetId: input.secretReference,
          });

          return credential;
        });

        return credentialWire(saved);
      },
    }),
    deleteCredential: validatedOperation({
      operation: catalog.deleteCredential,
      run: async ({ input, caller }) => {
        const actor = requireAuthenticated(caller);

        await store.runInTransaction(async (transaction) => {
          await transaction.authorizeConfigurationWorkspace({
            workspaceId: input.workspaceId,
            principalId: actor.principalId,
            isOwnerRequired: true,
          });

          const result = await transaction.deleteCredential({
            workspaceId: input.workspaceId,
            reference: input.secretReference,
          });

          if (result === 'in-use') {
            throw new RequestInvalid({
              reason: 'remove this credential from its integrations and execution grants before deleting it',
            });
          }

          await transaction.recordConfigurationChange({
            workspaceId: input.workspaceId,
            principalId: actor.principalId,
            credentialId: actor.keyId,
            action: 'credential.deleted',
            targetId: input.secretReference,
          });
        });

        return { secret_reference: input.secretReference };
      },
    }),
  };
}
