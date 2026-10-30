import type { EncryptedCredential } from '@mechane/deployment';
import { Result } from 'effect';
import { Base64 } from 'effect/encoding';
import { CREDENTIAL_NONCE_BYTES } from './constants.ts';
import type { IntegrationSecretInvalid } from './errors.ts';
import { failIntegrationSecret } from './fail-integration-secret.ts';

type CredentialEnvelope = { readonly nonce: Uint8Array<ArrayBuffer>; readonly ciphertext: Uint8Array<ArrayBuffer> };

type DecodeCredentialEnvelopeInput = { readonly credential: EncryptedCredential };

/** Malformed storage bytes never reach WebCrypto. */
export function decodeCredentialEnvelope({
  credential,
}: DecodeCredentialEnvelopeInput): Result.Result<CredentialEnvelope, IntegrationSecretInvalid> {
  const nonce = Base64.decode(credential.nonce);
  const ciphertext = Base64.decode(credential.ciphertext);

  if (Result.isFailure(nonce) || Result.isFailure(ciphertext)) {
    return failIntegrationSecret();
  }

  if (nonce.success.byteLength !== CREDENTIAL_NONCE_BYTES) {
    return failIntegrationSecret();
  }

  const nonceBytes = new Uint8Array(nonce.success);
  const ciphertextBytes = new Uint8Array(ciphertext.success);

  return Result.succeed({ nonce: nonceBytes, ciphertext: ciphertextBytes });
}
