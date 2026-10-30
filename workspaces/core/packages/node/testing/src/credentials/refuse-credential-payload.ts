import { bearerAuthorization, catalog } from '@mechane/protocol';
import { HttpHeader, HttpStatusCode } from '@mechane/records';
import type { WorkspaceId } from '@mechane/records';
import type { Stack } from '@mechane/stack';
import { Effect } from 'effect';
import { savedLoginToken } from '../accounts/saved-login-token.ts';
import { sentPage } from '../browser/sent-page.ts';
import { check } from '../check.ts';
import { BrowserStep, CREDENTIAL_REFERENCE } from '../constants.ts';
import type { Account, ScenarioFailure } from '../types.ts';

type RefuseCredentialPayloadInput = {
  readonly stack: Stack;
  readonly account: Account;
  readonly workspaceId: WorkspaceId;
  readonly guarantee: string;
};

type CredentialUrlInput = { readonly origin: URL; readonly workspaceId: WorkspaceId; readonly secretReference: string };

/** A secret in an unexpected field name catches diagnostics that redact only field values. */
export const refuseCredentialPayload = Effect.fn('refuseCredentialPayload')(function* ({
  stack,
  account,
  workspaceId,
  guarantee,
}: RefuseCredentialPayloadInput): Effect.fn.Return<void, ScenarioFailure> {
  const saved = yield* savedLoginToken({ account });
  const url = credentialUrl({ origin: stack.origin, workspaceId, secretReference: CREDENTIAL_REFERENCE });
  const authorization = bearerAuthorization({ token: saved.token });
  const body = JSON.stringify({ value: stack.modelUpstream.apiKey, [stack.modelUpstream.apiKey]: 'unexpected field' });

  const request = new Request(url, {
    method: catalog.putCredential.method,
    headers: { [HttpHeader.Authorization]: authorization },
    body,
  });

  const malformed = yield* sentPage({ step: BrowserStep.Open, request });
  const isPrivate = !malformed.text.includes(stack.modelUpstream.apiKey);
  const conditions = [malformed.status === HttpStatusCode.BadRequest, isPrivate];

  yield* check({
    name: guarantee,
    conditions,
    detail: `credential malformed ${malformed.status}; values private ${isPrivate}`,
  });
});

function credentialUrl({ origin, workspaceId, secretReference }: CredentialUrlInput): URL {
  const workspace = encodeURIComponent(workspaceId);
  const reference = encodeURIComponent(secretReference);
  const path = catalog.putCredential.path.replace(':workspace_id', workspace).replace(':secret_reference', reference);

  return new URL(path, origin);
}
