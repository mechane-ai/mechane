import { HttpHeader, HttpMethod, HttpStatusCode } from '@mechane/records';
import { Schema } from 'effect';
import assert from 'node:assert/strict';

const EnvironmentKey = Schema.Struct({ key: Schema.NonEmptyString });
const KEY_REQUEST_TIMEOUT_MS = 10_000;

function environmentKeyPath({ environmentId }: { readonly environmentId: string }): string {
  return `/internal/managed/environments/${encodeURIComponent(environmentId)}/keys`;
}

export async function issueEnvironmentKey({
  origin,
  environmentId,
  token,
}: {
  readonly origin: URL;
  readonly environmentId: string;
  readonly token: string;
}): Promise<string> {
  const path = environmentKeyPath({ environmentId });

  const response = await fetch(new URL(path, origin), {
    method: HttpMethod.Post,
    headers: { [HttpHeader.Authorization]: `Bearer ${token}` },
    signal: AbortSignal.timeout(KEY_REQUEST_TIMEOUT_MS),
  });

  assert.equal(response.status, HttpStatusCode.Ok, 'Environment worker key provisioning failed');

  const key = Schema.decodeUnknownSync(EnvironmentKey)(await response.json());

  return key.key;
}
