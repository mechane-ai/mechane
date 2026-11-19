import type { AuthRuntimeStore } from '@mechane/control-store';
import { catalog, TokenPrefix } from '@mechane/protocol';
import type { AuthCaller } from '../types.ts';
import { requireAuthenticated, validatedOperation } from '../validated-operation.ts';
import { createAuthToken, hashAuthToken } from './secrets.ts';

function serviceActor(caller: AuthCaller) {
  const authenticated = requireAuthenticated(caller);

  return { principalId: authenticated.principalId, credentialId: authenticated.keyId };
}

export function createWorkspaceServiceOperations({
  store,
  keyLifetimeSeconds,
}: {
  readonly store: AuthRuntimeStore;
  readonly keyLifetimeSeconds: number;
}) {
  return {
    showWorkspaceServicePrincipal: validatedOperation({
      operation: catalog.showWorkspaceServicePrincipal,
      run: async ({ input, caller }) =>
        await store.auth.showWorkspaceServicePrincipal({ ...input, ...serviceActor(caller) }),
    }),
    rotateWorkspaceServiceKey: validatedOperation({
      operation: catalog.rotateWorkspaceServiceKey,
      run: async ({ input, caller }) => {
        const token = createAuthToken(TokenPrefix.WorkspaceService);

        const key = await store.auth.rotateWorkspaceServiceKey({
          ...input,
          ...serviceActor(caller),
          tokenHash: hashAuthToken(token),
          keyLifetimeSeconds,
        });

        return { ...key, token };
      },
    }),
    revokeWorkspaceServiceKey: validatedOperation({
      operation: catalog.revokeWorkspaceServiceKey,
      run: async ({ input, caller }) =>
        await store.auth.revokeWorkspaceServiceKey({ ...input, ...serviceActor(caller) }),
    }),
  };
}
