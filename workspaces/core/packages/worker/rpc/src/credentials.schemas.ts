import { EncryptedCredential } from '@mechane/deployment';
import { CredentialMetadata } from '@mechane/protocol';
import { Schema } from 'effect';

/** A missing reference returns none; stored values cross RPC only as authenticated ciphertext. */
export const CredentialReading = Schema.OptionFromNullOr(EncryptedCredential);

export type CredentialReading = typeof CredentialReading.Type;

/** Create-only conflicts disclose no existing value, while successful writes return metadata alone. */
export const CredentialMutation = Schema.TaggedUnion({ Saved: { metadata: CredentialMetadata }, AlreadyExists: {} });

export type CredentialMutation = typeof CredentialMutation.Type;
