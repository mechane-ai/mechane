import type { CredentialKeyring, EncryptedCredential } from '@mechane/deployment';
import { capturePromise } from '@mechane/utilities';
import { Redacted, Result } from 'effect';
import type { CredentialIdentity } from '../types.ts';
import { CREDENTIAL_ALGORITHM } from './constants.ts';
import { credentialAssociatedData } from './credential-associated-data.ts';
import { decodeCredentialEnvelope } from './decode-credential-envelope.ts';
import type { IntegrationSecretInvalid } from './errors.ts';
import { failIntegrationSecret } from './fail-integration-secret.ts';
import { importCredentialKey } from './import-credential-key.ts';

type DecryptIntegrationSecretInput = CredentialIdentity & {
  readonly credential: EncryptedCredential;
  readonly keyring: CredentialKeyring;
};

/** Only an authenticated envelope reaches the caller as a redacted value. */
export async function decryptIntegrationSecret({
  workspaceId,
  secretReference,
  credential,
  keyring,
}: DecryptIntegrationSecretInput): Promise<Result.Result<Redacted.Redacted, IntegrationSecretInvalid>> {
  const key = await importCredentialKey({ keyring, keyVersion: credential.keyVersion });

  if (Result.isFailure(key)) {
    return Result.fail(key.failure);
  }

  const envelope = decodeCredentialEnvelope({ credential });

  if (Result.isFailure(envelope)) {
    return Result.fail(envelope.failure);
  }

  const additionalData = credentialAssociatedData({ workspaceId, secretReference });
  const { nonce: iv, ciphertext } = envelope.success;
  const pending = crypto.subtle.decrypt({ name: CREDENTIAL_ALGORITHM, iv, additionalData }, key.success, ciphertext);
  const decrypted = await capturePromise({ promise: pending });

  if (Result.isFailure(decrypted)) {
    return failIntegrationSecret();
  }

  const decoder = new TextDecoder();
  const value = decoder.decode(decrypted.success);
  const secret = Redacted.make(value);

  return Result.succeed(secret);
}
