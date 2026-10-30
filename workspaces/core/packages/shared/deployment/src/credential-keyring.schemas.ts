import { SHA256_PATTERN } from '@mechane/records';
import { Schema } from 'effect';

const CredentialKeyVersion = Schema.NonEmptyString.check(Schema.isPattern(/^[a-zA-Z0-9_-]+$/));
const CredentialEncryptionKey = Schema.String.check(Schema.isPattern(SHA256_PATTERN));

const KeyringContents = Schema.Struct({
  current: CredentialKeyVersion,
  keys: Schema.Record(CredentialKeyVersion, CredentialEncryptionKey),
}).check(
  Schema.makeFilter((keyring) => Object.hasOwn(keyring.keys, keyring.current), {
    expected: 'a keyring containing its current encryption key',
  }),
);

/** Old key versions remain available until their stored credentials have been re-encrypted. */
export const CredentialKeyring = Schema.RedactedFromValue(KeyringContents);
export type CredentialKeyring = typeof CredentialKeyring.Type;

/** The secret store supplies a JSON keyring whose decoded value remains redacted. */
export const CredentialKeyringVariable = Schema.fromJsonString(CredentialKeyring);
export type CredentialKeyringVariable = typeof CredentialKeyringVariable.Type;

/** Associated data is derived from the requested workspace and reference, never from this envelope. */
export const EncryptedCredential = Schema.Struct({
  keyVersion: Schema.NonEmptyString,
  nonce: Schema.NonEmptyString,
  ciphertext: Schema.NonEmptyString,
});

export type EncryptedCredential = typeof EncryptedCredential.Type;
