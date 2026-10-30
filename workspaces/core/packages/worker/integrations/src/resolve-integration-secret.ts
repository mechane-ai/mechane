import { capturePromise } from '@mechane/utilities';
import { Option, Result } from 'effect';
import type { Redacted } from 'effect';
import { decryptIntegrationSecret } from './credentials/decrypt-integration-secret.ts';
import type { IntegrationSecretInvalid } from './credentials/errors.ts';
import { failIntegrationSecret } from './credentials/fail-integration-secret.ts';
import { readEncryptedCredential } from './credentials/read-encrypted-credential.ts';
import type { ResolveIntegrationSecretInput } from './types.ts';

/** A missing credential never falls back to deployment configuration or another workspace. */
export async function resolveIntegrationSecret({
  settings,
  workspaceId,
  secretReference,
}: ResolveIntegrationSecretInput): Promise<Result.Result<Option.Option<Redacted.Redacted>, IntegrationSecretInvalid>> {
  const decoded = await readEncryptedCredential({ settings, workspaceId, secretReference });

  if (Result.isFailure(decoded)) {
    return Result.fail(decoded.failure);
  }

  if (Option.isNone(decoded.success)) {
    const missing = Option.none();

    return Result.succeed(missing);
  }

  const current = settings.credentialKeyring();
  const keyring = await capturePromise({ promise: current });

  if (Result.isFailure(keyring)) {
    return failIntegrationSecret();
  }

  const decrypted = await decryptIntegrationSecret({
    workspaceId,
    secretReference,
    credential: decoded.success.value,
    keyring: keyring.success,
  });

  return Result.map(decrypted, Option.some);
}
