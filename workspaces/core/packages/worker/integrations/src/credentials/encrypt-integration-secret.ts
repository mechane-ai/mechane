import type { CredentialKeyring, EncryptedCredential } from '@mechane/deployment';
import { capturePromise } from '@mechane/utilities';
import { Redacted, Result } from 'effect';
import { Base64 } from 'effect/encoding';
import type { CredentialIdentity } from '../types.ts';
import { CREDENTIAL_ALGORITHM, CREDENTIAL_NONCE_BYTES } from './constants.ts';
import { credentialAssociatedData } from './credential-associated-data.ts';
import type { IntegrationSecretInvalid } from './errors.ts';
import { failIntegrationSecret } from './fail-integration-secret.ts';
import { importCredentialKey } from './import-credential-key.ts';

type EncryptIntegrationSecretInput = CredentialIdentity & {
  readonly value: Redacted.Redacted;
  readonly keyring: CredentialKeyring;
};

/** Every write draws its own nonce, even when the value and current key did not change. */
export async function encryptIntegrationSecret({
  workspaceId,
  secretReference,
  value,
  keyring,
}: EncryptIntegrationSecretInput): Promise<Result.Result<EncryptedCredential, IntegrationSecretInvalid>> {
  const { current: keyVersion } = Redacted.value(keyring);
  const key = await importCredentialKey({ keyring, keyVersion });

  if (Result.isFailure(key)) {
    return Result.fail(key.failure);
  }

  const nonceBytes = new Uint8Array(CREDENTIAL_NONCE_BYTES);
  const nonce = crypto.getRandomValues(nonceBytes);
  const additionalData = credentialAssociatedData({ workspaceId, secretReference });
  const encoder = new TextEncoder();
  const held = Redacted.value(value);
  const bytes = encoder.encode(held);
  const plaintext = new Uint8Array(bytes);

  const algorithm = { name: CREDENTIAL_ALGORITHM, iv: nonce, additionalData };
  const pending = crypto.subtle.encrypt(algorithm, key.success, plaintext);

  const encrypted = await capturePromise({ promise: pending });

  if (Result.isFailure(encrypted)) {
    return failIntegrationSecret();
  }

  const ciphertextBytes = new Uint8Array(encrypted.success);
  const ciphertext = Base64.encode(ciphertextBytes);
  const encodedNonce = Base64.encode(nonce);

  return Result.succeed({ keyVersion, nonce: encodedNonce, ciphertext });
}
