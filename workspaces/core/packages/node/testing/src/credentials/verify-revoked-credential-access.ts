import { Effect, Redacted } from 'effect';
import { savedLoginToken } from '../accounts/saved-login-token.ts';
import { check } from '../check.ts';
import { refusedOperation } from '../cli/refused-operation.ts';
import { CREDENTIAL_REFERENCE, RefusalCode } from '../constants.ts';
import type { ScenarioFailure, WorkspaceAuthorityInput } from '../types.ts';

type VerifyRevokedCredentialAccessInput = WorkspaceAuthorityInput & { readonly guarantee: string };

/** A cached login must not preserve credential management after its owner's membership is removed. */
export const verifyRevokedCredentialAccess = Effect.fn('verifyRevokedCredentialAccess')(function* ({
  stack,
  workspace,
  guarantee,
}: VerifyRevokedCredentialAccessInput): Effect.fn.Return<void, ScenarioFailure> {
  const saved = yield* savedLoginToken({ account: workspace.owner });
  const credential = Redacted.make(saved.token);
  const workspaceId = workspace.workspaceId;
  const secretReference = CREDENTIAL_REFERENCE;
  const value = Redacted.make(stack.modelUpstream.apiKey);
  const request = { stack, credential };
  const listed = yield* refusedOperation({ ...request, name: 'listCredentials', input: { workspaceId } });

  const written = yield* refusedOperation({
    ...request,
    name: 'putCredential',
    input: { workspaceId, secretReference, value, isCreateOnly: false },
  });

  const deleted = yield* refusedOperation({
    ...request,
    name: 'deleteCredential',
    input: { workspaceId, secretReference },
  });

  const conditions = [listed, written, deleted].map((code) => code === RefusalCode.WorkspaceNotFound);

  yield* check({
    name: guarantee,
    conditions,
    detail: `removed owner credential access ${listed}, ${written}, ${deleted}`,
  });
});
