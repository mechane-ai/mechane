import type { WorkerSettings } from '@mechane/bindings';
import type { EncryptedCredential } from '@mechane/deployment';
import { encryptIntegrationSecret } from '@mechane/integrations';
import { WorkerMisconfigured } from '@mechane/protocol';
import type { WorkspaceId } from '@mechane/records';
import { Effect, Result } from 'effect';
import type { Redacted } from 'effect';

type EncryptCredentialInput = {
  readonly settings: WorkerSettings;
  readonly workspaceId: WorkspaceId;
  readonly secretReference: string;
  readonly value: Redacted.Redacted;
};

/** Only ciphertext crosses into workspace storage; unavailable or invalid operator keys fail without exposing them. */
export const encryptCredential = Effect.fn('encryptCredential')(function* ({
  settings,
  workspaceId,
  secretReference,
  value,
}: EncryptCredentialInput): Effect.fn.Return<EncryptedCredential, WorkerMisconfigured> {
  const keyring = yield* Effect.tryPromise({
    try: () => settings.credentialKeyring(),
    catch: () => new WorkerMisconfigured({ reason: 'credential encryption keyring is unavailable' }),
  });

  const encrypted = yield* Effect.tryPromise({
    try: () => encryptIntegrationSecret({ workspaceId, secretReference, value, keyring }),
    catch: () => new WorkerMisconfigured({ reason: 'credential encryption failed' }),
  });

  if (Result.isFailure(encrypted)) {
    return yield* new WorkerMisconfigured({ reason: 'credential encryption failed' });
  }

  return encrypted.success;
});
