import { SHA256_PATTERN } from '@mechane/records';
import { Redacted, Result } from 'effect';
import { Base64, Hex } from 'effect/encoding';
import { webcrypto } from 'node:crypto';
import type { CredentialEnvelope, CredentialKeyring } from '../domain.ts';
import { StoreConflict } from './errors.ts';

type EnvelopeIdentity = { readonly purpose: string; readonly workspaceId: string; readonly reference: string };

const ALGORITHM = 'AES-GCM';
const NONCE_BYTES = 12;

function associatedData({ purpose, workspaceId, reference }: EnvelopeIdentity): Uint8Array<ArrayBuffer> {
  const encoded = new TextEncoder().encode(JSON.stringify([purpose, workspaceId, reference]));

  return new Uint8Array(encoded);
}

async function importKey(keyring: CredentialKeyring, version: string): Promise<webcrypto.CryptoKey> {
  const key = keyring.keys[version];

  if (key === undefined || !SHA256_PATTERN.test(key.toLowerCase())) {
    throw new StoreConflict('Credential key is unavailable');
  }

  const decodedKey = Hex.decode(key);
  const bytes = new Uint8Array(Result.getOrThrow(decodedKey));

  return await webcrypto.subtle.importKey('raw', bytes, ALGORITHM, false, ['encrypt', 'decrypt']);
}

export async function encryptCredential(
  identity: EnvelopeIdentity,
  keyring: CredentialKeyring,
  value: Redacted.Redacted,
): Promise<CredentialEnvelope> {
  const key = await importKey(keyring, keyring.current);
  const nonce = webcrypto.getRandomValues(new Uint8Array(NONCE_BYTES));
  const plaintext = new TextEncoder().encode(Redacted.value(value));

  const ciphertext = await webcrypto.subtle.encrypt(
    { name: ALGORITHM, iv: nonce, additionalData: associatedData(identity) },
    key,
    plaintext,
  );

  const encryptedBytes = new Uint8Array(ciphertext);

  return { keyVersion: keyring.current, nonce: Base64.encode(nonce), ciphertext: Base64.encode(encryptedBytes) };
}

export async function decryptCredential(
  identity: EnvelopeIdentity,
  keyring: CredentialKeyring,
  envelope: CredentialEnvelope,
): Promise<Redacted.Redacted> {
  try {
    const key = await importKey(keyring, envelope.keyVersion);
    const decodedNonce = Base64.decode(envelope.nonce);
    const decodedCiphertext = Base64.decode(envelope.ciphertext);
    const nonce = new Uint8Array(Result.getOrThrow(decodedNonce));
    const ciphertext = new Uint8Array(Result.getOrThrow(decodedCiphertext));

    if (nonce.byteLength !== NONCE_BYTES) {
      throw new StoreConflict('Credential envelope is invalid');
    }

    const plaintext = await webcrypto.subtle.decrypt(
      { name: ALGORITHM, iv: nonce, additionalData: associatedData(identity) },
      key,
      ciphertext,
    );

    return Redacted.make(new TextDecoder().decode(plaintext));
  } catch {
    throw new StoreConflict('Credential could not be decrypted');
  }
}
